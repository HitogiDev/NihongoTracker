package app.nihongotracker.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import app.nihongotracker.mobile.timer.SessionTimerPlugin;
import app.nihongotracker.mobile.widgets.WidgetsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register local plugins before the bridge starts.
        registerPlugin(WidgetsPlugin.class);
        registerPlugin(SessionTimerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
