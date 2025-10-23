module.exports = {
  appId: "com.fxplatform.executor",
  productName: "FX Platform Executor",
  copyright: "Copyright © 2025 FX Platform",

  directories: {
    output: "dist-electron",
    buildResources: "resources",
  },

  files: [
    "electron/**/*",
    "dist/**/*",
    "node_modules/**/*",
    "package.json",
    "!node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
    "!node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
    "!node_modules/*.d.ts",
    "!node_modules/.bin",
    "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
    "!.editorconfig",
    "!**/._*",
    "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
    "!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
    "!**/{appveyor.yml,.travis.yml,circle.yml}",
    "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}",
  ],

  extraResources: [
    {
      from: "resources",
      to: "resources",
      filter: ["**/*"],
    },
    {
      from: "node_modules/zeromq/build",
      to: "zeromq-build",
      filter: ["**/*.node"],
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
    icon: "resources/icons/icon.ico",
    requestedExecutionLevel: "asInvoker",
    publisherName: "FX Platform",
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "FX Platform Executor",
    installerIcon: "resources/icons/icon.ico",
    uninstallerIcon: "resources/icons/icon.ico",
    deleteAppDataOnUninstall: false,
    artifactName: "${productName}-Setup-${version}.${ext}",
    license: "LICENSE",
    runAfterFinish: true,
    menuCategory: true,
    displayLanguageSelector: false,
    installerLanguages: ["en_US"],
    language: "1033",
  },

  mac: {
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"],
      },
    ],
    icon: "resources/icons/icon.icns",
    category: "public.app-category.finance",
    entitlements: "entitlements.mac.plist",
    entitlementsInherit: "entitlements.mac.plist",
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },

  linux: {
    target: [
      {
        target: "AppImage",
        arch: ["x64"],
      },
      {
        target: "deb",
        arch: ["x64"],
      },
    ],
    icon: "resources/icons/icon.png",
    category: "Office",
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
