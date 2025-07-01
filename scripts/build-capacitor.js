
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const platform = args.find(arg => arg === 'android' || arg === 'ios');

console.log(`Building Capacitor app for ${isDev ? 'development' : 'production'}...`);

// Copy appropriate config
const configSource = 'capacitor.config.ts';
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

  // Sync capacitor
  console.log('Syncing Capacitor...');
  execSync(`npx cap sync${platform ? ' ' + platform : ''}`, { stdio: 'inherit' });

  // Clean up temp config
  if (fs.existsSync(configDest)) {
    fs.unlinkSync(configDest);
  }

  console.log('Capacitor build completed successfully!');
  
  if (platform) {
    console.log(`\nTo run on ${platform}:`);
    console.log(`npx cap run ${platform}`);
  } else {
    console.log('\nTo run on a platform:');
    console.log('npx cap run android');
    console.log('npx cap run ios');
  }

} catch (error) {
  console.error('Build failed:', error.message);
  
  // Clean up temp config on error
  if (fs.existsSync(configDest)) {
    fs.unlinkSync(configDest);
  }
  
  process.exit(1);
}
