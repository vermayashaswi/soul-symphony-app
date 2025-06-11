
/**
 * Icon Generator Utility for SOULo PWA
 * This utility helps generate all required icon sizes from base images
 */

interface IconSize {
  size: number;
  filename: string;
  purpose?: string;
}

// All required icon sizes for PWA and mobile platforms
export const REQUIRED_ICON_SIZES: IconSize[] = [
  // PWA Icons
  { size: 72, filename: 'icon-72x72.png' },
  { size: 96, filename: 'icon-96x96.png' },
  { size: 128, filename: 'icon-128x128.png' },
  { size: 144, filename: 'icon-144x144.png' },
  { size: 152, filename: 'icon-152x152.png' },
  { size: 192, filename: 'icon-192x192.png' },
  { size: 384, filename: 'icon-384x384.png' },
  { size: 512, filename: 'icon-512x512.png' },
  
  // iOS Specific Icons
  { size: 57, filename: 'apple-icon-57x57.png' },
  { size: 60, filename: 'apple-icon-60x60.png' },
  { size: 72, filename: 'apple-icon-72x72.png' },
  { size: 76, filename: 'apple-icon-76x76.png' },
  { size: 114, filename: 'apple-icon-114x114.png' },
  { size: 120, filename: 'apple-icon-120x120.png' },
  { size: 144, filename: 'apple-icon-144x144.png' },
  { size: 152, filename: 'apple-icon-152x152.png' },
  { size: 180, filename: 'apple-icon-180x180.png' },
  
  // Android Specific Icons
  { size: 36, filename: 'android-icon-36x36.png' },
  { size: 48, filename: 'android-icon-48x48.png' },
  { size: 72, filename: 'android-icon-72x72.png' },
  { size: 96, filename: 'android-icon-96x96.png' },
  { size: 144, filename: 'android-icon-144x144.png' },
  { size: 192, filename: 'android-icon-192x192.png' },
  
  // Favicons
  { size: 16, filename: 'favicon-16x16.png' },
  { size: 32, filename: 'favicon-32x32.png' },
  { size: 96, filename: 'favicon-96x96.png' }
];

/**
 * Generate icon HTML tags for inclusion in index.html
 */
export const generateIconTags = (): string => {
  const tags: string[] = [];
  
  // PWA manifest
  tags.push('<link rel="manifest" href="/manifest.json">');
  
  // Standard favicon
  tags.push('<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png">');
  tags.push('<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png">');
  tags.push('<link rel="icon" type="image/png" sizes="96x96" href="/icons/favicon-96x96.png">');
  
  // Apple Touch Icons
  tags.push('<link rel="apple-touch-icon" sizes="57x57" href="/icons/apple-icon-57x57.png">');
  tags.push('<link rel="apple-touch-icon" sizes="60x60" href="/icons/apple-icon-60x60.png">');
  tags.push('<link rel="apple-touch-icon" sizes="72x72" href="/icons/apple-icon-72x72.png">');
  tags.push('<link rel="apple-touch-icon" sizes="76x76" href="/icons/apple-icon-76x76.png">');
  tags.push('<link rel="apple-touch-icon" sizes="114x114" href="/icons/apple-icon-114x114.png">');
  tags.push('<link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-icon-120x120.png">');
  tags.push('<link rel="apple-touch-icon" sizes="144x144" href="/icons/apple-icon-144x144.png">');
  tags.push('<link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-icon-152x152.png">');
  tags.push('<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-icon-180x180.png">');
  
  // Android Chrome
  tags.push('<link rel="icon" type="image/png" sizes="192x192" href="/icons/android-icon-192x192.png">');
  
  // MS Tile
  tags.push('<meta name="msapplication-TileColor" content="#8b5cf6">');
  tags.push('<meta name="msapplication-TileImage" content="/icons/android-icon-144x144.png">');
  
  return tags.join('\n  ');
};

/**
 * Validate if all required icons exist
 */
export const validateIconSet = async (): Promise<{ missing: string[], existing: string[] }> => {
  const missing: string[] = [];
  const existing: string[] = [];
  
  for (const icon of REQUIRED_ICON_SIZES) {
    try {
      const response = await fetch(`/icons/${icon.filename}`, { method: 'HEAD' });
      if (response.ok) {
        existing.push(icon.filename);
      } else {
        missing.push(icon.filename);
      }
    } catch {
      missing.push(icon.filename);
    }
  }
  
  return { missing, existing };
};

/**
 * Instructions for manual icon generation
 */
export const getIconGenerationInstructions = (): string => {
  return `
To generate all required icons for SOULo PWA:

1. Start with your base app icon (ideally 1024x1024px)
2. Use an online tool like https://realfavicongenerator.net/ or 
   https://www.favicon-generator.org/
3. Upload your base icon and generate all sizes
4. Place all generated icons in the public/icons/ directory
5. Ensure the following sizes are included:
   ${REQUIRED_ICON_SIZES.map(icon => `- ${icon.filename} (${icon.size}x${icon.size})`).join('\n   ')}

For React Native/Capacitor:
- iOS: Place icons in ios/App/App/Assets.xcassets/AppIcon.appiconset/
- Android: Place icons in android/app/src/main/res/mipmap-*/
`;
};

console.log('[IconGenerator] Utility loaded. Use generateIconTags() to get HTML tags.');
