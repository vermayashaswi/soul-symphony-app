
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const platform = args.find(arg => arg === 'android' || arg === 'ios');

console.log(`Building Capacitor app for ${isDev ? 'development' : 'production'}...`);

// Copy appropriate config
const configSource = isDev ? 'capacitor.config.dev.ts' : 'capacitor.config.ts';
const configDest = 'capacitor.config.temp.ts';

try {
  // Build the web app first
  console.log('Building web app...');
  execSync('npm run build', { stdio: 'inherit' });

  // Use the appropriate config
  if (isDev && fs.existsSync('capacitor.config.dev.ts')) {
    fs.copyFileSync('capacitor.config.dev.ts', configDest);
    console.log('Using development configuration');
  } else {
    fs.copyFileSync('capacitor.config.ts', configDest);
    console.log('Using production configuration');
  }

  // Sync capacitor with enhanced logging
  console.log('Syncing Capacitor...');
  execSync(`npx cap sync${platform ? ' ' + platform : ''}`, { stdio: 'inherit' });

  // Verify Android resources if building for Android
  if (platform === 'android' || !platform) {
    console.log('Verifying Android resources...');
    
    const androidIconPaths = [
      'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
      'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
      'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
      'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
      'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
    ];
    
    const missingIcons = androidIconPaths.filter(iconPath => !fs.existsSync(iconPath));
    
    if (missingIcons.length > 0) {
      console.warn('⚠️  Missing Android icons detected:');
      missingIcons.forEach(icon => console.warn(`   - ${icon}`));
      console.warn('Please replace these with actual Soulo logo files.');
      console.warn('Download from: https://soulo.online/lovable-uploads/soulo-icon.png?v=2');
    }
  }

  // Clean up temp config
  if (fs.existsSync(configDest)) {
    fs.unlinkSync(configDest);
  }

  console.log('✅ Capacitor build completed successfully!');
  
  if (platform) {
    console.log(`\nTo run on ${platform}:`);
    console.log(`npx cap run ${platform}`);
  } else {
    console.log('\nTo run on a platform:');
    console.log('npx cap run android');
    console.log('npx cap run ios');
  }

  console.log('\n📱 Next steps for mobile deployment:');
  console.log('1. Replace placeholder icon files with actual Soulo logo');
  console.log('2. Test OAuth authentication flow');
  console.log('3. Verify splash screen appears correctly');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  
  // Clean up temp config on error
  if (fs.existsSync(configDest)) {
    fs.unlinkSync(configDest);
  }
  
  process.exit(1);
}
