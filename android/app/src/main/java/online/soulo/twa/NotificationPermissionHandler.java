package online.soulo.twa;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationPermissionHandler")
public class NotificationPermissionHandler extends Plugin {
    
    private static final int REQUEST_CODE_EXACT_ALARM = 1001;
    private static final int REQUEST_CODE_NOTIFICATION = 1002;
    private static final int REQUEST_CODE_BATTERY_OPTIMIZATION = 1003;
    
    @PluginMethod
    public void checkAndRequestPermissions(PluginCall call) {
        Context context = getContext();
        
        // Check notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(), 
                    new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 
                    REQUEST_CODE_NOTIFICATION);
            }
        }
        
        // Check exact alarm permission (Android 12+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                getActivity().startActivityForResult(intent, REQUEST_CODE_EXACT_ALARM);
            }
        }
        
        // Check battery optimization
        checkBatteryOptimization(call);
    }
    
    @PluginMethod
    public void checkBatteryOptimization(PluginCall call) {
        Context context = getContext();
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && powerManager != null) {
            boolean isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
            
            if (!isIgnoringBatteryOptimizations) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                getActivity().startActivityForResult(intent, REQUEST_CODE_BATTERY_OPTIMIZATION);
            }
            
            call.resolve();
        } else {
            call.resolve();
        }
    }
    
    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        Context context = getContext();
        
        // Check notification permission
        boolean hasNotificationPermission = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasNotificationPermission = ContextCompat.checkSelfPermission(context, 
                android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        
        // Check exact alarm permission
        boolean hasExactAlarmPermission = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            hasExactAlarmPermission = alarmManager != null && alarmManager.canScheduleExactAlarms();
        }
        
        // Check battery optimization
        boolean isIgnoringBatteryOptimizations = true;
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && powerManager != null) {
            isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
        }
        
        // Return status
        call.resolve(new com.getcapacitor.JSObject()
            .put("hasNotificationPermission", hasNotificationPermission)
            .put("hasExactAlarmPermission", hasExactAlarmPermission)
            .put("isIgnoringBatteryOptimizations", isIgnoringBatteryOptimizations)
            .put("androidVersion", Build.VERSION.SDK_INT));
    }
}