package online.soulo.twa;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

public class NotificationChannelSetup {
    
    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            
            // Journal Reminders Channel
            NotificationChannel journalChannel = new NotificationChannel(
                "journal_reminders",
                "Journal Reminders", 
                NotificationManager.IMPORTANCE_HIGH
            );
            journalChannel.setDescription("Daily reminders to write in your journal");
            journalChannel.enableLights(true);
            journalChannel.enableVibration(true);
            journalChannel.setLockscreenVisibility(NotificationChannel.VISIBILITY_PUBLIC);
            
            notificationManager.createNotificationChannel(journalChannel);
        }
    }
}