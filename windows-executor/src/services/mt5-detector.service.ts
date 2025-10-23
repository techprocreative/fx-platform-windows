/**
 * MT5 Detection Service
 * Detects all MT5 installations on the system including standard, portable, and broker-specific installations
 */

import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  MT5Info,
  RegistryEntry,
  MT5ProcessInfo,
  MT5InstallationType,
  Architecture
} from '../types/mt5.types';
import { FileUtils } from '../utils/file-utils';

const execAsync = promisify(exec);

export class MT5DetectorService {
  /**
   * Detect all MT5 installations on the system
   */
  async detectAllInstallations(): Promise<MT5Info[]> {
    const installations: MT5Info[] = [];
    
    try {
      // 1. Check standard installation paths
      const standardPaths = this.getStandardInstallationPaths();
      for (const basePath of standardPaths) {
        const installation = await this.checkInstallationPath(basePath, MT5InstallationType.STANDARD);
        if (installation) {
          installations.push(installation);
        }
      }

      // 2. Check registry for broker-specific installations
      const registryPaths = await this.getRegistryMT5Paths();
      for (const regPath of registryPaths) {
        const installation = await this.checkInstallationPath(regPath, MT5InstallationType.BROKER_SPECIFIC);
        if (installation) {
          installations.push(installation);
        }
      }

      // 3. Check AppData for portable installations
      const portablePaths = await this.getPortableInstallationPaths();
      for (const portablePath of portablePaths) {
        const installation = await this.checkInstallationPath(portablePath, MT5InstallationType.PORTABLE);
        if (installation) {
          installations.push(installation);
        }
      }

      // 4. Check running processes for additional installations
      const runningProcesses = await this.getRunningMT5Processes();
      for (const process of runningProcesses) {
        const installation = await this.checkInstallationPath(process.path, MT5InstallationType.CUSTOM);
        if (installation) {
          installations.push(installation);
        }
      }

      // Remove duplicates and return
      return this.deduplicateInstallations(installations);
      
    } catch (error) {
      console.error('Error detecting MT5 installations:', error);
      return [];
    }
  }

