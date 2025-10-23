/**
 * Example usage of MT5 Auto-Installer
 * This file demonstrates how to use the auto-installer service
 */

import { MT5AutoInstaller } from '../services/mt5-auto-installer.service';
import { MT5DetectorService } from '../services/mt5-detector.service';
import { InstallProgress, InstallResult, AutoInstallerConfig } from '../types/mt5.types';

/**
 * Example 1: Basic auto-installation with default settings
 */
async function basicAutoInstall(): Promise<void> {
  console.log('=== Basic Auto-Installation Example ===');
  
  // Create installer with progress callback
  const installer = new MT5AutoInstaller((progress: InstallProgress) => {
    console.log(`[${progress.step}] ${progress.message} (${progress.percentage}%)`);
  });

  try {
    // Run auto-installation
    const result: InstallResult = await installer.autoInstallEverything();
    
    console.log('\n=== Installation Result ===');
    console.log(`Success: ${result.success}`);
    console.log(`MT5 Installations Found: ${result.mt5Installations.length}`);
    
    if (result.mt5Installations.length > 0) {
      console.log('\nFound MT5 Installations:');
      result.mt5Installations.forEach((mt5, index) => {
        console.log(`${index + 1}. ${mt5.path}`);
        console.log(`   Version: ${mt5.version} (Build ${mt5.build})`);
        console.log(`   Data Path: ${mt5.dataPath}`);
        console.log(`   Running: ${mt5.isRunning}`);
        if (mt5.broker) console.log(`   Broker: ${mt5.broker}`);
        if (mt5.accountNumber) console.log(`   Account: ${mt5.accountNumber}`);
      });
    }
    
    console.log('\nComponents Installed:');
    console.log(`- libzmq.dll: ${result.componentsInstalled.libzmq ? '✓' : '✗'}`);
    console.log(`- Expert Advisor: ${result.componentsInstalled.expertAdvisor ? '✓' : '✗'}`);
    console.log(`- Config File: ${result.componentsInstalled.configFile ? '✓' : '✗'}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(error => console.log(`- ${error}`));
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warning => console.log(`- ${warning}`));
    }
    
  } catch (error) {
    console.error('Auto-installation failed:', error);
  }
}

/**
 * Example 2: Custom configuration
 */
async function customConfigInstall(): Promise<void> {
  console.log('\n=== Custom Configuration Example ===');
  
  // Custom configuration
  const customConfig: Partial<AutoInstallerConfig> = {
    forceUpdate: true,           // Force update even if files exist
    createBackups: true,         // Create backups before overwriting
    verifyInstallation: true,    // Verify installation after completion
    autoAttachEA: true,          // Try to auto-attach EA to chart
    defaultSymbol: 'GBPUSD',     // Default symbol for auto-attach
    defaultTimeframe: 'M15',     // Default timeframe
  };
  
  const installer = new MT5AutoInstaller(
    (progress: InstallProgress) => {
      console.log(`[Step ${progress.step}] ${progress.message}`);
    },
    customConfig
  );

  try {
    const result = await installer.autoInstallEverything();
    console.log(`Custom installation completed: ${result.success}`);
  } catch (error) {
    console.error('Custom installation failed:', error);
  }
}

/**
 * Example 3: Detection only
 */
async function detectionOnly(): Promise<void> {
  console.log('\n=== Detection Only Example ===');
  
  const detector = new MT5DetectorService();
  
  try {
    const installations = await detector.detectAllInstallations();
    
    console.log(`Found ${installations.length} MT5 installation(s):`);
    
    for (let i = 0; i < installations.length; i++) {
      const mt5 = installations[i];
      console.log(`\n${i + 1}. ${mt5.path}`);
      console.log(`   Version: ${mt5.version} (Build ${mt5.build})`);
      console.log(`   Library Path: ${mt5.libraryPath}`);
      console.log(`   Experts Path: ${mt5.expertsPath}`);
      console.log(`   Running: ${mt5.isRunning}`);
      
      // Check installation status
      const status = await detector.validateInstallation(mt5);
      console.log(`   Valid: ${status}`);
      
      // Check what's already installed
      const installer = new MT5AutoInstaller();
      const installStatus = await installer.getInstallationStatus(mt5);
      console.log(`   libzmq.dll: ${installStatus.libzmqInstalled ? 'Installed' : 'Not installed'}`);
      console.log(`   Expert Advisor: ${installStatus.eaInstalled ? 'Installed' : 'Not installed'}`);
      console.log(`   Config File: ${installStatus.configExists ? 'Exists' : 'Not found'}`);
    }
    
  } catch (error) {
    console.error('Detection failed:', error);
  }
}

/**
 * Example 4: Backup and Restore
 */
async function backupAndRestore(): Promise<void> {
  console.log('\n=== Backup and Restore Example ===');
  
  const detector = new MT5DetectorService();
  const installer = new MT5AutoInstaller();
  
  try {
    // Detect installations
    const installations = await detector.detectAllInstallations();
    
    if (installations.length === 0) {
      console.log('No MT5 installations found');
      return;
    }
    
    // Create backup
    console.log('Creating backup...');
    const backups = await installer.createBackup(installations);
    console.log(`Created ${backups.length} backup(s)`);
    
    // Show backup info
    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.originalPath}`);
      console.log(`   Backup: ${backup.backupPath}`);
      console.log(`   Timestamp: ${backup.timestamp.toISOString()}`);
      console.log(`   Hash: ${backup.hash}`);
    });
    
    // Simulate restore (commented out to avoid actual restore)
    // console.log('\nRestoring from backup...');
    // const restoreSuccess = await installer.restoreFromBackup(backups);
    // console.log(`Restore ${restoreSuccess ? 'successful' : 'failed'}`);
    
  } catch (error) {
    console.error('Backup/Restore failed:', error);
  }
}

