// Jest setup file
import 'jest';

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: React.createElement')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps has been renamed')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  console.log = (...args: any[]) => {
    // Suppress specific log messages
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('MSW is now ready to mock requests') ||
        args[0].includes('Starting the application'))
    ) {
      return;
    }
    originalLog.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Set up global test timeout
jest.setTimeout(30000);

// Mock Electron APIs
global.window = {
  navigator: {
    userAgent: 'Electron',
  },
} as any;

// Mock Electron safeStorage
const mockSafeStorage = {
  encryptString: jest.fn((plainText: string) => {
    return Buffer.from(plainText).toString('base64');
  }),
  decryptString: jest.fn((encrypted: string) => {
    return Buffer.from(encrypted, 'base64').toString();
  }),
  isEncryptionAvailable: jest.fn(() => true),
};

// Mock Electron APIs
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') return '/tmp/user-data';
      return '/tmp';
    }),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'FX Platform Executor'),
    setAsDefaultProtocolClient: jest.fn(),
    requestSingleInstanceLock: jest.fn(() => true),
    quit: jest.fn(),
    relaunch: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      on: jest.fn(),
      send: jest.fn(),
      setWindowOpenHandler: jest.fn(() => ({ action: 'deny' })),
    },
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn(() => false),
    focus: jest.fn(),
    restore: jest.fn(),
    minimize: jest.fn(),
    center: jest.fn(),
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn(),
  },
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn(),
  },
  nativeImage: {
    createFromPath: jest.fn(),
  },
  safeStorage: mockSafeStorage,
  shell: {
    openExternal: jest.fn(),
  },
}));

// Mock Electron Store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => {
      if (key === 'config') return null;
      return {};
    }),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  }));
});

// Mock ZeroMQ
jest.mock('zeromq', () => ({
  socket: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn(),
    receive: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
    },
  })),
  context: jest.fn(() => ({
    term: jest.fn(),
  })),
}));

// Mock Pusher
jest.mock('pusher-js', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    bind: jest.fn(),
    unbind: jest.fn(),
    subscribe: jest.fn(() => ({
      bind: jest.fn(),
      unbind: jest.fn(),
    })),
    connection: {
      bind: jest.fn(),
      unbind: jest.fn(),
    },
  }));
});

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((command: string, callback: Function) => {
    if (command.includes('wmic')) {
      callback(null, { stdout: 'Node,C:\\\n' });
    } else if (command.includes('ping')) {
      callback(null, { stdout: '' });
    } else if (command.includes('tasklist')) {
      callback(null, { stdout: '50' });
    }
  }),
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: {
      on: jest.fn(),
    },
    stderr: {
      on: jest.fn(),
    },
  })),
}));

// Mock fs-extra
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  remove: jest.fn(),
  copy: jest.fn(),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, format: string) => {
    return date.toISOString();
  }),
  parseISO: jest.fn((dateString: string) => {
    return new Date(dateString);
  }),
  isAfter: jest.fn((date: Date, dateToCompare: Date) => {
    return date.getTime() > dateToCompare.getTime();
  }),
}));

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}