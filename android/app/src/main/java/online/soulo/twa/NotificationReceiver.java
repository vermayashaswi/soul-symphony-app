package online.soulo.twa;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;

public class NotificationReceiver extends BroadcastReceiver {
    
    private static final String CHANNEL_ID = "journal_reminders";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        
        if (id == null || title == null || body == null) {
            return;
        }
        
        NotificationManager notificationManager = 
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL);
        
        int notificationId = Math.abs(id.hashCode());
        notificationManager.notify(notificationId, builder.build());
        
        // Schedule next day's notification
        scheduleNextDayNotification(context, intent);
    }
    
    private void scheduleNextDayNotification(Context context, Intent originalIntent) {
        // Extract time and reschedule for next day
        String id = originalIntent.getStringExtra("id");
        String title = originalIntent.getStringExtra("title");
        String body = originalIntent.getStringExtra("body");
        
        // This will be handled by the NativeAlarmManager plugin
        // when the app is next opened and scheduleNotification is called again
    }
}