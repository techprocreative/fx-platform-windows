# FX Platform Windows Executor - Developer Documentation

This document provides detailed information for developers working on the FX Platform Windows Executor.

## Architecture Overview

The application follows a modular architecture with clear separation of concerns:

```
┌─────────────────┐
│   Electron UI   │
└─────────┬───────┘
          │
┌─────────▼───────┐
│ Main Controller │
└─────────┬───────┘
          │
    ┌─────┼─────┐
    │     │     │
┌───▼───┐ ┌─▼───┐ ┌─▼─────┐
│Services│ │Types │ │Utils  │
└───────┘ └─────┘ └───────┘
```

### Core Components

#### Main Controller (`src/app/main-controller.ts`)

The central orchestrator that:
- Initializes all services
- Manages application lifecycle
- Handles error scenarios
- Coordinates between services

#### Services (`src/services/`)

Specialized services that handle specific functionality:
- `PusherService`: Real-time communication with web platform
- `ZeroMQService`: Communication with MT5
- `CommandService`: Command processing and execution
- `SafetyService`: Trading safety and limits
- `MonitoringService`: System health and performance
- `SecurityService`: Authentication and encryption
- `MT5DetectorService`: MT5 installation detection
- `MT5AutoInstallerService`: Automatic component installation
- `HeartbeatService`: System health monitoring

#### Types (`src/types/`)

TypeScript type definitions for:
- Commands and responses
- Configuration
- Security
- MT5 integration
- Database entities

#### Utils (`src/utils/`)

Utility functions for:
- File operations
- Logging
- Cryptography
- Performance measurement

## Development Workflow

### Setting Up the Development Environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Rebuild native modules: `npm run rebuild`
4. Start development: `npm run dev`

### Code Organization

Follow these guidelines when contributing:

1. **Use TypeScript for all new code**
2. **Follow the existing file structure**
3. **Keep components focused on a single responsibility**
4. **Add proper JSDoc comments for public APIs**
5. **Write unit tests for new functionality**

### Service Development Pattern

When creating a new service:

1. Define the service interface in `src/types/`
2. Implement the service class in `src/services/`
3. Add proper error handling
4. Include logging
5. Write unit tests
6. Update the Main Controller to initialize the service

Example service structure:

```typescript
// src/types/my-service.types.ts
export interface MyServiceConfig {
  option1: string;
  option2: number;
}

export interface MyServiceData {
  id: string;
  value: any;
}

// src/services/my-service.service.ts
import { MyServiceConfig, MyServiceData } from '../types/my-service.types';
import { EventEmitter } from 'events';

export class MyService extends EventEmitter {
  private config: MyServiceConfig;
  private logger: (level: string, message: string, metadata?: any) => void;
  
  constructor(config: MyServiceConfig, logger: Function) {
    super();
    this.config = config;
    this.logger = logger;
  }
  
  async initialize(): Promise<boolean> {
    try {
      this.logger('info', 'Initializing MyService');
      // Initialization logic
      this.emit('initialized');
      return true;
    } catch (error) {
      this.logger('error', 'Failed to initialize MyService', { error });
      return false;
    }
  }
  
  async processData(data: MyServiceData): Promise<any> {
    try {
      // Processing logic
      this.logger('debug', 'Processing data', { data });
      return { success: true, result: 'processed' };
    } catch (error) {
      this.logger('error', 'Failed to process data', { error });
      throw error;
    }
  }
}
```

### Error Handling

Follow these guidelines for error handling:

1. Use try-catch blocks for async operations
2. Include detailed error information in logs
3. Emit error events for critical errors
4. Return appropriate error responses
5. Implement retry logic where appropriate

### Logging

Use the centralized logging system:

```typescript
// In services
this.logger('info', 'Operation completed', { result });
this.logger('error', 'Operation failed', { error });

// In components
window.electronAPI.onLogAdded((log) => {
  console.log(`[${log.level}] ${log.message}`);
});
```

## Testing

### Unit Tests

Unit tests should be written for all services and utility functions:

```typescript
// src/tests/my-service.test.ts
import { MyService } from '../services/my-service.service';

describe('MyService', () => {
  let myService: MyService;
  const mockLogger = jest.fn();
  
  beforeEach(() => {
    myService = new MyService({ option1: 'test', option2: 123 }, mockLogger);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await myService.initialize();
      expect(result).toBe(true);
      expect(mockLogger).toHaveBeenCalledWith('info', 'Initializing MyService');
    });
  });
});
```

### Integration Tests

Integration tests should verify the interaction between components:

```typescript
// src/tests/integration/main-controller.test.ts
import { MainController } from '../app/main-controller';

describe('MainController Integration', () => {
  let mainController: MainController;
  
  beforeEach(() => {
    mainController = new MainController();
  });
  
  afterEach(async () => {
    await mainController.shutdown('Test cleanup');
  });
  
  it('should initialize with valid config', async () => {
    const config = {
      // Valid configuration
    };
    
    const result = await mainController.initialize(config);
    expect(result).toBe(true);
  });
});
```

## Debugging

### Electron Debugging

1. Open DevTools in the main window
2. Use the `--inspect` flag for Node.js debugging
3. Add debug statements with `console.log` or the logger

### Service Debugging

1. Check the logs in the application
2. Use the browser DevTools for renderer process debugging
3. Add event listeners to track service events

## Performance Considerations

1. **Avoid blocking operations in the main thread**
2. **Use worker threads for CPU-intensive tasks**
3. **Implement proper cleanup for resources**
4. **Monitor memory usage**
5. **Optimize database queries**

## Security Best Practices

1. **Never store secrets in plain text**
2. **Validate all inputs**
3. **Use secure communication channels**
4. **Implement proper access controls**
5. **Regularly update dependencies**

## Deployment

### Building for Production

1. Build the React app: `npm run build:react`
2. Build the Electron app: `npm run build:electron`
3. Package the app: `npm run package:win`

### Release Process

1. Update version numbers
2. Create a release tag
3. Build release artifacts
4. Test the release
5. Publish the release

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Update documentation
7. Submit a pull request

## Code Style

Follow these style guidelines:

1. Use TypeScript for all new code
2. Use ES6+ features
3. Use descriptive variable and function names
4. Add JSDoc comments for public APIs
5. Keep functions small and focused
6. Use proper error handling

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://reactjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Node.js Documentation](https://nodejs.org/docs)