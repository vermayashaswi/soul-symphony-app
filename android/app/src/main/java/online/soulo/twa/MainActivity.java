package online.soulo.twa;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Handle notification click intent data
        handleIntentData(getIntent());
        
        // Configure immersive mode for status bar auto-hide
        setupImmersiveMode();
        
        // Listen for system UI visibility changes to maintain immersive mode
        setupSystemUIVisibilityListener();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle new intents (e.g., from notification clicks when app is already running)
        handleIntentData(intent);
    }

    private void handleIntentData(Intent intent) {
        if (intent != null && intent.getExtras() != null) {
            Bundle extras = intent.getExtras();
            
            // Check for FCM notification data
            String actionUrl = extras.getString("action_url");
            if (actionUrl != null && !actionUrl.isEmpty()) {
                // Navigate to the specified URL in the webview
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.location.href = '" + actionUrl + "';", null);
                });
            }
            
            // Handle deep link URIs
            Uri data = intent.getData();
            if (data != null) {
                String deepLink = data.toString();
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.location.href = '" + deepLink + "';", null);
                });
            }
        }
    }
    
    private void setupImmersiveMode() {
        // Enable immersive sticky mode WITHOUT LAYOUT_FULLSCREEN to prevent content under status bar
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
        
        // Additional window flags for proper status bar control
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
    }
    
    private void setupSystemUIVisibilityListener() {
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(
            new View.OnSystemUiVisibilityChangeListener() {
                @Override
                public void onSystemUiVisibilityChange(int visibility) {
                    // Re-enable immersive mode if system UI becomes visible
                    if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                        setupImmersiveMode();
                    }
                }
            }
        );
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Ensure immersive mode is maintained when app resumes
        setupImmersiveMode();
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            // Re-enable immersive mode when window gains focus
            setupImmersiveMode();
        }
    }
}
