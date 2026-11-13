package app.nihongotracker.mobile.widgets;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Account summary that the web app writes for the home screen widgets.
 * The web app sends one JSON document. The widgets read it without network access.
 */
final class WidgetSnapshot {
    private static final String PREFS = "nihongo_widgets";
    private static final String KEY = "snapshot";
    private static final long HOUR_MS = 60L * 60L * 1000L;

    static final class Goal {
        String label;
        String type;
        String cadence;
        double progress;
        double target;
    }

    static final class Labels {
        String streakOne = "day streak";
        String streakOther = "day streak";
        String loggedToday = "Logged today";
        String keepStreak = "Log today to keep your streak";
        String startStreak = "Log today to start a streak";
        String level = "Level {level}";
        String today = "Today";
        String noGoals = "No goals yet. Create one in the app.";
        String allDone = "All goals done";
    }

    String timezone;
    int dayStartHour;
    int weekStartsOn;
    String dayKey;
    String weekKey;
    int streak;
    String lastStreakDay;
    int level;
    double levelProgress;
    final List<Goal> goals = new ArrayList<>();
    final Labels labels = new Labels();

    static void save(Context context, String json) {
        prefs(context).edit().putString(KEY, json).apply();
    }

    static void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
    }

    /** Return null when no account is signed in or the stored data is not valid. */
    static WidgetSnapshot load(Context context) {
        String json = prefs(context).getString(KEY, null);
        if (json == null) return null;
        try {
            return parse(new JSONObject(json));
        } catch (JSONException e) {
            return null;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static WidgetSnapshot parse(JSONObject json) throws JSONException {
        WidgetSnapshot s = new WidgetSnapshot();
        s.timezone = json.optString("timezone", TimeZone.getDefault().getID());
        s.dayStartHour = json.optInt("dayStartHour", 0);
        s.weekStartsOn = json.optInt("weekStartsOn", 1);
        s.dayKey = json.getString("dayKey");
        s.weekKey = json.getString("weekKey");
        s.streak = json.optInt("streak", 0);
        s.lastStreakDay = json.optString("lastStreakDay", "");
        s.level = json.optInt("level", 1);
        s.levelProgress = clamp(json.optDouble("levelProgress", 0));
        JSONArray goals = json.optJSONArray("goals");
        if (goals != null) {
            for (int i = 0; i < goals.length(); i++) {
                JSONObject item = goals.getJSONObject(i);
                Goal goal = new Goal();
                goal.label = item.optString("label", "");
                goal.type = item.optString("type", "time");
                goal.cadence = item.optString("cadence", "daily");
                goal.progress = item.optDouble("progress", 0);
                goal.target = item.optDouble("target", 0);
                s.goals.add(goal);
            }
        }
        JSONObject labels = json.optJSONObject("labels");
        if (labels != null) {
            Labels l = s.labels;
            l.streakOne = labels.optString("streakOne", l.streakOne);
            l.streakOther = labels.optString("streakOther", l.streakOther);
            l.loggedToday = labels.optString("loggedToday", l.loggedToday);
            l.keepStreak = labels.optString("keepStreak", l.keepStreak);
            l.startStreak = labels.optString("startStreak", l.startStreak);
            l.level = labels.optString("level", l.level);
            l.today = labels.optString("today", l.today);
            l.noGoals = labels.optString("noGoals", l.noGoals);
            l.allDone = labels.optString("allDone", l.allDone);
        }
        return s;
    }

    /** Streak state on the current day. */
    enum StreakState { DONE, AT_RISK, LOST }

    StreakState streakState() {
        String today = dayKeyAt(System.currentTimeMillis(), 0);
        if (streak <= 0 || lastStreakDay.isEmpty()) return StreakState.LOST;
        if (lastStreakDay.equals(today)) return StreakState.DONE;
        if (lastStreakDay.equals(dayKeyAt(System.currentTimeMillis(), -1))) return StreakState.AT_RISK;
        return StreakState.LOST;
    }

    int liveStreak() {
        return streakState() == StreakState.LOST ? 0 : streak;
    }

    /**
     * Return the goal progress for the current period.
     * A daily value is zero after the day changes. A weekly value is zero after the week changes.
     */
    double liveProgress(Goal goal) {
        long now = System.currentTimeMillis();
        String current = "weekly".equals(goal.cadence) ? weekKeyAt(now) : dayKeyAt(now, 0);
        String stored = "weekly".equals(goal.cadence) ? weekKey : dayKey;
        return current.equals(stored) ? goal.progress : 0;
    }

    private Calendar userDay(long time, int dayOffset) {
        Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone(timezone), Locale.US);
        calendar.setTimeInMillis(time - dayStartHour * HOUR_MS);
        calendar.add(Calendar.DAY_OF_MONTH, dayOffset);
        return calendar;
    }

    private String format(Calendar calendar) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(calendar.getTimeZone());
        return format.format(calendar.getTime());
    }

    String dayKeyAt(long time, int dayOffset) {
        return format(userDay(time, dayOffset));
    }

    String weekKeyAt(long time) {
        Calendar calendar = userDay(time, 0);
        int weekday = calendar.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY;
        calendar.add(Calendar.DAY_OF_MONTH, -((weekday - weekStartsOn + 7) % 7));
        return format(calendar);
    }

    static double clamp(double value) {
        if (Double.isNaN(value)) return 0;
        return Math.max(0, Math.min(1, value));
    }

    static String formatAmount(double value, String type) {
        if ("time".equals(type)) {
            long minutes = Math.round(value);
            if (minutes < 60) return minutes + "min";
            long rest = minutes % 60;
            return rest > 0 ? (minutes / 60) + "h " + rest + "min" : (minutes / 60) + "h";
        }
        if ("chars".equals(type)) {
            if (value >= 1_000_000) return trim(value / 1_000_000) + "M";
            if (value >= 10_000) return Math.round(value / 1000) + "k";
            if (value >= 1000) return trim(value / 1000) + "k";
        }
        return String.valueOf(Math.round(value));
    }

    private static String trim(double value) {
        String text = String.format(Locale.US, "%.1f", value);
        return text.endsWith(".0") ? text.substring(0, text.length() - 2) : text;
    }
}
