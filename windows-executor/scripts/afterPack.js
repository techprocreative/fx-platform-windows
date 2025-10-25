const fs = require('fs-extra');
const path = require('path');

/**
 * electron-builder afterPack hook
 * Copies resources that aren't automatically included
 */
module.exports = async function(context) {
  console.log('\n🔧 afterPack: Copying resources...');
  
  const appOutDir = context.appOutDir;
  const resourcesDir = path.join(appOutDir, 'resources');
  
  console.log('   App output dir:', appOutDir);
  console.log('   Resources dir:', resourcesDir);
  
  try {
    // 1. Copy DLLs
    const dllSource = path.join(__dirname, '../resources/libs');
    const dllDest = path.join(resourcesDir, 'libs');
    
    fs.ensureDirSync(dllDest);
    
    const dlls = ['libzmq.dll', 'libsodium.dll'];
    dlls.forEach(dll => {
      const src = path.join(dllSource, dll);
      const dest = path.join(dllDest, dll);
      
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`   ✅ Copied ${dll}`);
      }
    });
    
    // 2. Copy Expert Advisors
    const eaSource = path.join(__dirname, '../resources/experts');
    const eaDest = path.join(resourcesDir, 'experts');
    
    if (fs.existsSync(eaSource)) {
      fs.ensureDirSync(eaDest);
      
      const eaFiles = fs.readdirSync(eaSource).filter(f => 
        f.endsWith('.mq5') || f.endsWith('.ex5')
      );
      
      eaFiles.forEach(ea => {
        fs.copyFileSync(
          path.join(eaSource, ea),
          path.join(eaDest, ea)
        );
        console.log(`   ✅ Copied ${ea}`);
      });
    }
    
    // 3. Copy icons
    const iconSource = path.join(__dirname, '../resources/icons');
    const iconDest = path.join(resourcesDir, 'icons');
    
    if (fs.existsSync(iconSource)) {
      fs.ensureDirSync(iconDest);
      
      const icons = fs.readdirSync(iconSource).filter(f => 
        f.endsWith('.ico') || f.endsWith('.png')
      );
      
      icons.forEach(icon => {
        fs.copyFileSync(
          path.join(iconSource, icon),
          path.join(iconDest, icon)
        );
        console.log(`   ✅ Copied ${icon}`);
      });
    }
    
    console.log('   ✅ All resources copied in afterPack!\n');
  } catch (error) {
    console.error('   ❌ afterPack failed:', error);
    throw error;
  }
};
