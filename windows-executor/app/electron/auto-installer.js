"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoInstallMT5 = void 0;
const mt5_auto_installer_service_1 = require("../src/services/mt5-auto-installer.service");
// Export the auto-installer service for use in main process
exports.autoInstallMT5 = new mt5_auto_installer_service_1.MT5AutoInstaller();
