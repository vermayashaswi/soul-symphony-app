const fs = require('fs');
const path = require('path');

const gradlePath = path.resolve(__dirname, '../android/app/capacitor.build.gradle');

if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf-8');

  // Replace VERSION_21 with VERSION_17
  content = content.replace(/JavaVersion.VERSION_21/g, 'JavaVersion.VERSION_17');

  fs.writeFileSync(gradlePath, content, 'utf-8');
  console.log('✅ Forced JavaVersion.VERSION_17 in capacitor.build.gradle');
} else {
  console.warn('⚠️ capacitor.build.gradle not found. Skipping patch.');
}