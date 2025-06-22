
# TWA Configuration for Microphone Permissions

This directory contains the configuration files needed to properly set up microphone permissions for the Soulo TWA (Trusted Web Activity) app using Google Bubblewrap.

## Files

- `bubblewrap-template.json` - Template configuration for Bubblewrap with proper microphone permissions
- `README.md` - This file with setup instructions

## Setup Instructions

### 1. Install Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
```

### 2. Initialize Bubblewrap Project

```bash
bubblewrap init --manifest https://soulo.online/app/manifest.json
```

### 3. Update Configuration

Replace the generated `twa-manifest.json` with the configuration from `bubblewrap-template.json`, making sure to:

1. Replace `YOUR_SHA256_FINGERPRINT_HERE` with your actual SHA256 fingerprint
2. Update any package names or URLs if different

### 4. Key Permissions Added

The configuration includes these critical permissions for microphone access:

- `android.permission.RECORD_AUDIO` - Required for microphone access
- `android.permission.MODIFY_AUDIO_SETTINGS` - For audio quality optimization
- `android.hardware.microphone` - Hardware requirement declaration
- `android.hardware.audio.low_latency` - Optional for better audio quality

### 5. Build the TWA

```bash
bubblewrap build
```

### 6. Test Microphone Permissions

After installing the generated APK:

1. Open the app
2. Try to record audio
3. The system should prompt for microphone permission
4. If permission is denied, the app will show options to open settings

## Troubleshooting

### Permission Not Requested

If the microphone permission is not requested:

1. Check that `RECORD_AUDIO` permission is in the AndroidManifest.xml
2. Verify the hardware feature declaration is present
3. Ensure the app targets a recent Android API level

### Permission Denied Permanently

If users deny permission permanently:

1. The app will detect this state
2. Users will see instructions to open settings
3. The app includes a button to open the app settings page

### Testing Permissions

To test permission handling:

1. Install the APK on a test device
2. Try recording audio - should prompt for permission
3. Deny permission - should show settings option
4. Go to Android Settings > Apps > Soulo > Permissions
5. Enable microphone permission
6. Return to app - should work without prompting again

## Notes

- The TWA will inherit the web app's permission handling logic
- The native Android permissions are required for the microphone API to work
- Users can revoke permissions at any time through system settings
- The app gracefully handles all permission states (granted, denied, prompt)