  /**
   * Get standard MT5 installation paths
   */
  private getStandardInstallationPaths(): string[] {
    const paths: string[] = [];
    
    // Program Files
    if (process.env.ProgramFiles) {
      paths.push(path.join(process.env.ProgramFiles, 'MetaTrader 5'));
    }
    
    // Program Files (x86)
    if (process.env['ProgramFiles(x86)']) {
      paths.push(path.join(process.env['ProgramFiles(x86)'], 'MetaTrader 5'));
    }
    
    // Local AppData
    if (process.env.LOCALAPPDATA) {
      paths.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'MetaTrader 5'));
    }
    
    // Common paths for different brokers
    const brokerPaths = [
      'C:\\MetaTrader 5',
      'C:\\MT5',
      'C:\\Trading\\MetaTrader 5',
    ];
    
    paths.push(...brokerPaths);
    
    return paths;
  }

  /**
   * Get MT5 installation paths from Windows Registry
   */
  private async getRegistryMT5Paths(): Promise<string[]> {
    const paths: string[] = [];
    
    try {
      if (process.platform !== 'win32') {
        return paths;
      }

      // Use PowerShell to read registry more reliably
      const psCommand = `
        Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
        Where-Object { $_.DisplayName -like "*MetaTrader 5*" -or $_.DisplayName -like "*MT5*" } |
        Select-Object -ExpandProperty InstallLocation
      `;
      
      const { stdout } = await execAsync(`powershell -Command "${psCommand}"`, {
        timeout: 10000,
      });
      
      const installLocations = stdout.trim().split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      paths.push(...installLocations);

      // Also check Wow6432Node for 32-bit applications on 64-bit Windows
      const psCommand32 = `
        Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" |
        Where-Object { $_.DisplayName -like "*MetaTrader 5*" -or $_.DisplayName -like "*MT5*" } |
        Select-Object -ExpandProperty InstallLocation
      `;
      
      const { stdout: stdout32 } = await execAsync(`powershell -Command "${psCommand32}"`, {
        timeout: 10000,
      });
      
      const installLocations32 = stdout32.trim().split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      paths.push(...installLocations32);

    } catch (error) {
      console.warn('Could not read registry for MT5 paths:', error);
    }

    return paths.filter(path => path && path.length > 0);
  }

  /**
   * Get portable installation paths from AppData
   */
  private async getPortableInstallationPaths(): Promise<string[]> {
    const paths: string[] = [];
    
    try {
      const appDataPath = process.env.APPDATA || '';
      const terminalPath = path.join(appDataPath, 'MetaQuotes', 'Terminal');
      
      if (await FileUtils.pathExists(terminalPath)) {
        const terminals = await FileUtils.listFiles(terminalPath);
        
        for (const terminal of terminals) {
          const terminalDataPath = path.join(terminalPath, terminal);
          const originPath = path.join(terminalDataPath, 'origin.txt');
          
          if (await FileUtils.pathExists(originPath)) {
            try {
              const origin = await FileUtils.readFile(originPath);
              const originPathTrimmed = origin.trim();
              
              if (originPathTrimmed && await FileUtils.pathExists(originPathTrimmed)) {
                paths.push(originPathTrimmed);
              }
            } catch (error) {
              console.warn(`Could not read origin file for ${terminal}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not detect portable MT5 installations:', error);
    }

    return paths;
  }

  /**
   * Get running MT5 processes
   */
  private async getRunningMT5Processes(): Promise<MT5ProcessInfo[]> {
    const processes: MT5ProcessInfo[] = [];
    
    try {
      const runningProcesses = await FileUtils.getRunningProcesses('terminal');
      
      for (const proc of runningProcesses) {
        if (proc.name.includes('terminal') && proc.path) {
          const processInfo: MT5ProcessInfo = {
            pid: proc.pid,
            path: proc.path,
            isPortable: proc.path.includes('AppData') || proc.path.includes('portable'),
          };
          
          processes.push(processInfo);
        }
      }
    } catch (error) {
      console.warn('Could not detect running MT5 processes:', error);
    }

    return processes;
  }

  /**
   * Check if a path contains a valid MT5 installation
   */
  private async checkInstallationPath(
    basePath: string, 
    installationType: MT5InstallationType
  ): Promise<MT5Info | null> {
    try {
      if (!await FileUtils.pathExists(basePath)) {
        return null;
      }

      // Check for MT5 executables
      const terminal64 = path.join(basePath, 'terminal64.exe');
      const terminal32 = path.join(basePath, 'terminal.exe');
      
      let terminalPath = '';
      let is64Bit = false;
      
      if (await FileUtils.pathExists(terminal64)) {
        terminalPath = terminal64;
        is64Bit = true;
      } else if (await FileUtils.pathExists(terminal32)) {
        terminalPath = terminal32;
        is64Bit = false;
      } else {
        return null; // Not a valid MT5 installation
      }

      // Get MT5 information
      const mt5Info = await this.getMT5Info(basePath, terminalPath, is64Bit, installationType);
      
      return mt5Info;
      
    } catch (error) {
      console.warn(`Error checking MT5 installation at ${basePath}:`, error);
      return null;
    }
  }

  /**
   * Get detailed MT5 information
   */
  private async getMT5Info(
    basePath: string,
    terminalPath: string,
    is64Bit: boolean,
    installationType: MT5InstallationType
  ): Promise<MT5Info> {
    // Get version information
    const version = await FileUtils.getFileVersion(terminalPath);
    const productVersion = await FileUtils.getProductVersion(terminalPath);
    
    // Extract build number from version
    const build = this.extractBuildNumber(version) || this.extractBuildNumber(productVersion) || 0;

    // Determine data path (where MQL5 folder is)
    const dataPath = await this.determineDataPath(basePath, installationType);
    
    const libraryPath = path.join(dataPath, 'MQL5', 'Libraries');
    const expertsPath = path.join(dataPath, 'MQL5', 'Experts');

    // Ensure directories exist
    await FileUtils.ensureDirectory(libraryPath);
    await FileUtils.ensureDirectory(expertsPath);

    // Check if MT5 is currently running
    const isRunning = await FileUtils.isProcessRunning(is64Bit ? 'terminal64.exe' : 'terminal.exe');

    // Try to detect broker and account information
    const broker = await this.detectBroker(dataPath);
    const accountNumber = await this.detectAccountNumber(dataPath);

    return {
      path: basePath,
      dataPath,
      version: version || productVersion || 'Unknown',
      build,
      libraryPath,
      expertsPath,
      isRunning,
      broker,
      accountNumber,
    };
  }

  /**
   * Determine the data path for MT5 installation
   */
  private async determineDataPath(basePath: string, installationType: MT5InstallationType): Promise<string> {
    // For portable installations, data is in the same directory
    if (installationType === MT5InstallationType.PORTABLE) {
      return basePath;
    }

    // For standard installations, check if data is in AppData
    const appDataPath = process.env.APPDATA || '';
    const terminalDataPath = path.join(appDataPath, 'MetaQuotes', 'Terminal');
    
    if (await FileUtils.pathExists(terminalDataPath)) {
      try {
        const terminals = await FileUtils.listFiles(terminalDataPath);
        
        for (const terminal of terminals) {
          const terminalDir = path.join(terminalDataPath, terminal);
          const originPath = path.join(terminalDir, 'origin.txt');
          
          if (await FileUtils.pathExists(originPath)) {
            try {
              const origin = await FileUtils.readFile(originPath);
              if (origin.trim() === basePath) {
                return terminalDir;
              }
            } catch (error) {
              console.warn(`Could not read origin file: ${originPath}`, error);
            }
          }
        }
      } catch (error) {
        console.warn('Could not determine data path from AppData:', error);
      }
    }

    // Fallback to base path
    return basePath;
  }

  /**
   * Extract build number from version string
   */
  private extractBuildNumber(version: string): number {
    if (!version) return 0;
    
    // Look for build number pattern (usually 4 digits)
    const buildMatch = version.match(/(\d{4})/);
    return buildMatch ? parseInt(buildMatch[1]) : 0;
  }

  /**
   * Detect broker name from MT5 data
   */
  private async detectBroker(dataPath: string): Promise<string | undefined> {
    try {
      // Check various configuration files for broker information
      const configFiles = [
        path.join(dataPath, 'config', 'server.dat'),
        path.join(dataPath, 'config', 'servers.dat'),
        path.join(dataPath, 'config', 'terminal.ini'),
      ];

      for (const configFile of configFiles) {
        if (await FileUtils.pathExists(configFile)) {
          try {
            const content = await FileUtils.readFile(configFile);
            
            // Look for common broker names in the file content
            const brokerNames = [
              'IC Markets', 'XM', 'Exness', 'FXTM', 'HotForex', 'OctaFX',
              'FBS', 'InstaForex', 'Alpari', 'RoboForex', 'Tickmill',
              'Pepperstone', 'Admiral Markets', 'FXPro', 'OANDA',
              'FOREX.com', 'IG', 'Saxo Bank', 'Swissquote', 'Dukascopy'
            ];

            for (const broker of brokerNames) {
              if (content.toLowerCase().includes(broker.toLowerCase())) {
                return broker;
              }
            }
          } catch (error) {
            console.warn(`Could not read config file ${configFile}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Could not detect broker:', error);
    }

    return undefined;
  }

  /**
   * Detect account number from MT5 data
   */
  private async detectAccountNumber(dataPath: string): Promise<string | undefined> {
    try {
      // Check for account files
      const accountFiles = [
        path.join(dataPath, 'config', 'accounts.dat'),
        path.join(dataPath, 'profiles', 'default.ini'),
      ];

      for (const accountFile of accountFiles) {
        if (await FileUtils.pathExists(accountFile)) {
          try {
            const content = await FileUtils.readFile(accountFile);
            
            // Look for account number pattern (usually 6-8 digits)
            const accountMatch = content.match(/(\d{6,8})/);
            if (accountMatch) {
              return accountMatch[1];
            }
          } catch (error) {
            console.warn(`Could not read account file ${accountFile}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Could not detect account number:', error);
    }

    return undefined;
  }

  /**
   * Remove duplicate installations
   */
  private deduplicateInstallations(installations: MT5Info[]): MT5Info[] {
    const seen = new Set<string>();
    return installations.filter(install => {
      const key = install.path.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get MT5 installation by specific path
   */
  async getInstallationByPath(path: string): Promise<MT5Info | null> {
    try {
      const installation = await this.checkInstallationPath(path, MT5InstallationType.CUSTOM);
      return installation;
    } catch (error) {
      console.error(`Error getting MT5 installation at ${path}:`, error);
      return null;
    }
  }

  /**
   * Check if MT5 is installed on the system
   */
  async isMT5Installed(): Promise<boolean> {
    const installations = await this.detectAllInstallations();
    return installations.length > 0;
  }

  /**
   * Get primary MT5 installation (first one found)
   */
  async getPrimaryInstallation(): Promise<MT5Info | null> {
    const installations = await this.detectAllInstallations();
    return installations.length > 0 ? installations[0] : null;
  }

  /**
   * Get running MT5 installations
   */
  async getRunningInstallations(): Promise<MT5Info[]> {
    const installations = await this.detectAllInstallations();
    return installations.filter(install => install.isRunning);
  }

  /**
   * Validate MT5 installation
   */
  async validateInstallation(mt5Info: MT5Info): Promise<boolean> {
    try {
      // Check if main executable exists
      const terminal64 = path.join(mt5Info.path, 'terminal64.exe');
      const terminal32 = path.join(mt5Info.path, 'terminal.exe');
      
      const hasTerminal = await FileUtils.pathExists(terminal64) || 
                         await FileUtils.pathExists(terminal32);
      
      if (!hasTerminal) {
        return false;
      }

      // Check if MQL5 directories exist
      const hasLibraries = await FileUtils.pathExists(mt5Info.libraryPath);
      const hasExperts = await FileUtils.pathExists(mt5Info.expertsPath);
      
      return hasLibraries && hasExperts;
      
    } catch (error) {
      console.error('Error validating MT5 installation:', error);
      return false;
    }
  }
}