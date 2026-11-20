package app.nihongotracker.mobile.timer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Pause or resume the session from the notification, also when the app is closed. */
public class SessionTimerReceiver extends BroadcastReceiver {
    static final String ACTION_PAUSE = "app.nihongotracker.mobile.timer.PAUSE";
    static final String ACTION_RESUME = "app.nihongotracker.mobile.timer.RESUME";

    @Override
    public void onReceive(Context context, Intent intent) {
        SessionTimerState state = SessionTimerState.load(context);
        if (state == null) {
            SessionTimerNotification.cancel(context);
            return;
        }
        long now = System.currentTimeMillis();
        String action = intent.getAction();
        if (ACTION_PAUSE.equals(action)) {
            state.pause(now);
        } else if (ACTION_RESUME.equals(action)) {
            state.resume(now);
        } else {
            return;
        }
        state.save(context);
        SessionTimerNotification.show(context, state);
    }
}
