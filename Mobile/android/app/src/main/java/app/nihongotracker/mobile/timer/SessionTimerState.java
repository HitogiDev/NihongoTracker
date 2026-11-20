package app.nihongotracker.mobile.timer;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * The immersion session timer. This stored state is the source of truth.
 * Elapsed time comes from the wall clock, so it survives when the system stops the app.
 * Keep the JSON fields aligned with Frontend/src/native/sessionTimer.ts.
 */
final class SessionTimerState {
    static final String PREFS = "nihongo_session_timer";
    static final String KEY = "state";

    final JSONObject json;

    private SessionTimerState(JSONObject json) {
        this.json = json;
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Return null when no session is active or the stored data is not valid. */
    static SessionTimerState load(Context context) {
        String raw = prefs(context).getString(KEY, null);
        if (raw == null) return null;
        try {
            JSONObject json = new JSONObject(raw);
            if (json.optJSONObject("media") == null) return null;
            return new SessionTimerState(json);
        } catch (JSONException error) {
            return null;
        }
    }

    /** Start a new session from the data that the web app sends. */
    static SessionTimerState start(Context context, String data, long now) throws JSONException {
        JSONObject json = new JSONObject(data);
        if (json.optJSONObject("media") == null) throw new JSONException("Missing media");
        json.put("accumulatedMs", 0);
        json.put("runningSince", now);
        json.put("startedAt", now);
        SessionTimerState state = new SessionTimerState(json);
        state.save(context);
        return state;
    }

    static void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
    }

    void save(Context context) {
        prefs(context).edit().putString(KEY, json.toString()).apply();
    }

    boolean running() {
        return !json.isNull("runningSince") && json.optLong("runningSince", 0) > 0;
    }

    long elapsedMs(long now) {
        long accumulated = Math.max(0, json.optLong("accumulatedMs", 0));
        if (!running()) return accumulated;
        return accumulated + Math.max(0, now - json.optLong("runningSince", now));
    }

    void pause(long now) {
        if (!running()) return;
        try {
            json.put("accumulatedMs", elapsedMs(now));
            json.put("runningSince", JSONObject.NULL);
        } catch (JSONException ignored) {
            // Keys and values are always valid here.
        }
    }

    void resume(long now) {
        if (running()) return;
        try {
            json.put("runningSince", now);
        } catch (JSONException ignored) {
            // Keys and values are always valid here.
        }
    }

    void setLabels(JSONObject labels) {
        try {
            json.put("labels", labels);
        } catch (JSONException ignored) {
            // Keys and values are always valid here.
        }
    }

    String title() {
        return json.optString("title", "");
    }

    /** Return the localized label from the web app, or the English default. */
    String label(String key, String fallback) {
        JSONObject labels = json.optJSONObject("labels");
        if (labels == null) return fallback;
        String value = labels.optString(key, "");
        return value.isEmpty() ? fallback : value;
    }
}
