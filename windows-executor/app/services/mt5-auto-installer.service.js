"use strict";
/**
 * MT5 Auto-Installer Service
 * Main class for automated MT5 component installation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MT5AutoInstaller = void 0;
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const mt5_types_1 = require("../types/mt5.types");
const mt5_detector_service_1 = require("./mt5-detector.service");
const file_utils_1 = require("../utils/file-utils");
// const execAsync = promisify(exec); // Not used, commented out
class MT5AutoInstaller {
    /**
     * Get resources path for both development and production
     * Works correctly in both asar and unpacked scenarios
     */
    getResourcesPath() {
        // Check if running from asar or not
        const isAsar = __dirname.includes('app.asar');
        console.log('[MT5AutoInstaller] __dirname:', __dirname);
        console.log('[MT5AutoInstaller] isAsar:', isAsar);
        if (isAsar) {
            // In production (packaged as asar)
            // __dirname = /path/to/app.asar/dist/electron/src/services
            // We need: /path/to/resources (sibling of app.asar)
            // Go up to app.asar root
            const asarPath = __dirname.split('app.asar')[0] + 'app.asar';
            // Get parent directory (resources folder)
            const resourcesPath = path.dirname(asarPath);
            console.log('[MT5AutoInstaller] Resources path (asar):', resourcesPath);
            return resourcesPath;
        }
        else if (process.env.NODE_ENV === 'production' && __dirname.includes('app.asar.unpacked')) {
            // Unpacked production
            // __dirname = /path/to/resources/app.asar.unpacked/dist/electron/src/services
            const unpackedBase = __dirname.split('app.asar.unpacked')[0];
            const resourcesPath = unpackedBase.replace(/\/+$/, ''); // Remove trailing slashes
            console.log('[MT5AutoInstaller] Resources path (unpacked):', resourcesPath);
            return resourcesPath;
        }
        else {
            // Development mode
            // __dirname = /project-root/dist/electron/src/services
            // We need: /project-root/resources
            const resourcesPath = path.join(__dirname, '..', '..', '..', '..', 'resources');
            console.log('[MT5AutoInstaller] Resources path (dev):', resourcesPath);
            return resourcesPath;
        }
    }
    constructor(progressCallback, config) {
        this.progressCallback = progressCallback || (() => { });
        this.detector = new mt5_detector_service_1.MT5DetectorService();
        // Default configuration
        this.config = {
            forceUpdate: false,
            createBackups: true,
            verifyInstallation: true,
            autoAttachEA: false,
            defaultSymbol: "EURUSD",
            defaultTimeframe: "H1",
            ...config,
        };
    }
    /**
     * MAIN AUTO-INSTALLATION FUNCTION
     * Detects MT5, installs libzmq.dll AND Expert Advisor automatically
     */
    async autoInstallEverything() {
        const result = {
            success: false,
            mt5Installations: [],
            componentsInstalled: {
                libzmq: false,
                expertAdvisor: false,
                configFile: false,
            },
            errors: [],
            warnings: [],
        };
        try {
            // Step 1: Detect MT5 installations
            this.reportProgress(mt5_types_1.InstallerStep.DETECTING_MT5, "Detecting MT5 installations...", 10);
            const installations = await this.detector.detectAllInstallations();
            if (installations.length === 0) {
                throw new Error("MetaTrader 5 not found. Please install MT5 first.");
            }
            result.mt5Installations = installations;
            this.reportProgress(mt5_types_1.InstallerStep.DETECTING_MT5, `Found ${installations.length} MT5 installation(s)`, 20);
            // Step 2: Install to all detected MT5 instances
            let libzmqSuccess = false;
            let eaSuccess = false;
            let configSuccess = false;
            for (let i = 0; i < installations.length; i++) {
                const mt5 = installations[i];
                const progressBase = 20 + (i * 60) / installations.length;
                this.reportProgress(mt5_types_1.InstallerStep.INSTALLING_LIBZMQ, `Installing libzmq.dll to: ${mt5.path}`, progressBase);
                // Install libzmq.dll
                const libzmqResult = await this.installLibZMQ(mt5);
                if (libzmqResult.success) {
                    libzmqSuccess = true;
                    if (libzmqResult.backupPath) {
                        result.warnings?.push(`Created backup: ${libzmqResult.backupPath}`);
                    }
                }
                else {
                    result.errors.push(`Failed to install libzmq.dll to ${mt5.path}: ${libzmqResult.error}`);
                }
                this.reportProgress(mt5_types_1.InstallerStep.INSTALLING_EXPERT_ADVISOR, `Installing Expert Advisor to: ${mt5.path}`, progressBase + 20);
                // Install Expert Advisor
                const eaResult = await this.installExpertAdvisor(mt5);
                if (eaResult.success) {
                    eaSuccess = true;
                    if (eaResult.backupPath) {
                        result.warnings?.push(`Created backup: ${eaResult.backupPath}`);
                    }
                }
                else {
                    result.errors.push(`Failed to install Expert Advisor to ${mt5.path}: ${eaResult.error}`);
                }
                this.reportProgress(mt5_types_1.InstallerStep.CREATING_CONFIG, `Creating configuration file for: ${mt5.path}`, progressBase + 40);
                // Create EA configuration file
                const configResult = await this.createEAConfigFile(mt5);
                if (configResult.success) {
                    configSuccess = true;
                }
                else {
                    result.errors.push(`Failed to create configuration file for ${mt5.path}: ${configResult.error}`);
                }
            }
            result.componentsInstalled.libzmq = libzmqSuccess;
            result.componentsInstalled.expertAdvisor = eaSuccess;
            result.componentsInstalled.configFile = configSuccess;
            // Step 3: Auto-attach EA to chart (if enabled and MT5 is running)
            if (this.config.autoAttachEA && installations[0].isRunning) {
                this.reportProgress(mt5_types_1.InstallerStep.AUTO_ATTACHING_EA, "Auto-attaching EA to chart...", 85);
                const attachResult = await this.autoAttachEAToChart(installations[0]);
                if (!attachResult.success) {
                    result.warnings?.push(`Auto-attach failed: ${attachResult.error}`);
                }
            }
            // Step 4: Verify installation
            if (this.config.verifyInstallation) {
                this.reportProgress(mt5_types_1.InstallerStep.COMPLETED, "Verifying installation...", 90);
                const verificationResults = await this.verifyInstallation(installations);
                if (!verificationResults.success) {
                    result.errors.push(...verificationResults.errors);
                }
            }
            result.success = result.errors.length === 0;
            this.reportProgress(result.success ? mt5_types_1.InstallerStep.COMPLETED : mt5_types_1.InstallerStep.FAILED, result.success
                ? "✓ Installation completed successfully!"
                : "✗ Installation completed with errors", 100);
        }
        catch (error) {
            const errorMessage = error.message;
            result.errors.push(errorMessage);
            this.reportProgress(mt5_types_1.InstallerStep.FAILED, `✗ Installation failed: ${errorMessage}`, 100);
        }
        return result;
    }
    /**
     * Install libzmq.dll to MT5 Libraries folder
     */
    async installLibZMQ(mt5) {
        const result = {
            success: false,
            sourcePath: "",
            destinationPath: path.join(mt5.libraryPath, "libzmq.dll"),
        };
        try {
            // Determine architecture (32-bit or 64-bit)
            // Use libzmq.dll from DWX (works for both 32-bit and 64-bit)
            const libName = "libzmq.dll";
            // Source path would be from resources in production
            const resourcesPath = this.getResourcesPath();
            const libzmqSource = path.join(resourcesPath, "libs", libName);
            const libsodiumSource = path.join(resourcesPath, "libs", "libsodium.dll");
            result.sourcePath = libzmqSource;
            console.log('[MT5AutoInstaller] Installing libzmq...');
            console.log('[MT5AutoInstaller] - Resources path:', resourcesPath);
            console.log('[MT5AutoInstaller] - Looking for:', libzmqSource);
            console.log('[MT5AutoInstaller] - Target MT5:', mt5.path);
            // Check if source exists (in development, it might not)
            const sourceExists = await file_utils_1.FileUtils.pathExists(libzmqSource);
            console.log('[MT5AutoInstaller] - Source exists:', sourceExists);
            if (!sourceExists) {
                throw new Error(`libzmq library not found at ${libzmqSource}. Please ensure resources are available.`);
            }
            const verified = await this.verifyLibzmqCompatibility(libzmqSource);
            if (!verified) {
                throw new Error("libzmq.dll failed compatibility verification. Run npm run fix:libzmq before installing.");
            }
            // Check if already installed and up to date
            if (!this.config.forceUpdate &&
                (await file_utils_1.FileUtils.isFileUpToDate(libzmqSource, result.destinationPath))) {
                result.success = true;
                return result;
            }
            // Copy libzmq.dll with backup
            const copyResult = await file_utils_1.FileUtils.copyWithBackup(libzmqSource, result.destinationPath, this.config.createBackups);
            result.success = copyResult.success;
            result.backupPath = copyResult.backupPath;
            result.error = copyResult.error;
            if (result.success) {
                console.log(`✓ libzmq.dll installed to ${result.destinationPath}`);
                // Also copy libsodium.dll (dependency for libzmq from DWX)
                const libsodiumDest = path.join(path.dirname(result.destinationPath), "libsodium.dll");
                const libsodiumExists = await file_utils_1.FileUtils.pathExists(libsodiumSource);
                if (libsodiumExists) {
                    console.log('[MT5AutoInstaller] Installing libsodium.dll...');
                    const sodiumResult = await file_utils_1.FileUtils.copyWithBackup(libsodiumSource, libsodiumDest, this.config.createBackups);
                    if (sodiumResult.success) {
                        console.log(`✓ libsodium.dll installed to ${libsodiumDest}`);
                    }
                    else {
                        console.warn(`⚠ Failed to install libsodium.dll: ${sodiumResult.error}`);
                    }
                }
            }
        }
        catch (error) {
            result.error = error.message;
            console.error("Failed to install libzmq.dll:", error);
            // Check for permission issues
            if (result.error?.includes("EPERM") || result.error?.includes("EACCES")) {
                result.error = "Permission denied. Please run as Administrator.";
            }
        }
        return result;
    }
    async verifyLibzmqCompatibility(dllPath) {
        try {
            console.log('[MT5AutoInstaller] Verifying libzmq.dll compatibility...');
            console.log('[MT5AutoInstaller] DLL path:', dllPath);
            // Use the enhanced verification script
            const scriptCandidates = [
                path.join(process.cwd(), "scripts", "verify-libzmq-enhanced.js"),
                path.join(this.getResourcesPath(), "..", "scripts", "verify-libzmq-enhanced.js"),
                path.join(process.cwd(), "verify-libzmq-dll.js"), // Fallback
                path.join(this.getResourcesPath(), "..", "verify-libzmq-dll.js"), // Fallback
            ];
            let scriptFound = false;
            for (const candidate of scriptCandidates) {
                if (await file_utils_1.FileUtils.pathExists(candidate)) {
                    console.log('[MT5AutoInstaller] Using verification script:', candidate);
                    scriptFound = true;
                    try {
                        const result = (0, child_process_1.execSync)(`node "${candidate}" --dll "${dllPath}"`, {
                            encoding: 'utf8',
                            stdio: 'pipe',
                            cwd: path.dirname(candidate),
                        });
                        // Check if verification passed
                        const passed = result.includes('VERIFICATION PASSED');
                        if (passed) {
                            console.log('[MT5AutoInstaller] ✅ DLL verification PASSED');
                            return true;
                        }
                        else {
                            console.error('[MT5AutoInstaller] ❌ DLL verification FAILED');
                            console.error('[MT5AutoInstaller] Verification output:', result);
                            return false;
                        }
                    }
                    catch (execError) {
                        console.error('[MT5AutoInstaller] Verification script execution failed:', execError.message);
                        return false;
                    }
                }
            }
            if (!scriptFound) {
                console.warn("[MT5AutoInstaller] verify-libzmq-enhanced.js not found. Skipping DLL export verification.");
                console.warn("[MT5AutoInstaller] ⚠️  WARNING: Cannot verify DLL compatibility - proceeding anyway");
                return true; // Don't block installation if verification script missing
            }
            return false;
        }
        catch (error) {
            console.error("[MT5AutoInstaller] libzmq.dll verification failed:", error.message);
            return false;
        }
    }
    /**
     * Install Expert Advisor to MT5 Experts folder
     */
    async installExpertAdvisor(mt5) {
        const result = {
            success: false,
            sourcePath: "",
            destinationPath: path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5"),
        };
        try {
            // Source path would be from resources in production
            const resourcesPath = this.getResourcesPath();
            // Try to find compiled .ex5 first, fallback to .mq5 source
            let eaSource = path.join(resourcesPath, "experts", "FX_Platform_Bridge.ex5");
            console.log('[MT5AutoInstaller] Installing Expert Advisor...');
            console.log('[MT5AutoInstaller] - Trying compiled version:', eaSource);
            let sourceExists = await file_utils_1.FileUtils.pathExists(eaSource);
            console.log('[MT5AutoInstaller] - Compiled .ex5 exists:', sourceExists);
            // If .ex5 not found, try .mq5 source file
            if (!sourceExists) {
                eaSource = path.join(resourcesPath, "experts", "FX_Platform_Bridge.mq5");
                console.log('[MT5AutoInstaller] - Trying source version:', eaSource);
                sourceExists = await file_utils_1.FileUtils.pathExists(eaSource);
                console.log('[MT5AutoInstaller] - Source .mq5 exists:', sourceExists);
                // Update destination to .mq5 if using source
                result.destinationPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.mq5");
            }
            result.sourcePath = eaSource;
            if (!sourceExists) {
                throw new Error(`Expert Advisor not found at ${eaSource}. Please ensure resources are available.`);
            }
            // Check if already installed and up to date
            if (!this.config.forceUpdate &&
                (await file_utils_1.FileUtils.isFileUpToDate(eaSource, result.destinationPath))) {
                result.success = true;
                return result;
            }
            // Copy with backup
            const copyResult = await file_utils_1.FileUtils.copyWithBackup(eaSource, result.destinationPath, this.config.createBackups);
            result.success = copyResult.success;
            result.backupPath = copyResult.backupPath;
            result.error = copyResult.error;
            if (result.success) {
                console.log(`✓ Expert Advisor installed to ${result.destinationPath}`);
                // If we installed .ex5, also copy source file (.mq5) if available for user reference
                if (result.destinationPath.endsWith('.ex5')) {
                    const mq5Source = path.join(this.getResourcesPath(), "experts", "FX_Platform_Bridge.mq5");
                    if (await file_utils_1.FileUtils.pathExists(mq5Source)) {
                        const mq5Dest = path.join(mt5.expertsPath, "FX_Platform_Bridge.mq5");
                        await file_utils_1.FileUtils.copyWithBackup(mq5Source, mq5Dest, false);
                        console.log(`✓ EA source file (.mq5) also copied for reference`);
                    }
                }
                else {
                    console.log(`ℹ Source file (.mq5) installed - user needs to compile in MT5 to create .ex5`);
                }
            }
        }
        catch (error) {
            result.error = error.message;
            console.error("Failed to install Expert Advisor:", error);
        }
        return result;
    }
    /**
     * Create EA configuration file
     */
    async createEAConfigFile(mt5) {
        const result = {
            success: false,
            sourcePath: "",
            destinationPath: path.join(mt5.expertsPath, "FX_Platform_Bridge.json"),
        };
        try {
            // This would get configuration from app settings
            // For now, we'll use defaults
            const config = {
                executorId: "default-executor-id", // Would come from app config
                apiKey: "default-api-key", // Would come from app config
                zmqPort: 5555,
                zmqHost: "tcp://localhost",
                autoReconnect: true,
                heartbeatInterval: 60,
                logLevel: "INFO",
            };
            const configContent = JSON.stringify(config, null, 2);
            // Write configuration file
            const writeSuccess = await file_utils_1.FileUtils.writeFile(result.destinationPath, configContent);
            result.success = writeSuccess;
            if (result.success) {
                console.log(`✓ Configuration file created at ${result.destinationPath}`);
            }
        }
        catch (error) {
            result.error = error.message;
            console.error("Failed to create configuration file:", error);
        }
        return result;
    }
    /**
     * Auto-attach EA to chart (Advanced feature)
     */
    async autoAttachEAToChart(mt5) {
        const result = {
            success: false,
            sourcePath: "",
            destinationPath: "",
        };
        try {
            // Create auto-attach script
            const scriptContent = this.generateAutoAttachScript();
            const scriptPath = path.join(mt5.dataPath, "MQL5", "Scripts", "AutoAttachEA.mq5");
            result.destinationPath = scriptPath;
            // Ensure Scripts directory exists
            await file_utils_1.FileUtils.ensureDirectory(path.dirname(scriptPath));
            // Write script file
            const writeSuccess = await file_utils_1.FileUtils.writeFile(scriptPath, scriptContent);
            result.success = writeSuccess;
            if (result.success) {
                console.log("✓ Auto-attach script created");
                // Also create a template file with EA preset
                await this.createEATemplate(mt5);
                // Note: Actual execution would require MT5 terminal automation
                // which is platform-specific and may require additional libraries
                console.log("ℹ EA auto-attach script created. Manual execution may be required.");
            }
        }
        catch (error) {
            result.error = error.message;
            console.error("Failed to create auto-attach script:", error);
        }
        return result;
    }
    /**
     * Generate auto-attach script content
     */
    generateAutoAttachScript() {
        return `
//+------------------------------------------------------------------+
//| Auto-attach script for FX Platform Bridge EA                     |
//+------------------------------------------------------------------+
void OnStart()
{
   // Find ${this.config.defaultSymbol} chart or create one
   long chartId = ChartFirst();
   bool found = false;

   while(chartId >= 0)
   {
      if(ChartSymbol(chartId) == "${this.config.defaultSymbol}")
      {
         found = true;
         break;
      }
      chartId = ChartNext(chartId);
   }

   // If not found, create new chart
   if(!found)
   {
      chartId = ChartOpen("${this.config.defaultSymbol}", PERIOD_${this.config.defaultTimeframe});
   }

   // Attach EA to chart
   if(chartId > 0)
   {
      ChartSetInteger(chartId, CHART_BRING_TO_TOP, true);

      // The EA needs to be attached manually or via terminal automation
      Print("Chart ready for EA attachment");

      // Alternative: Use ChartApplyTemplate to apply a template with EA
      string templatePath = TerminalInfoString(TERMINAL_DATA_PATH) +
                           "\\\\templates\\\\FX_Platform_Default.tpl";
      if(ChartApplyTemplate(chartId, templatePath))
      {
         Print("EA attached successfully via template");
      }
   }
}
`;
    }
    /**
     * Create MT5 template with EA preset
     */
    async createEATemplate(mt5) {
        const templateContent = `
<chart>
  chart_type=1
  scale=4
  graph=1
  fore=0
  grid=1
  volume=0
  scroll=1
  shift=1
  ohlc=0
  </chart>

<expert>
  name=FX_Platform_Bridge
  flags=279
  window_num=0
  </expert>
`;
        const templatePath = path.join(mt5.dataPath, "templates", "FX_Platform_Default.tpl");
        await file_utils_1.FileUtils.ensureDirectory(path.dirname(templatePath));
        await file_utils_1.FileUtils.writeFile(templatePath, templateContent);
    }
    /**
     * Verify installation was successful
     */
    async verifyInstallation(installations) {
        const result = {
            success: true,
            mt5Installations: installations,
            componentsInstalled: {
                libzmq: false,
                expertAdvisor: false,
                configFile: false,
            },
            errors: [],
        };
        for (const mt5 of installations) {
            // Check libzmq.dll
            const libzmqPath = path.join(mt5.libraryPath, "libzmq.dll");
            if (await file_utils_1.FileUtils.pathExists(libzmqPath)) {
                result.componentsInstalled.libzmq = true;
            }
            else {
                result.errors.push(`libzmq.dll not found in ${mt5.libraryPath}`);
            }
            // Check Expert Advisor (.ex5 or .mq5)
            let eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5");
            let eaExists = await file_utils_1.FileUtils.pathExists(eaPath);
            if (!eaExists) {
                eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.mq5");
                eaExists = await file_utils_1.FileUtils.pathExists(eaPath);
            }
            if (eaExists) {
                result.componentsInstalled.expertAdvisor = true;
            }
            else {
                result.errors.push(`Expert Advisor not found in ${mt5.expertsPath} (neither .ex5 nor .mq5)`);
            }
            // Check configuration file
            const configPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.json");
            if (await file_utils_1.FileUtils.pathExists(configPath)) {
                result.componentsInstalled.configFile = true;
            }
            else {
                result.errors.push(`Configuration file not found in ${mt5.expertsPath}`);
            }
        }
        result.success = result.errors.length === 0;
        return result;
    }
    /**
     * Report progress to callback
     */
    reportProgress(step, message, percentage) {
        this.progressCallback({
            step,
            message,
            percentage,
            currentOperation: mt5_types_1.InstallerStep[step],
        });
    }
    /**
     * Get installation status for a specific MT5 installation
     */
    async getInstallationStatus(mt5) {
        const libzmqPath = path.join(mt5.libraryPath, "libzmq.dll");
        // Check for EA (.ex5 compiled or .mq5 source)
        let eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5");
        let eaExists = await file_utils_1.FileUtils.pathExists(eaPath);
        if (!eaExists) {
            eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.mq5");
            eaExists = await file_utils_1.FileUtils.pathExists(eaPath);
        }
        const configPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.json");
        return {
            libzmqInstalled: await file_utils_1.FileUtils.pathExists(libzmqPath),
            eaInstalled: eaExists,
            configExists: await file_utils_1.FileUtils.pathExists(configPath),
        };
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Check if administrator privileges are required
     */
    async checkAdminRequirements() {
        try {
            // Check if we can write to Program Files
            const testPath = process.env.ProgramFiles || "C:\\Program Files";
            return !(await file_utils_1.FileUtils.checkWritePermissions(testPath));
        }
        catch (error) {
            return true; // Assume admin is required if we can't check
        }
    }
    /**
     * Create backup of existing installations
     */
    async createBackup(installations) {
        const backups = [];
        for (const mt5 of installations) {
            try {
                // Backup libzmq.dll
                const libzmqPath = path.join(mt5.libraryPath, "libzmq.dll");
                if (await file_utils_1.FileUtils.pathExists(libzmqPath)) {
                    const backupPath = await file_utils_1.FileUtils.createBackup(libzmqPath);
                    const fileHash = await file_utils_1.FileUtils.calculateFileHash(libzmqPath);
                    backups.push({
                        originalPath: libzmqPath,
                        backupPath,
                        hash: fileHash.hash,
                        timestamp: new Date(),
                    });
                }
                // Backup Expert Advisor
                // Check for EA (.ex5 or .mq5)
                let eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5");
                if (!(await file_utils_1.FileUtils.pathExists(eaPath))) {
                    eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.mq5");
                }
                if (await file_utils_1.FileUtils.pathExists(eaPath)) {
                    const backupPath = await file_utils_1.FileUtils.createBackup(eaPath);
                    const fileHash = await file_utils_1.FileUtils.calculateFileHash(eaPath);
                    backups.push({
                        originalPath: eaPath,
                        backupPath,
                        hash: fileHash.hash,
                        timestamp: new Date(),
                    });
                }
                // Backup configuration file
                const configPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.json");
                if (await file_utils_1.FileUtils.pathExists(configPath)) {
                    const backupPath = await file_utils_1.FileUtils.createBackup(configPath);
                    const fileHash = await file_utils_1.FileUtils.calculateFileHash(configPath);
                    backups.push({
                        originalPath: configPath,
                        backupPath,
                        hash: fileHash.hash,
                        timestamp: new Date(),
                    });
                }
            }
            catch (error) {
                console.error(`Failed to create backup for ${mt5.path}:`, error);
            }
        }
        return backups;
    }
    /**
     * Restore from backup
     */
    async restoreFromBackup(backups) {
        try {
            for (const backup of backups) {
                if (await file_utils_1.FileUtils.pathExists(backup.backupPath)) {
                    await file_utils_1.FileUtils.copy(backup.backupPath, backup.originalPath);
                    console.log(`Restored ${backup.originalPath} from backup`);
                }
            }
            return true;
        }
        catch (error) {
            console.error("Failed to restore from backup:", error);
            return false;
        }
    }
}
exports.MT5AutoInstaller = MT5AutoInstaller;
