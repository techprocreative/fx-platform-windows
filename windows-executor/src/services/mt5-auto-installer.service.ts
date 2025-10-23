/**
 * MT5 Auto-Installer Service
 * Main class for automated MT5 component installation
 */

import * as path from "path";
import {
  MT5Info,
  InstallProgress,
  InstallResult,
  InstallerStep,
  EAConfig,
  AutoInstallerConfig,
  FileOperationResult,
  BackupInfo,
} from "../types/mt5.types";
import { MT5DetectorService } from "./mt5-detector.service";
import { FileUtils } from "../utils/file-utils";

// const execAsync = promisify(exec); // Not used, commented out

export class MT5AutoInstaller {
  private progressCallback: (progress: InstallProgress) => void;
  private detector: MT5DetectorService;
  private config: AutoInstallerConfig;

  /**
   * Get resources path for both development and production
   */
  private getResourcesPath(): string {
    // In production (packaged Electron app)
    if ((process as any).resourcesPath) {
      return (process as any).resourcesPath;
    }

    // In development
    return path.join(__dirname, "..", "..", "resources");
  }

  constructor(
    progressCallback?: (progress: InstallProgress) => void,
    config?: Partial<AutoInstallerConfig>,
  ) {
    this.progressCallback = progressCallback || (() => {});
    this.detector = new MT5DetectorService();

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
  async autoInstallEverything(): Promise<InstallResult> {
    const result: InstallResult = {
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
      this.reportProgress(
        InstallerStep.DETECTING_MT5,
        "Detecting MT5 installations...",
        10,
      );
      const installations = await this.detector.detectAllInstallations();

      if (installations.length === 0) {
        throw new Error("MetaTrader 5 not found. Please install MT5 first.");
      }

      result.mt5Installations = installations;
      this.reportProgress(
        InstallerStep.DETECTING_MT5,
        `Found ${installations.length} MT5 installation(s)`,
        20,
      );

      // Step 2: Install to all detected MT5 instances
      let libzmqSuccess = false;
      let eaSuccess = false;
      let configSuccess = false;

      for (let i = 0; i < installations.length; i++) {
        const mt5 = installations[i];
        const progressBase = 20 + (i * 60) / installations.length;

        this.reportProgress(
          InstallerStep.INSTALLING_LIBZMQ,
          `Installing libzmq.dll to: ${mt5.path}`,
          progressBase,
        );

        // Install libzmq.dll
        const libzmqResult = await this.installLibZMQ(mt5);
        if (libzmqResult.success) {
          libzmqSuccess = true;
          if (libzmqResult.backupPath) {
            result.warnings?.push(`Created backup: ${libzmqResult.backupPath}`);
          }
        } else {
          result.errors.push(
            `Failed to install libzmq.dll to ${mt5.path}: ${libzmqResult.error}`,
          );
        }

        this.reportProgress(
          InstallerStep.INSTALLING_EXPERT_ADVISOR,
          `Installing Expert Advisor to: ${mt5.path}`,
          progressBase + 20,
        );

        // Install Expert Advisor
        const eaResult = await this.installExpertAdvisor(mt5);
        if (eaResult.success) {
          eaSuccess = true;
          if (eaResult.backupPath) {
            result.warnings?.push(`Created backup: ${eaResult.backupPath}`);
          }
        } else {
          result.errors.push(
            `Failed to install Expert Advisor to ${mt5.path}: ${eaResult.error}`,
          );
        }

        this.reportProgress(
          InstallerStep.CREATING_CONFIG,
          `Creating configuration file for: ${mt5.path}`,
          progressBase + 40,
        );

        // Create EA configuration file
        const configResult = await this.createEAConfigFile(mt5);
        if (configResult.success) {
          configSuccess = true;
        } else {
          result.errors.push(
            `Failed to create configuration file for ${mt5.path}: ${configResult.error}`,
          );
        }
      }

      result.componentsInstalled.libzmq = libzmqSuccess;
      result.componentsInstalled.expertAdvisor = eaSuccess;
      result.componentsInstalled.configFile = configSuccess;

      // Step 3: Auto-attach EA to chart (if enabled and MT5 is running)
      if (this.config.autoAttachEA && installations[0].isRunning) {
        this.reportProgress(
          InstallerStep.AUTO_ATTACHING_EA,
          "Auto-attaching EA to chart...",
          85,
        );

        const attachResult = await this.autoAttachEAToChart(installations[0]);
        if (!attachResult.success) {
          result.warnings?.push(`Auto-attach failed: ${attachResult.error}`);
        }
      }

      // Step 4: Verify installation
      if (this.config.verifyInstallation) {
        this.reportProgress(
          InstallerStep.COMPLETED,
          "Verifying installation...",
          90,
        );

        const verificationResults =
          await this.verifyInstallation(installations);
        if (!verificationResults.success) {
          result.errors.push(...verificationResults.errors);
        }
      }

      result.success = result.errors.length === 0;

      this.reportProgress(
        result.success ? InstallerStep.COMPLETED : InstallerStep.FAILED,
        result.success
          ? "✓ Installation completed successfully!"
          : "✗ Installation completed with errors",
        100,
      );
    } catch (error) {
      const errorMessage = (error as Error).message;
      result.errors.push(errorMessage);

      this.reportProgress(
        InstallerStep.FAILED,
        `✗ Installation failed: ${errorMessage}`,
        100,
      );
    }

    return result;
  }

  /**
   * Install libzmq.dll to MT5 Libraries folder
   */
  async installLibZMQ(mt5: MT5Info): Promise<FileOperationResult> {
    const result: FileOperationResult = {
      success: false,
      sourcePath: "",
      destinationPath: path.join(mt5.libraryPath, "libzmq.dll"),
    };

    try {
      // Determine architecture (32-bit or 64-bit)
      const is64bit = await FileUtils.pathExists(
        path.join(mt5.path, "terminal64.exe"),
      );
      const libName = is64bit ? "libzmq-x64.dll" : "libzmq-x86.dll";

      // Source path would be from resources in production
      // For now, we'll use a placeholder
      const libzmqSource = path.join(this.getResourcesPath(), "libs", libName);
      result.sourcePath = libzmqSource;

      // Check if source exists (in development, it might not)
      if (!(await FileUtils.pathExists(libzmqSource))) {
        throw new Error(
          `libzmq library not found at ${libzmqSource}. Please ensure resources are available.`,
        );
      }

      // Check if already installed and up to date
      if (
        !this.config.forceUpdate &&
        (await FileUtils.isFileUpToDate(libzmqSource, result.destinationPath))
      ) {
        result.success = true;
        return result;
      }

      // Copy with backup
      const copyResult = await FileUtils.copyWithBackup(
        libzmqSource,
        result.destinationPath,
        this.config.createBackups,
      );

      result.success = copyResult.success;
      result.backupPath = copyResult.backupPath;
      result.error = copyResult.error;

      if (result.success) {
        console.log(`✓ libzmq.dll installed to ${result.destinationPath}`);
      }
    } catch (error) {
      result.error = (error as Error).message;
      console.error("Failed to install libzmq.dll:", error);

      // Check for permission issues
      if (result.error?.includes("EPERM") || result.error?.includes("EACCES")) {
        result.error = "Permission denied. Please run as Administrator.";
      }
    }

    return result;
  }

  /**
   * Install Expert Advisor to MT5 Experts folder
   */
  async installExpertAdvisor(mt5: MT5Info): Promise<FileOperationResult> {
    const result: FileOperationResult = {
      success: false,
      sourcePath: "",
      destinationPath: path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5"),
    };

    try {
      // Source path would be from resources in production
      const eaSource = path.join(
        this.getResourcesPath(),
        "experts",
        "FX_Platform_Bridge.ex5",
      );
      result.sourcePath = eaSource;

      // Check if source exists
      if (!(await FileUtils.pathExists(eaSource))) {
        throw new Error(
          `Expert Advisor not found at ${eaSource}. Please ensure resources are available.`,
        );
      }

      // Check if already installed and up to date
      if (
        !this.config.forceUpdate &&
        (await FileUtils.isFileUpToDate(eaSource, result.destinationPath))
      ) {
        result.success = true;
        return result;
      }

      // Copy with backup
      const copyResult = await FileUtils.copyWithBackup(
        eaSource,
        result.destinationPath,
        this.config.createBackups,
      );

      result.success = copyResult.success;
      result.backupPath = copyResult.backupPath;
      result.error = copyResult.error;

      if (result.success) {
        console.log(`✓ Expert Advisor installed to ${result.destinationPath}`);

        // Also copy source file (.mq5) if available for user reference
        const mq5Source = path.join(
          this.getResourcesPath(),
          "experts",
          "FX_Platform_Bridge.mq5",
        );
        if (await FileUtils.pathExists(mq5Source)) {
          const mq5Dest = path.join(mt5.expertsPath, "FX_Platform_Bridge.mq5");
          await FileUtils.copyWithBackup(mq5Source, mq5Dest, false);
          console.log(`✓ EA source file (.mq5) also copied`);
        }
      }
    } catch (error) {
      result.error = (error as Error).message;
      console.error("Failed to install Expert Advisor:", error);
    }

    return result;
  }

  /**
   * Create EA configuration file
   */
  async createEAConfigFile(mt5: MT5Info): Promise<FileOperationResult> {
    const result: FileOperationResult = {
      success: false,
      sourcePath: "",
      destinationPath: path.join(mt5.expertsPath, "FX_Platform_Bridge.json"),
    };

    try {
      // This would get configuration from app settings
      // For now, we'll use defaults
      const config: EAConfig = {
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
      const writeSuccess = await FileUtils.writeFile(
        result.destinationPath,
        configContent,
      );

      result.success = writeSuccess;

      if (result.success) {
        console.log(
          `✓ Configuration file created at ${result.destinationPath}`,
        );
      }
    } catch (error) {
      result.error = (error as Error).message;
      console.error("Failed to create configuration file:", error);
    }

    return result;
  }

  /**
   * Auto-attach EA to chart (Advanced feature)
   */
  async autoAttachEAToChart(mt5: MT5Info): Promise<FileOperationResult> {
    const result: FileOperationResult = {
      success: false,
      sourcePath: "",
      destinationPath: "",
    };

    try {
      // Create auto-attach script
      const scriptContent = this.generateAutoAttachScript();

      const scriptPath = path.join(
        mt5.dataPath,
        "MQL5",
        "Scripts",
        "AutoAttachEA.mq5",
      );
      result.destinationPath = scriptPath;

      // Ensure Scripts directory exists
      await FileUtils.ensureDirectory(path.dirname(scriptPath));

      // Write script file
      const writeSuccess = await FileUtils.writeFile(scriptPath, scriptContent);
      result.success = writeSuccess;

      if (result.success) {
        console.log("✓ Auto-attach script created");

        // Also create a template file with EA preset
        await this.createEATemplate(mt5);

        // Note: Actual execution would require MT5 terminal automation
        // which is platform-specific and may require additional libraries
        console.log(
          "ℹ EA auto-attach script created. Manual execution may be required.",
        );
      }
    } catch (error) {
      result.error = (error as Error).message;
      console.error("Failed to create auto-attach script:", error);
    }

    return result;
  }

  /**
   * Generate auto-attach script content
   */
  private generateAutoAttachScript(): string {
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
  private async createEATemplate(mt5: MT5Info): Promise<void> {
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

    const templatePath = path.join(
      mt5.dataPath,
      "templates",
      "FX_Platform_Default.tpl",
    );
    await FileUtils.ensureDirectory(path.dirname(templatePath));
    await FileUtils.writeFile(templatePath, templateContent);
  }

  /**
   * Verify installation was successful
   */
  async verifyInstallation(installations: MT5Info[]): Promise<InstallResult> {
    const result: InstallResult = {
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
      if (await FileUtils.pathExists(libzmqPath)) {
        result.componentsInstalled.libzmq = true;
      } else {
        result.errors.push(`libzmq.dll not found in ${mt5.libraryPath}`);
      }

      // Check Expert Advisor
      const eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5");
      if (await FileUtils.pathExists(eaPath)) {
        result.componentsInstalled.expertAdvisor = true;
      } else {
        result.errors.push(`Expert Advisor not found in ${mt5.expertsPath}`);
      }

      // Check configuration file
      const configPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.json");
      if (await FileUtils.pathExists(configPath)) {
        result.componentsInstalled.configFile = true;
      } else {
        result.errors.push(
          `Configuration file not found in ${mt5.expertsPath}`,
        );
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Report progress to callback
   */
  private reportProgress(
    step: InstallerStep,
    message: string,
    percentage?: number,
  ): void {
    this.progressCallback({
      step,
      message,
      percentage,
      currentOperation: InstallerStep[step],
    });
  }

  /**
   * Get installation status for a specific MT5 installation
   */
  async getInstallationStatus(mt5: MT5Info): Promise<{
    libzmqInstalled: boolean;
    eaInstalled: boolean;
    configExists: boolean;
  }> {
    const libzmqPath = path.join(mt5.libraryPath, "libzmq.dll");
    const eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5");
    const configPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.json");

    return {
      libzmqInstalled: await FileUtils.pathExists(libzmqPath),
      eaInstalled: await FileUtils.pathExists(eaPath),
      configExists: await FileUtils.pathExists(configPath),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoInstallerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoInstallerConfig {
    return { ...this.config };
  }

  /**
   * Check if administrator privileges are required
   */
  async checkAdminRequirements(): Promise<boolean> {
    try {
      // Check if we can write to Program Files
      const testPath = process.env.ProgramFiles || "C:\\Program Files";
      return !(await FileUtils.checkWritePermissions(testPath));
    } catch (error) {
      return true; // Assume admin is required if we can't check
    }
  }

  /**
   * Create backup of existing installations
   */
  async createBackup(installations: MT5Info[]): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];

    for (const mt5 of installations) {
      try {
        // Backup libzmq.dll
        const libzmqPath = path.join(mt5.libraryPath, "libzmq.dll");
        if (await FileUtils.pathExists(libzmqPath)) {
          const backupPath = await FileUtils.createBackup(libzmqPath);
          const fileHash = await FileUtils.calculateFileHash(libzmqPath);

          backups.push({
            originalPath: libzmqPath,
            backupPath,
            hash: fileHash.hash,
            timestamp: new Date(),
          });
        }

        // Backup Expert Advisor
        const eaPath = path.join(mt5.expertsPath, "FX_Platform_Bridge.ex5");
        if (await FileUtils.pathExists(eaPath)) {
          const backupPath = await FileUtils.createBackup(eaPath);
          const fileHash = await FileUtils.calculateFileHash(eaPath);

          backups.push({
            originalPath: eaPath,
            backupPath,
            hash: fileHash.hash,
            timestamp: new Date(),
          });
        }

        // Backup configuration file
        const configPath = path.join(
          mt5.expertsPath,
          "FX_Platform_Bridge.json",
        );
        if (await FileUtils.pathExists(configPath)) {
          const backupPath = await FileUtils.createBackup(configPath);
          const fileHash = await FileUtils.calculateFileHash(configPath);

          backups.push({
            originalPath: configPath,
            backupPath,
            hash: fileHash.hash,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error(`Failed to create backup for ${mt5.path}:`, error);
      }
    }

    return backups;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backups: BackupInfo[]): Promise<boolean> {
    try {
      for (const backup of backups) {
        if (await FileUtils.pathExists(backup.backupPath)) {
          await FileUtils.copy(backup.backupPath, backup.originalPath);
          console.log(`Restored ${backup.originalPath} from backup`);
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to restore from backup:", error);
      return false;
    }
  }
}
