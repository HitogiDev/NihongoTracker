package app.nihongotracker.mobile.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import app.nihongotracker.mobile.R;

/** Small widget with the current streak and the level progress. */
public class StreakWidgetProvider extends AppWidgetProvider {
    private static final int OPEN_APP = 100;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        update(context, manager, ids);
    }

    static void update(Context context, AppWidgetManager manager, int[] ids) {
        if (ids.length == 0) return;
        WidgetSnapshot snapshot = WidgetSnapshot.load(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_streak);
        views.setOnClickPendingIntent(R.id.widget_root, Widgets.open(context, null, OPEN_APP));

        boolean signedIn = snapshot != null;
        views.setViewVisibility(R.id.streak_content, signedIn ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.streak_signed_out, signedIn ? View.GONE : View.VISIBLE);
        if (signedIn) {
            int streak = snapshot.liveStreak();
            views.setTextViewText(R.id.streak_count, String.valueOf(streak));
            views.setTextViewText(R.id.streak_label, Widgets.streakLabel(snapshot, streak));
            views.setTextViewText(R.id.streak_status, Widgets.streakStatus(snapshot));
            views.setInt(R.id.streak_flame, "setColorFilter",
                    Widgets.flameColor(context, snapshot.streakState()));
            views.setTextViewText(R.id.streak_level, Widgets.levelLabel(snapshot));
            views.setProgressBar(R.id.streak_level_progress, 1000,
                    (int) Math.round(snapshot.levelProgress * 1000), false);
        }
        for (int id : ids) manager.updateAppWidget(id, views);
    }
}
