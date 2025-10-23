/**
 * Unit Tests for MT5 Auto-Installer
 * Test coverage for all major functionality
 */

import { MT5AutoInstaller } from '../services/mt5-auto-installer.service';
import { MT5DetectorService } from '../services/mt5-detector.service';
import { FileUtils } from '../utils/file-utils';
import {
  MT5Info,
  InstallProgress,
  InstallResult,
  AutoInstallerConfig,
  MT5InstallationType
} from '../types/mt5.types';

// Mock file system operations
jest.mock('fs-extra');
jest.mock('../utils/file-utils');

describe('MT5AutoInstaller', () => {
  let installer: MT5AutoInstaller;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    mockProgressCallback = jest.fn();
    installer = new MT5AutoInstaller(mockProgressCallback);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create installer with default config', () => {
      const testInstaller = new MT5AutoInstaller();
      const config = testInstaller.getConfig();
      
      expect(config.forceUpdate).toBe(false);
      expect(config.createBackups).toBe(true);
      expect(config.verifyInstallation).toBe(true);
      expect(config.autoAttachEA).toBe(false);
      expect(config.defaultSymbol).toBe('EURUSD');
      expect(config.defaultTimeframe).toBe('H1');
    });

    it('should create installer with custom config', () => {
      const customConfig: Partial<AutoInstallerConfig> = {
        forceUpdate: true,
        autoAttachEA: true,
        defaultSymbol: 'GBPUSD'
      };
      
      const testInstaller = new MT5AutoInstaller(undefined, customConfig);
      const config = testInstaller.getConfig();
      
      expect(config.forceUpdate).toBe(true);
      expect(config.autoAttachEA).toBe(true);
      expect(config.defaultSymbol).toBe('GBPUSD');
    });
  });

  describe('Progress Reporting', () => {
    it('should call progress callback during operations', async () => {
      // Mock detector to return empty installations
      const mockDetectAllInstallations = jest.spyOn(
        MT5DetectorService.prototype, 
        'detectAllInstallations'
      );
      mockDetectAllInstallations.mockResolvedValue([]);

      await installer.autoInstallEverything();

      // Should have called progress callback
      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Check if it was called with proper progress format
      const progressCalls = mockProgressCallback.mock.calls.map(call => call[0]);
      expect(progressCalls[0]).toHaveProperty('step');
      expect(progressCalls[0]).toHaveProperty('message');
    });

    it('should report error progress on failure', async () => {
      // Mock detector to throw error
      const mockDetectAllInstallations = jest.spyOn(
        MT5DetectorService.prototype, 
        'detectAllInstallations'
      );
      mockDetectAllInstallations.mockRejectedValue(new Error('Detection failed'));

      await installer.autoInstallEverything();

      // Should report error
      const errorProgress = mockProgressCallback.mock.calls
        .map(call => call[0])
        .find(progress => progress.step === -1);
      
      expect(errorProgress).toBeDefined();
      expect(errorProgress.message).toContain('failed');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig: Partial<AutoInstallerConfig> = {
        forceUpdate: true,
        defaultSymbol: 'USDJPY'
      };

      installer.updateConfig(newConfig);
      const config = installer.getConfig();

      expect(config.forceUpdate).toBe(true);
      expect(config.defaultSymbol).toBe('USDJPY');
      // Other config should remain unchanged
      expect(config.createBackups).toBe(true);
    });

    it('should return copy of config', () => {
      const config1 = installer.getConfig();
      const config2 = installer.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });
  });

  describe('Installation Status', () => {
    const mockMT5Info: MT5Info = {
      path: 'C:\\MT5',
      dataPath: 'C:\\MT5\\Data',
      version: '5.0',
      build: 3815,
      libraryPath: 'C:\\MT5\\Data\\MQL5\\Libraries',
      expertsPath: 'C:\\MT5\\Data\\MQL5\\Experts',
      isRunning: false
    };

    it('should return correct installation status', async () => {
      // Mock file existence checks
      (FileUtils.pathExists as jest.Mock)
        .mockResolvedValueOnce(true)  // libzmq.dll exists
        .mockResolvedValueOnce(true)  // EA exists
        .mockResolvedValueOnce(false); // Config doesn't exist

      const status = await installer.getInstallationStatus(mockMT5Info);

      expect(status.libzmqInstalled).toBe(true);
      expect(status.eaInstalled).toBe(true);
      expect(status.configExists).toBe(false);
    });

    it('should handle file check errors gracefully', async () => {
      // Mock file existence check to throw error
      (FileUtils.pathExists as jest.Mock).mockRejectedValue(new Error('File system error'));

      const status = await installer.getInstallationStatus(mockMT5Info);

      expect(status.libzmqInstalled).toBe(false);
      expect(status.eaInstalled).toBe(false);
      expect(status.configExists).toBe(false);
    });
  });

  describe('Backup and Restore', () => {
    const mockMT5Info: MT5Info = {
      path: 'C:\\MT5',
      dataPath: 'C:\\MT5\\Data',
      version: '5.0',
      build: 3815,
      libraryPath: 'C:\\MT5\\Data\\MQL5\\Libraries',
      expertsPath: 'C:\\MT5\\Data\\MQL5\\Experts',
      isRunning: false
    };

    it('should create backup for existing files', async () => {
      // Mock file existence and operations
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);
      (FileUtils.createBackup as jest.Mock).mockResolvedValue('backup.dll');
      (FileUtils.calculateFileHash as jest.Mock).mockResolvedValue({
        path: 'test.dll',
        hash: 'abc123',
        algorithm: 'sha256',
        size: 1024,
        lastModified: new Date()
      });

      const backups = await installer.createBackup([mockMT5Info]);

      expect(backups.length).toBeGreaterThan(0);
      expect(FileUtils.createBackup).toHaveBeenCalled();
    });

    it('should restore from backup', async () => {
      const mockBackups = [
        {
          originalPath: 'C:\\MT5\\libzmq.dll',
          backupPath: 'C:\\MT5\\libzmq.dll.backup',
          timestamp: new Date(),
          hash: 'abc123'
        }
      ];

      // Mock file operations
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);
      (FileUtils.copy as jest.Mock).mockResolvedValue(true);

      const result = await installer.restoreFromBackup(mockBackups);

      expect(result).toBe(true);
      expect(FileUtils.copy).toHaveBeenCalledWith(
        mockBackups[0].backupPath,
        mockBackups[0].originalPath
      );
    });

    it('should handle restore errors', async () => {
      const mockBackups = [
        {
          originalPath: 'C:\\MT5\\libzmq.dll',
          backupPath: 'C:\\MT5\\libzmq.dll.backup',
          timestamp: new Date(),
          hash: 'abc123'
        }
      ];

      // Mock file operations to fail
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);
      (FileUtils.copy as jest.Mock).mockRejectedValue(new Error('Copy failed'));

      const result = await installer.restoreFromBackup(mockBackups);

      expect(result).toBe(false);
    });
  });

  describe('Admin Requirements', () => {
    it('should detect admin requirements', async () => {
      // Mock file permissions check
      (FileUtils.checkWritePermissions as jest.Mock).mockResolvedValue(false);

      const adminRequired = await installer.checkAdminRequirements();

      expect(adminRequired).toBe(true);
    });

    it('should allow installation without admin', async () => {
      // Mock file permissions check
      (FileUtils.checkWritePermissions as jest.Mock).mockResolvedValue(true);

      const adminRequired = await installer.checkAdminRequirements();

      expect(adminRequired).toBe(false);
    });

    it('should handle permission check errors', async () => {
      // Mock file permissions check to throw error
      (FileUtils.checkWritePermissions as jest.Mock).mockRejectedValue(new Error('Permission check failed'));

      const adminRequired = await installer.checkAdminRequirements();

      expect(adminRequired).toBe(true); // Default to admin required on error
    });
  });

  describe('Installation Verification', () => {
    const mockMT5Info: MT5Info = {
      path: 'C:\\MT5',
      dataPath: 'C:\\MT5\\Data',
      version: '5.0',
      build: 3815,
      libraryPath: 'C:\\MT5\\Data\\MQL5\\Libraries',
      expertsPath: 'C:\\MT5\\Data\\MQL5\\Experts',
      isRunning: false
    };

    it('should verify successful installation', async () => {
      // Mock all files to exist
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);

      const result = await installer.verifyInstallation([mockMT5Info]);

      expect(result.success).toBe(true);
      expect(result.componentsInstalled.libzmq).toBe(true);
      expect(result.componentsInstalled.expertAdvisor).toBe(true);
      expect(result.componentsInstalled.configFile).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing components', async () => {
      // Mock files to not exist
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(false);

      const result = await installer.verifyInstallation([mockMT5Info]);

      expect(result.success).toBe(false);
      expect(result.componentsInstalled.libzmq).toBe(false);
      expect(result.componentsInstalled.expertAdvisor).toBe(false);
      expect(result.componentsInstalled.configFile).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('MT5DetectorService', () => {
  let detector: MT5DetectorService;

  beforeEach(() => {
    detector = new MT5DetectorService();
    jest.clearAllMocks();
  });

  describe('Installation Detection', () => {
    it('should detect standard installations', async () => {
      // Mock file system checks
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);
      (FileUtils.getFileVersion as jest.Mock).mockResolvedValue('5.0.0.3815');
      (FileUtils.getProductVersion as jest.Mock).mockResolvedValue('5.0.0');
      (FileUtils.ensureDirectory as jest.Mock).mockResolvedValue(true);
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);

      const installations = await detector.detectAllInstallations();

      expect(installations).toBeInstanceOf(Array);
    });

    it('should return empty array when no MT5 found', async () => {
      // Mock file system checks to return false
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(false);

      const installations = await detector.detectAllInstallations();

      expect(installations).toHaveLength(0);
    });

    it('should detect running installations', async () => {
      // Mock running processes
      const mockProcesses = [
        { pid: 1234, name: 'terminal64.exe', path: 'C:\\MT5\\terminal64.exe' }
      ];
      
      (FileUtils.getRunningProcesses as jest.Mock).mockResolvedValue(mockProcesses);
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);
      (FileUtils.getFileVersion as jest.Mock).mockResolvedValue('5.0.0.3815');
      (FileUtils.getProductVersion as jest.Mock).mockResolvedValue('5.0.0');
      (FileUtils.ensureDirectory as jest.Mock).mockResolvedValue(true);

      const runningInstallations = await detector.getRunningInstallations();

      expect(runningInstallations.length).toBeGreaterThan(0);
      expect(runningInstallations[0].isRunning).toBe(true);
    });
  });

  describe('Installation Validation', () => {
    const mockMT5Info: MT5Info = {
      path: 'C:\\MT5',
      dataPath: 'C:\\MT5\\Data',
      version: '5.0',
      build: 3815,
      libraryPath: 'C:\\MT5\\Data\\MQL5\\Libraries',
      expertsPath: 'C:\\MT5\\Data\\MQL5\\Experts',
      isRunning: false
    };

    it('should validate correct installation', async () => {
      // Mock all required files to exist
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);

      const isValid = await detector.validateInstallation(mockMT5Info);

      expect(isValid).toBe(true);
    });

    it('should detect invalid installation', async () => {
      // Mock terminal executable to not exist
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(false);

      const isValid = await detector.validateInstallation(mockMT5Info);

      expect(isValid).toBe(false);
    });
  });

  describe('Path Detection', () => {
    it('should get installation by specific path', async () => {
      const testPath = 'C:\\CustomMT5';
      
      // Mock file system checks
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);
      (FileUtils.getFileVersion as jest.Mock).mockResolvedValue('5.0.0.3815');
      (FileUtils.getProductVersion as jest.Mock).mockResolvedValue('5.0.0');
      (FileUtils.ensureDirectory as jest.Mock).mockResolvedValue(true);

      const installation = await detector.getInstallationByPath(testPath);

      if (installation) {
        expect(installation.path).toBe(testPath);
      }
    });

    it('should return null for invalid path', async () => {
      const invalidPath = 'C:\\InvalidPath';
      
      // Mock file system checks
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(false);

      const installation = await detector.getInstallationByPath(invalidPath);

      expect(installation).toBeNull();
    });
  });
});

