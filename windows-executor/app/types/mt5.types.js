"use strict";
/**
 * Type definitions for MT5 Auto-Installer Module
 * Based on WINDOWS_EXECUTOR_PLAN.md specifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MT5InstallationType = exports.Architecture = exports.InstallerStep = void 0;
var InstallerStep;
(function (InstallerStep) {
    InstallerStep[InstallerStep["DETECTING_MT5"] = 1] = "DETECTING_MT5";
    InstallerStep[InstallerStep["INSTALLING_LIBZMQ"] = 2] = "INSTALLING_LIBZMQ";
    InstallerStep[InstallerStep["INSTALLING_EXPERT_ADVISOR"] = 3] = "INSTALLING_EXPERT_ADVISOR";
    InstallerStep[InstallerStep["CREATING_CONFIG"] = 4] = "CREATING_CONFIG";
    InstallerStep[InstallerStep["AUTO_ATTACHING_EA"] = 5] = "AUTO_ATTACHING_EA";
    InstallerStep[InstallerStep["COMPLETED"] = 6] = "COMPLETED";
    InstallerStep[InstallerStep["FAILED"] = -1] = "FAILED";
})(InstallerStep || (exports.InstallerStep = InstallerStep = {}));
var Architecture;
(function (Architecture) {
    Architecture["X86"] = "x86";
    Architecture["X64"] = "x64";
})(Architecture || (exports.Architecture = Architecture = {}));
var MT5InstallationType;
(function (MT5InstallationType) {
    MT5InstallationType["STANDARD"] = "standard";
    MT5InstallationType["PORTABLE"] = "portable";
    MT5InstallationType["BROKER_SPECIFIC"] = "broker-specific";
    MT5InstallationType["CUSTOM"] = "custom";
})(MT5InstallationType || (exports.MT5InstallationType = MT5InstallationType = {}));
