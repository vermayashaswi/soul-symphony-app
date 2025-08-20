package online.soulo.twa;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configure immersive mode for status bar auto-hide
        setupImmersiveMode();
        
        // Listen for system UI visibility changes to maintain immersive mode
        setupSystemUIVisibilityListener();
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
    protected void onResume() {
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
