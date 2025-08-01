package app.soulo.online;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.os.Handler;
import android.os.Looper;
import android.content.res.Configuration;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.os.Build;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StatusBarController")
public class MainActivity extends BridgeActivity {
    
    private Handler autoHideHandler;
    private Runnable autoHideRunnable;
    private boolean isStatusBarVisible = false;
    private boolean isAutoHideEnabled = true;
    private static final int AUTO_HIDE_DELAY_MILLIS = 3000;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable fullscreen and immersive mode
        enableFullscreenMode();
        
        // Initialize auto-hide functionality
        initializeAutoHide();
        
        // Set up system UI visibility listener
        setupSystemUiVisibilityListener();
        
        // Register plugin methods
        registerPlugin(StatusBarControllerPlugin.class);
    }
    
    private void enableFullscreenMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30+)
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            // Legacy Android versions
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
        
        // Additional window flags
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams layoutParams = getWindow().getAttributes();
            layoutParams.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(layoutParams);
        }
    }
    
    private void initializeAutoHide() {
        autoHideHandler = new Handler(Looper.getMainLooper());
        autoHideRunnable = new Runnable() {
            @Override
            public void run() {
                if (isAutoHideEnabled && isStatusBarVisible) {
                    hideSystemUI();
                }
            }
        };
    }
    
    private void setupSystemUiVisibilityListener() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(new View.OnSystemUiVisibilityChangeListener() {
                @Override
                public void onSystemUiVisibilityChange(int visibility) {
                    isStatusBarVisible = (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0;
                    if (isStatusBarVisible && isAutoHideEnabled) {
                        scheduleAutoHide();
                    }
                }
            });
        }
    }
    
    private void scheduleAutoHide() {
        autoHideHandler.removeCallbacks(autoHideRunnable);
        autoHideHandler.postDelayed(autoHideRunnable, AUTO_HIDE_DELAY_MILLIS);
    }
    
    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
        isStatusBarVisible = false;
    }
    
    private void showSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
        isStatusBarVisible = true;
        if (isAutoHideEnabled) {
            scheduleAutoHide();
        }
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableFullscreenMode();
            if (isAutoHideEnabled) {
                scheduleAutoHide();
            }
        }
    }
    
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        enableFullscreenMode();
        if (isAutoHideEnabled) {
            scheduleAutoHide();
        }
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        enableFullscreenMode();
        if (isAutoHideEnabled) {
            scheduleAutoHide();
        }
    }
    
    // Plugin class for JavaScript interaction
    @CapacitorPlugin(name = "StatusBarController")
    public static class StatusBarControllerPlugin extends Plugin {
        
        @PluginMethod
        public void enableAutoHide(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            activity.isAutoHideEnabled = true;
            activity.scheduleAutoHide();
            call.resolve();
        }
        
        @PluginMethod
        public void disableAutoHide(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            activity.isAutoHideEnabled = false;
            activity.autoHideHandler.removeCallbacks(activity.autoHideRunnable);
            call.resolve();
        }
        
        @PluginMethod
        public void showStatusBar(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            activity.showSystemUI();
            call.resolve();
        }
        
        @PluginMethod
        public void hideStatusBar(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            activity.hideSystemUI();
            call.resolve();
        }
        
        @PluginMethod
        public void resetAutoHideTimer(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            if (activity.isAutoHideEnabled) {
                activity.scheduleAutoHide();
            }
            call.resolve();
        }
    }
}
