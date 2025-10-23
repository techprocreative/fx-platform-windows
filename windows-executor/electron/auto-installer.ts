import { MT5AutoInstaller } from '../src/services/mt5-auto-installer.service';

// Export the auto-installer service for use in main process
export const autoInstallMT5 = new MT5AutoInstaller();