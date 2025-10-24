module.exports = {
  appId: "com.fxplatform.executor",
  productName: "FX Platform Executor",

  directories: {
    output: "dist-build",
    buildResources: "resources",
  },

  files: [
    "dist/**/*",
    "dist/electron/**/*",
    "node_modules/**/*",
    "resources/**/*",
    "package.json",
    "!node_modules/**/{CHANGELOG.md,README.md,README,readme.md,readme}",
    "!node_modules/**/{test,__tests__,tests,powered-test,example,examples}/**/*",
    "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
    "!**/{appveyor.yml,.travis.yml,circle.yml}",
    "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}",
  ],

  extraResources: [
    {
      from: "resources/libs",
      to: "resources/libs",
      filter: ["libzmq-x64.dll", "libzmq-x86.dll"],
    },
    {
      from: "resources/experts",
      to: "resources/experts",
      filter: ["*.mq5", "*.ex5"],
    },
    {
      from: "node_modules/zeromq/build/Release",
      to: "resources/native",
      filter: ["*.node"],
    },
  ],

  asarUnpack: [
    "node_modules/zeromq/**/*",
    "node_modules/better-sqlite3/**/*",
    "resources/**/*",
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
    artifactName: "${productName}-Setup-${version}.${ext}",
  },

  publish: {
    provider: "github",
    owner: "fx-platform",
    repo: "fx-executor",
    private: false,
    releaseType: "release",
  },

  compression: "maximum",

  afterPack: "./scripts/afterPack.js",
};
