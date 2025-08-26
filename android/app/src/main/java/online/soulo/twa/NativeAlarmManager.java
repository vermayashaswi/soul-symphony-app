package online.soulo.twa;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Calendar;
import java.util.TimeZone;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "NativeAlarmManager",
    permissions = {
        @Permission(
            strings = { android.Manifest.permission.POST_NOTIFICATIONS },
            alias = "notifications"
        )
    }
)
public class NativeAlarmManager extends Plugin {
    
    private static final String CHANNEL_ID = "journal_reminders";
    private static final int BASE_REQUEST_CODE = 1000;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1001;

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        Context context = getContext();
        
        // Check notification permission (Android 13+)
        boolean hasNotificationPermission = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasNotificationPermission = ContextCompat.checkSelfPermission(context, 
                android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        
        // Check exact alarm permission (Android 12+)
        boolean hasExactAlarmPermission = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            hasExactAlarmPermission = alarmManager.canScheduleExactAlarms();
        }
        
        result.put("hasNotificationPermission", hasNotificationPermission);
        result.put("hasExactAlarmPermission", hasExactAlarmPermission);
        result.put("androidVersion", Build.VERSION.SDK_INT);
        
        call.resolve(result);
    }
    
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Context context = getContext();
        
        // Check notification permission first (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                
                // Use Capacitor's built-in permission request
                requestAllPermissions(call, "notificationPermissionCallback");
                return;
            }
        }
        
        // If notification permission is granted or not needed, check exact alarm permission
        requestExactAlarmPermissionIfNeeded(call);
    }
    
    private void requestExactAlarmPermissionIfNeeded(PluginCall call) {
        Context context = getContext();
        
        // Check exact alarm permission (Android 12+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (!alarmManager.canScheduleExactAlarms()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
                    
                    // Store call for later resolution
                    saveCall(call);
                    
                    // Start activity and wait for result
                    startActivityForResult(call, intent, "handleExactAlarmResult");
                    return;
                } catch (Exception e) {
                    JSObject result = new JSObject();
                    result.put("granted", false);
                    call.resolve(result);
                    return;
                }
            }
        }
        
        // All permissions granted
        JSObject result = new JSObject();
        result.put("granted", true);
        call.resolve(result);
    }
    
    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        Context context = getContext();
        
        // Check if notification permission was granted
        boolean notificationGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationGranted = ContextCompat.checkSelfPermission(context, 
                android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        
        if (notificationGranted) {
            // Notification permission granted, now check exact alarm
            requestExactAlarmPermissionIfNeeded(call);
        } else {
            // Notification permission denied
            JSObject result = new JSObject();
            result.put("granted", false);
            call.resolve(result);
        }
    }
    
    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        
        PluginCall savedCall = getSavedCall();
        if (savedCall == null) {
            return;
        }
        
        // Check if exact alarm permission was granted
        Context context = getContext();
        boolean exactAlarmGranted = true;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            exactAlarmGranted = alarmManager.canScheduleExactAlarms();
        }
        
        JSObject result = new JSObject();
        result.put("granted", exactAlarmGranted);
        savedCall.resolve(result);
    }
    
    @PluginMethod
    public void scheduleNotification(PluginCall call) {
        try {
            String id = call.getString("id", "");
            String title = call.getString("title", "Journal Reminder");
            String body = call.getString("body", "Time to write in your journal!");
            String timeString = call.getString("time", ""); // Format: "HH:mm"
            
            if (timeString.isEmpty()) {
                call.reject("Time is required");
                return;
            }
            
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            
            // Create notification channel
            createNotificationChannel(context);
            
            // Parse time
            String[] timeParts = timeString.split(":");
            int hour = Integer.parseInt(timeParts[0]);
            int minute = Integer.parseInt(timeParts[1]);
            
            // Calculate next occurrence of this time
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, hour);
            calendar.set(Calendar.MINUTE, minute);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            
            // If time has passed today, schedule for tomorrow
            if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
                calendar.add(Calendar.DAY_OF_MONTH, 1);
            }
            
            // Create intent for notification
            Intent intent = new Intent(context, NotificationReceiver.class);
            intent.putExtra("id", id);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            
            int requestCode = BASE_REQUEST_CODE + Math.abs(id.hashCode()) % 1000;
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 
                requestCode, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            // Schedule exact alarm
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    calendar.getTimeInMillis(),
                    pendingIntent
                );
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    calendar.getTimeInMillis(),
                    pendingIntent
                );
            }
            
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
            String scheduledTime = sdf.format(new Date(calendar.getTimeInMillis()));
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("scheduledTime", scheduledTime);
            result.put("requestCode", requestCode);
            
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to schedule notification", e);
        }
    }
    
    @PluginMethod
    public void cancelNotification(PluginCall call) {
        try {
            String id = call.getString("id", "");
            
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            
            Intent intent = new Intent(context, NotificationReceiver.class);
            int requestCode = BASE_REQUEST_CODE + Math.abs(id.hashCode()) % 1000;
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 
                requestCode, 
                intent, 
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );
            
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to cancel notification", e);
        }
    }
    
    @PluginMethod
    public void cancelAllNotifications(PluginCall call) {
        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            
            // Cancel all possible request codes (1000-1999)
            for (int i = 0; i < 1000; i++) {
                Intent intent = new Intent(context, NotificationReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, 
                    BASE_REQUEST_CODE + i, 
                    intent, 
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                
                if (pendingIntent != null) {
                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel();
                }
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to cancel notifications", e);
        }
    }
    
    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Journal Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Daily reminders to write in your journal");
            channel.enableLights(true);
            channel.enableVibration(true);
            
            notificationManager.createNotificationChannel(channel);
        }
    }
}