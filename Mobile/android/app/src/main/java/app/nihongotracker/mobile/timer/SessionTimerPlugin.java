package app.nihongotracker.mobile.timer;

import android.Manifest;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Control the immersion session timer from the web app.
 * Keep the method names aligned with Frontend/src/native/sessionTimer.ts.
 */
@CapacitorPlugin(
        name = "NihongoSessionTimer",
        permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
)
public class SessionTimerPlugin extends Plugin {
    /** SharedPreferences keeps only a weak reference, so hold the listener here. */
    private SharedPreferences.OnSharedPreferenceChangeListener listener;

    @Override
    public void load() {
        listener = (prefs, key) -> notifyListeners("stateChange", stateResult());
        SessionTimerState.prefs(getContext()).registerOnSharedPreferenceChangeListener(listener);
    }

    @Override
    protected void handleOnDestroy() {
        if (listener != null) {
            SessionTimerState.prefs(getContext()).unregisterOnSharedPreferenceChangeListener(listener);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing data");
            return;
        }
        try {
            SessionTimerState state = SessionTimerState.start(getContext(), data, System.currentTimeMillis());
            SessionTimerNotification.show(getContext(), state);
            call.resolve(stateResult(state));
        } catch (JSONException error) {
            call.reject("Invalid data", error);
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        SessionTimerState state = SessionTimerState.load(getContext());
        if (state != null) {
            state.pause(System.currentTimeMillis());
            state.save(getContext());
            SessionTimerNotification.show(getContext(), state);
        }
        call.resolve(stateResult(state));
    }

    @PluginMethod
    public void resume(PluginCall call) {
        SessionTimerState state = SessionTimerState.load(getContext());
        if (state != null) {
            state.resume(System.currentTimeMillis());
            state.save(getContext());
            SessionTimerNotification.show(getContext(), state);
        }
        call.resolve(stateResult(state));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        SessionTimerState.clear(getContext());
        SessionTimerNotification.cancel(getContext());
        call.resolve(stateResult(null));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(stateResult());
    }

    /** Show the notification again, for example after a reboot or a language change. */
    @PluginMethod
    public void refresh(PluginCall call) {
        SessionTimerState state = SessionTimerState.load(getContext());
        String labels = call.getString("labels");
        if (state != null && labels != null) {
            try {
                state.setLabels(new JSONObject(labels));
                state.save(getContext());
            } catch (JSONException ignored) {
                // Keep the stored labels.
            }
        }
        SessionTimerNotification.sync(getContext());
        call.resolve(stateResult(state));
    }

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        call.resolve(permissionResult());
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(permissionResult());
        } else {
            requestPermissionForAlias("notifications", call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        call.resolve(permissionResult());
    }

    private JSObject permissionResult() {
        String status;
        if (NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            status = "granted";
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notifications") != PermissionState.DENIED) {
            status = "prompt";
        } else {
            status = "denied";
        }
        JSObject result = new JSObject();
        result.put("notifications", status);
        return result;
    }

    private JSObject stateResult() {
        return stateResult(SessionTimerState.load(getContext()));
    }

    private JSObject stateResult(SessionTimerState state) {
        JSObject result = new JSObject();
        if (state != null) result.put("state", state.json.toString());
        return result;
    }
}