/**
 * Example 5: Progress monitoring with detailed steps
 */
async function detailedProgressMonitoring(): Promise<void> {
  console.log('\n=== Detailed Progress Monitoring Example ===');
  
  const installer = new MT5AutoInstaller((progress: InstallProgress) => {
    let stepName = '';
    
    switch (progress.step) {
      case 1:
        stepName = 'DETECTING_MT5';
        break;
      case 2:
        stepName = 'INSTALLING_LIBZMQ';
        break;
      case 3:
        stepName = 'INSTALLING_EXPERT_ADVISOR';
        break;
      case 4:
        stepName = 'CREATING_CONFIG';
        break;
      case 5:
        stepName = 'AUTO_ATTACHING_EA';
        break;
      case 6:
        stepName = 'COMPLETED';
        break;
      case -1:
        stepName = 'FAILED';
        break;
    }
    
    console.log(`[${stepName}] ${progress.message}`);
    if (progress.percentage !== undefined) {
      const progressBar = '█'.repeat(Math.floor(progress.percentage / 5));
      const emptyBar = '░'.repeat(20 - Math.floor(progress.percentage / 5));
      console.log(`[${progressBar}${emptyBar}] ${progress.percentage}%`);
    }
  });

  try {
    const result = await installer.autoInstallEverything();
    console.log(`\nFinal result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error('Installation with monitoring failed:', error);
  }
}

/**
 * Example 6: Admin requirement check
 */
async function checkAdminRequirements(): Promise<void> {
  console.log('\n=== Admin Requirements Check Example ===');
  
  const installer = new MT5AutoInstaller();
  
  try {
    const adminRequired = await installer.checkAdminRequirements();
    
    if (adminRequired) {
      console.log('⚠️  Administrator privileges are required for installation');
      console.log('Please run this application as Administrator');
    } else {
      console.log('✓ Installation can proceed without Administrator privileges');
    }
    
  } catch (error) {
    console.error('Failed to check admin requirements:', error);
  }
}

/**
 * Main function to run all examples
 */
async function runAllExamples(): Promise<void> {
  console.log('MT5 Auto-Installer Examples');
  console.log('=============================\n');
  
  // Run examples in order
  await checkAdminRequirements();
  await detectionOnly();
  await basicAutoInstall();
  await customConfigInstall();
  await detailedProgressMonitoring();
  await backupAndRestore();
  
  console.log('\n=== All Examples Completed ===');
}

// Export functions for individual testing
export {
  basicAutoInstall,
  customConfigInstall,
  detectionOnly,
  backupAndRestore,
  detailedProgressMonitoring,
  checkAdminRequirements,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}