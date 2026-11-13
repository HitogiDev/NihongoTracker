package app.nihongotracker.mobile.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import app.nihongotracker.mobile.R;

/** Wide widget with the active daily and weekly goals and a button that opens Create Log. */
public class GoalsWidgetProvider extends AppWidgetProvider {
    private static final int OPEN_APP = 200;
    private static final int OPEN_LOG = 201;

    private static final int[] ROWS = {R.id.goal_row_1, R.id.goal_row_2, R.id.goal_row_3};
    private static final int[] LABELS = {R.id.goal_label_1, R.id.goal_label_2, R.id.goal_label_3};
    private static final int[] VALUES = {R.id.goal_value_1, R.id.goal_value_2, R.id.goal_value_3};
    private static final int[] BARS = {R.id.goal_bar_1, R.id.goal_bar_2, R.id.goal_bar_3};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        update(context, manager, ids);
    }

    static void update(Context context, AppWidgetManager manager, int[] ids) {
        if (ids.length == 0) return;
        WidgetSnapshot snapshot = WidgetSnapshot.load(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_goals);
        views.setOnClickPendingIntent(R.id.widget_root, Widgets.open(context, null, OPEN_APP));

        if (snapshot == null) {
            views.setViewVisibility(R.id.goals_add, View.GONE);
            views.setViewVisibility(R.id.goals_streak_group, View.GONE);
            views.setTextViewText(R.id.goals_title, context.getString(R.string.app_name));
            for (int row : ROWS) views.setViewVisibility(row, View.GONE);
            views.setViewVisibility(R.id.goals_message, View.VISIBLE);
            views.setTextViewText(R.id.goals_message, context.getString(R.string.widget_sign_in));
            for (int id : ids) manager.updateAppWidget(id, views);
            return;
        }

        views.setViewVisibility(R.id.goals_add, View.VISIBLE);
        views.setOnClickPendingIntent(R.id.goals_add, Widgets.open(context, "/log", OPEN_LOG));
        views.setTextViewText(R.id.goals_title, snapshot.labels.today);
        int streak = snapshot.liveStreak();
        int flame = Widgets.flameColor(context, snapshot.streakState());
        views.setViewVisibility(R.id.goals_streak_group, View.VISIBLE);
        views.setTextViewText(R.id.goals_streak, String.valueOf(streak));
        views.setTextColor(R.id.goals_streak, flame);
        views.setInt(R.id.goals_flame, "setColorFilter", flame);

        int shown = Math.min(ROWS.length, snapshot.goals.size());
        boolean allDone = shown > 0;
        for (int i = 0; i < ROWS.length; i++) {
            if (i >= shown) {
                views.setViewVisibility(ROWS[i], View.GONE);
                continue;
            }
            WidgetSnapshot.Goal goal = snapshot.goals.get(i);
            double progress = snapshot.liveProgress(goal);
            double ratio = goal.target > 0 ? WidgetSnapshot.clamp(progress / goal.target) : 0;
            boolean done = goal.target > 0 && progress >= goal.target;
            allDone &= done;
            views.setViewVisibility(ROWS[i], View.VISIBLE);
            views.setTextViewText(LABELS[i], goal.label);
            views.setTextViewText(VALUES[i], WidgetSnapshot.formatAmount(progress, goal.type)
                    + " / " + WidgetSnapshot.formatAmount(goal.target, goal.type));
            views.setTextColor(VALUES[i], Widgets.color(context,
                    done ? R.color.widget_success : R.color.widget_text_muted));
            views.setProgressBar(BARS[i], 1000, (int) Math.round(ratio * 1000), false);
        }

        if (shown == 0) {
            views.setViewVisibility(R.id.goals_message, View.VISIBLE);
            views.setTextViewText(R.id.goals_message, snapshot.labels.noGoals);
        } else if (allDone && snapshot.goals.size() <= ROWS.length) {
            views.setViewVisibility(R.id.goals_message, View.VISIBLE);
            views.setTextViewText(R.id.goals_message, snapshot.labels.allDone);
        } else {
            views.setViewVisibility(R.id.goals_message, View.GONE);
        }
        for (int id : ids) manager.updateAppWidget(id, views);
    }
}
