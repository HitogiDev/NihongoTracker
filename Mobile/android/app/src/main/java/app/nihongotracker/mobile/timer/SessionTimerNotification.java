package app.nihongotracker.mobile.timer;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import java.util.Locale;

import app.nihongotracker.mobile.MainActivity;
import app.nihongotracker.mobile.R;

/**
 * The ongoing notification of the session timer.
 * The system draws the live chronometer, so no service has to run.
 */
final class SessionTimerNotification {
    static final String CHANNEL = "session_timer";
    private static final int NOTIFICATION_ID = 4100;

    /**
     * The web app reads ACTION_VIEW links to this host as in-app routes.
     * See appLinkRoute in Frontend/src/native/NativeNavigation.tsx.
     */
    private static final String APP_LINK = "https://nihongotracker.app";

    private static final int REQUEST_OPEN = 4101;
    private static final int REQUEST_LOG = 4102;
    private static final int REQUEST_TOGGLE = 4103;

    private SessionTimerNotification() {}

    /** Show the notification for the stored session, or remove it when no session is active. */
    static void sync(Context context) {
        SessionTimerState state = SessionTimerState.load(context);
        if (state == null) {
            cancel(context);
        } else {
            show(context, state);
        }
    }

    static void show(Context context, SessionTimerState state) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        ensureChannel(context, state);
        if (!manager.areNotificationsEnabled()) return;

        long now = System.currentTimeMillis();
        long elapsed = state.elapsedMs(now);
        boolean running = state.running();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_timer)
                .setColor(ContextCompat.getColor(context, R.color.widget_accent))
                .setContentTitle(state.title())
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(open(context, "/session", REQUEST_OPEN));

        if (running) {
            builder.setUsesChronometer(true)
                    .setShowWhen(true)
                    .setWhen(now - elapsed)
                    .setContentText(state.label("running", "Session in progress"))
                    .addAction(0, state.label("pause", "Pause"),
                            toggle(context, SessionTimerReceiver.ACTION_PAUSE));
        } else {
            String paused = state.label("paused", "Paused: {time}").replace("{time}", format(elapsed));
            builder.setUsesChronometer(false)
                    .setShowWhen(false)
                    .setContentText(paused)
                    .addAction(0, state.label("resume", "Resume"),
                            toggle(context, SessionTimerReceiver.ACTION_RESUME));
        }
        builder.addAction(0, state.label("log", "Log"), open(context, "/session?log=1", REQUEST_LOG));

        try {
            manager.notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // The user can revoke the permission between the check and the call.
        }
    }

    static void cancel(Context context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
    }

    private static void ensureChannel(Context context, SessionTimerState state) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                state.label("channel", "Immersion timer"), NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    private static PendingIntent toggle(Context context, String action) {
        Intent intent = new Intent(context, SessionTimerReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(context, REQUEST_TOGGLE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Use an activity intent. Android 12 and later block activity starts from a receiver. */
    private static PendingIntent open(Context context, String route, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(APP_LINK + route));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String format(long elapsedMs) {
        long total = elapsedMs / 1000;
        long hours = total / 3600;
        long minutes = (total % 3600) / 60;
        long seconds = total % 60;
        if (hours > 0) return String.format(Locale.ROOT, "%d:%02d:%02d", hours, minutes, seconds);
        return String.format(Locale.ROOT, "%d:%02d", minutes, seconds);
    }
}
