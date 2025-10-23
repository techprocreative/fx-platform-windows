module.exports = {
  appId: 'com.fxplatform.executor',
  productName: 'FX Platform Executor',
  copyright: 'Copyright © 2023 FX Platform',
  
  directories: {
    output: 'dist-electron',
    buildResources: 'resources',
  },
  
  files: [
    'electron/**/*',
    'dist/**/*',
    'node_modules/**/*',
    'package.json',
  ],
  
  extraResources: [
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
  ],
  
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    icon: 'resources/icons/icon.ico',
    requestedExecutionLevel: 'asInvoker',
    publisherName: 'FX Platform',
  },
  
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'FX Platform Executor',
    include: 'installer.nsh',
  },
  
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
    ],
    icon: 'resources/icons/icon.icns',
    category: 'public.app-category.finance',
    entitlements: 'entitlements.mac.plist',
    entitlementsInherit: 'entitlements.mac.plist',
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },
  
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64'],
      },
      {
        target: 'deb',
        arch: ['x64'],
      },
    ],
    icon: 'resources/icons/icon.png',
    category: 'Office',
  },
  
  publish: {
    provider: 'github',
    owner: 'fx-platform',
    repo: 'fx-executor',
    private: false,
    releaseType: 'release',
  },
  
  afterSign: 'scripts/notarize.js',
  afterAllArtifactBuild: 'scripts/artifacts.js',
};