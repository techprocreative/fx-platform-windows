const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('====================================');
console.log('FX Platform Executor - CLEAR CONFIG');
console.log('====================================\n');

const configPaths = [
  // Windows
  path.join(os.homedir(), 'AppData', 'Roaming', 'fx-platform-executor'),
  path.join(os.homedir(), 'AppData', 'Local', 'fx-platform-executor'),
  
  // Linux
  path.join(os.homedir(), '.config', 'fx-platform-executor'),
  
  // Mac
  path.join(os.homedir(), 'Library', 'Application Support', 'fx-platform-executor'),
  
  // Local dev database
  path.join(__dirname, '..', 'executor.db'),
];

console.log('🔍 Searching for configuration files...\n');

let foundCount = 0;
let deletedCount = 0;

configPaths.forEach(configPath => {
  if (fs.existsSync(configPath)) {
    foundCount++;
    console.log(`📁 Found: ${configPath}`);
    
    try {
      const stats = fs.statSync(configPath);
      
      if (stats.isDirectory()) {
        fs.rmSync(configPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(configPath);
      }
      
      console.log('   ✅ Deleted successfully\n');
      deletedCount++;
    } catch (error) {
      console.log(`   ❌ Failed to delete: ${error.message}\n`);
    }
  }
});

console.log('====================================');
console.log(`Found: ${foundCount} location(s)`);
console.log(`Deleted: ${deletedCount} location(s)`);
console.log('====================================\n');

if (deletedCount > 0) {
  console.log('✨ Configuration cleared successfully!');
  console.log('ℹ️  Next launch will start fresh with setup wizard.\n');
  console.log('📝 You will need to enter:');
  console.log('   - API Key');
  console.log('   - API Secret');
  console.log('   - Shared Secret (NEW!)\n');
} else {
  console.log('ℹ️  No configuration found to clear.');
  console.log('   App is already in fresh state.\n');
}

console.log('Press any key to exit...');
