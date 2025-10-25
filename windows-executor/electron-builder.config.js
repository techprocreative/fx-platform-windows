module.exports = {
  appId: "com.fxplatform.executor",
  productName: "FX Platform Executor",

  directories: {
    output: "dist",
    buildResources: "resources",
  },

  // Use simple patterns with new output folder (app/ instead of dist/)
  files: [
    "app/**/*",
    "!app/dist-app",  // Exclude, will be added separately
    "node_modules/**/*",
    "!node_modules/**/test/**",
    "!node_modules/**/tests/**",
    "resources/**/*",
    "package.json",
    {
      from: "dist-app",
      to: "dist-app"
    }
  ],
  
  // Don't use .gitignore patterns
  useGitIgnore: false,
  
  // Re-enable asar for production
  asar: true,

  // CRITICAL: Native modules must be unpacked from asar
  asarUnpack: [
    "node_modules/zeromq/**/*",
    "node_modules/better-sqlite3/**/*",
    "resources/**/*",
  ],

  // Extra resources to copy outside asar (critical for native DLLs and MT5 files)
  extraResources: [
    {
      from: "resources/libs",
      to: "resources/libs",
      filter: ["*.dll"]  // Copy all DLL files
    },
    {
      from: "resources/experts",
      to: "resources/experts",
      filter: ["*.mq5", "*.ex5"]  // Copy MT5 Expert Advisors
    },
    {
      from: "resources/icons",
      to: "resources/icons",
      filter: ["*.ico", "*.png"]  // Copy icons
    }
  ],

  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    requestedExecutionLevel: "requireAdministrator",
    icon: "resources/icons/icon.ico",
    publisherName: "FX Platform",
  },

  nsis: {
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    perMachine: true,
    shortcutName: "FX Platform Executor",
    artifactName: "${productName}-Setup-${version}.${ext}"
  },

  // Disable auto-publish for now
  publish: null,
  
  // Hook to copy resources after packing
  afterPack: "./scripts/afterPack.js"
};
