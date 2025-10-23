/**
 * After Sign Script for Electron Builder
 * Optional: Handles code signing of the application
 *
 * Note: Code signing requires a valid certificate
 * For development/testing, this script will be skipped
 */

module.exports = async function (context) {
  const { electronPlatformName, appOutDir } = context;

  console.log('\n========================================');
  console.log('Running afterSign script...');
  console.log('========================================\n');

  console.log(`Platform: ${electronPlatformName}`);
  console.log(`Output directory: ${appOutDir}`);

  // Code signing is optional for development
  // In production, you would use a valid certificate here

  if (electronPlatformName !== 'win32') {
    console.log('Not Windows platform, skipping Windows signing');
    return;
  }

  // Check if certificate is available
  const hasCertificate = process.env.CSC_LINK || process.env.WIN_CSC_LINK;

  if (!hasCertificate) {
    console.log('\n⚠️  No certificate found (CSC_LINK not set)');
    console.log('Skipping code signing...');
    console.log('\nFor production builds, set environment variables:');
    console.log('  CSC_LINK=path/to/certificate.pfx');
    console.log('  CSC_KEY_PASSWORD=your_password');
    console.log('\nOr use Windows Certificate Store:');
    console.log('  WIN_CSC_LINK=<certificate-thumbprint>');
    console.log('\n========================================\n');
    return;
  }

  console.log('\n✓ Certificate found, signing will be handled by electron-builder');
  console.log('========================================\n');
};