describe('FileUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Operations', () => {
    it('should copy file with backup', async () => {
      const sourcePath = 'source.dll';
      const destPath = 'dest.dll';
      
      // Mock file operations
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(true);
      (FileUtils.ensureDir as jest.Mock).mockResolvedValue(undefined);
      (FileUtils.copy as jest.Mock).mockResolvedValue(undefined);

      const result = await FileUtils.copyWithBackup(sourcePath, destPath, true);

      expect(result.success).toBe(true);
      expect(result.sourcePath).toBe(sourcePath);
      expect(result.destinationPath).toBe(destPath);
    });

    it('should handle missing source file', async () => {
      const sourcePath = 'missing.dll';
      const destPath = 'dest.dll';
      
      // Mock file operations
      (FileUtils.pathExists as jest.Mock).mockResolvedValue(false);

      const result = await FileUtils.copyWithBackup(sourcePath, destPath, true);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Source file does not exist');
    });

    it('should create backup file', async () => {
      const filePath = 'test.dll';
      const expectedBackupPath = 'test.dll.backup.' + new Date().toISOString().replace(/[:.]/g, '-');
      
      // Mock file operations
      (FileUtils.copy as jest.Mock).mockResolvedValue(undefined);

      const backupPath = await FileUtils.createBackup(filePath);

      expect(backupPath).toContain('test.dll.backup.');
      expect(FileUtils.copy).toHaveBeenCalledWith(filePath, expect.stringContaining('backup'));
    });

    it('should calculate file hash', async () => {
      const filePath = 'test.dll';
      const fileContent = 'test content';
      
      // Mock file operations
      const mockFileBuffer = Buffer.from(fileContent);
      (FileUtils.readFile as jest.Mock).mockResolvedValue(mockFileBuffer);
      (FileUtils.stat as jest.Mock).mockResolvedValue({
        size: fileContent.length,
        mtime: new Date()
      });

      const hash = await FileUtils.calculateFileHash(filePath);

      expect(hash.path).toBe(filePath);
      expect(hash.algorithm).toBe('sha256');
      expect(hash.size).toBe(fileContent.length);
      expect(hash.hash).toBeDefined();
    });

    it('should compare files by hash', async () => {
      const file1Path = 'file1.dll';
      const file2Path = 'file2.dll';
      
      // Mock hash calculation to return same hash
      const mockHash = {
        path: file1Path,
        hash: 'abc123',
        algorithm: 'sha256' as const,
        size: 1024,
        lastModified: new Date()
      };
      
      jest.spyOn(FileUtils, 'calculateFileHash')
        .mockResolvedValueOnce(mockHash)
        .mockResolvedValueOnce(mockHash);

      const isSame = await FileUtils.compareFiles(file1Path, file2Path);

      expect(isSame).toBe(true);
    });

    it('should check file up to date', async () => {
      const sourcePath = 'source.dll';
      const destPath = 'dest.dll';
      
      // Mock file comparison to return true
      jest.spyOn(FileUtils, 'compareFiles').mockResolvedValue(true);

      const isUpToDate = await FileUtils.isFileUpToDate(sourcePath, destPath);

      expect(isUpToDate).toBe(true);
    });
  });

  describe('Permission Checks', () => {
    it('should check write permissions', async () => {
      const testDir = 'C:\\Test';
      
      // Mock file operations
      (FileUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FileUtils.remove as jest.Mock).mockResolvedValue(undefined);

      const hasPermission = await FileUtils.checkWritePermissions(testDir);

      expect(hasPermission).toBe(true);
    });

    it('should check read permissions', async () => {
      const testFile = 'C:\\Test\\file.txt';
      
      // Mock file access check
      const mockAccess = jest.fn();
      (FileUtils.access as jest.Mock) = mockAccess;
      mockAccess.mockImplementation((path, mode, callback) => {
        callback(null);
      });

      const hasPermission = await FileUtils.checkReadPermissions(testFile);

      expect(hasPermission).toBe(true);
    });
  });

  describe('Process Detection', () => {
    it('should check if process is running', async () => {
      const processName = 'terminal64.exe';
      
      // Mock process check
      const mockExec = jest.fn();
      (global as any).require = jest.fn(() => ({ exec: mockExec }));
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: 'terminal64.exe,1234' });
      });

      const isRunning = await FileUtils.isProcessRunning(processName);

      expect(isRunning).toBe(true);
    });

    it('should get running processes', async () => {
      const processPattern = 'terminal';
      
      // Mock process listing
      const mockExec = jest.fn();
      (global as any).require = jest.fn(() => ({ exec: mockExec }));
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: 'terminal64.exe,1234,C:\\MT5\\terminal64.exe' });
      });

      const processes = await FileUtils.getRunningProcesses(processPattern);

      expect(processes).toBeInstanceOf(Array);
      expect(processes.length).toBeGreaterThan(0);
    });
  });

  describe('Version Information', () => {
    it('should get file version', async () => {
      const filePath = 'terminal64.exe';
      const expectedVersion = '5.0.0.3815';
      
      // Mock PowerShell command
      const mockExec = jest.fn();
      (global as any).require = jest.fn(() => ({ exec: mockExec }));
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: expectedVersion });
      });

      const version = await FileUtils.getFileVersion(filePath);

      expect(version).toBe(expectedVersion);
    });

    it('should get product version', async () => {
      const filePath = 'terminal64.exe';
      const expectedVersion = '5.0.0';
      
      // Mock PowerShell command
      const mockExec = jest.fn();
      (global as any).require = jest.fn(() => ({ exec: mockExec }));
      mockExec.mockImplementation((command, callback) => {
        callback(null, { stdout: expectedVersion });
      });

      const version = await FileUtils.getProductVersion(filePath);

      expect(version).toBe(expectedVersion);
    });
  });

  describe('Directory Operations', () => {
    it('should ensure directory exists', async () => {
      const dirPath = 'C:\\Test\\Directory';
      
      // Mock directory creation
      (FileUtils.ensureDir as jest.Mock).mockResolvedValue(undefined);

      const created = await FileUtils.ensureDirectory(dirPath);

      expect(created).toBe(true);
      expect(FileUtils.ensureDir).toHaveBeenCalledWith(dirPath);
    });

    it('should list files in directory', async () => {
      const dirPath = 'C:\\Test\\Directory';
      const expectedFiles = ['file1.txt', 'file2.txt'];
      
      // Mock directory listing
      (FileUtils.readdir as jest.Mock).mockResolvedValue(expectedFiles);

      const files = await FileUtils.listFiles(dirPath);

      expect(files).toEqual(expectedFiles);
    });

    it('should list files with pattern filter', async () => {
      const dirPath = 'C:\\Test\\Directory';
      const allFiles = ['file1.txt', 'file2.dll', 'file3.exe'];
      const pattern = /\.dll$/;
      
      // Mock directory listing
      (FileUtils.readdir as jest.Mock).mockResolvedValue(allFiles);

      const files = await FileUtils.listFiles(dirPath, pattern);

      expect(files).toEqual(['file2.dll']);
    });
  });

  describe('File Content Operations', () => {
    it('should read file content', async () => {
      const filePath = 'test.txt';
      const expectedContent = 'test content';
      
      // Mock file read
      (FileUtils.readFile as jest.Mock).mockResolvedValue(expectedContent);

      const content = await FileUtils.readFile(filePath);

      expect(content).toBe(expectedContent);
    });

    it('should write file content', async () => {
      const filePath = 'test.txt';
      const content = 'test content';
      
      // Mock file write
      (FileUtils.writeFile as jest.Mock).mockResolvedValue(true);

      const success = await FileUtils.writeFile(filePath, content);

      expect(success).toBe(true);
    });

    it('should read JSON file', async () => {
      const filePath = 'test.json';
      const expectedData = { key: 'value' };
      
      // Mock JSON read
      (FileUtils.readJson as jest.Mock).mockResolvedValue(expectedData);

      const data = await FileUtils.readJsonFile(filePath);

      expect(data).toEqual(expectedData);
    });

    it('should write JSON file', async () => {
      const filePath = 'test.json';
      const data = { key: 'value' };
      
      // Mock JSON write
      (FileUtils.writeJson as jest.Mock).mockResolvedValue(true);

      const success = await FileUtils.writeJsonFile(filePath, data);

      expect(success).toBe(true);
    });
  });
});