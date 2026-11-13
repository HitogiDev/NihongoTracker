package app.nihongotracker.mobile.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.ContextCompat;

import app.nihongotracker.mobile.MainActivity;
import app.nihongotracker.mobile.R;

/** Shared helpers for the home screen widgets. */
final class Widgets {
    /**
     * The web app reads ACTION_VIEW links to this host as in-app routes.
     * See appLinkRoute in Frontend/src/native/NativeNavigation.tsx.
     */
    private static final String APP_LINK = "https://nihongotracker.app";

    private Widgets() {}

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        StreakWidgetProvider.update(context, manager,
                manager.getAppWidgetIds(new ComponentName(context, StreakWidgetProvider.class)));
        GoalsWidgetProvider.update(context, manager,
                manager.getAppWidgetIds(new ComponentName(context, GoalsWidgetProvider.class)));
    }

    /** Open the app on the route. A null route keeps the screen that the app shows. */
    static PendingIntent open(Context context, String route, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        if (route != null) {
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(APP_LINK + route));
        } else {
            intent.setAction(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static int color(Context context, int id) {
        return ContextCompat.getColor(context, id);
    }

    static int flameColor(Context context, WidgetSnapshot.StreakState state) {
        return color(context, state == WidgetSnapshot.StreakState.DONE
                ? R.color.widget_streak
                : R.color.widget_text_muted);
    }

    static String streakStatus(WidgetSnapshot snapshot) {
        switch (snapshot.streakState()) {
            case DONE:
                return snapshot.labels.loggedToday;
            case AT_RISK:
                return snapshot.labels.keepStreak;
            default:
                return snapshot.labels.startStreak;
        }
    }

    static String streakLabel(WidgetSnapshot snapshot, int streak) {
        return streak == 1 ? snapshot.labels.streakOne : snapshot.labels.streakOther;
    }

    static String levelLabel(WidgetSnapshot snapshot) {
        return snapshot.labels.level.replace("{level}", String.valueOf(snapshot.level));
    }
}
