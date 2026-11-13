package app.nihongotracker.mobile.widgets;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receive the widget summary from the web app.
 * Keep the method names aligned with Frontend/src/native/widgets.ts.
 */
@CapacitorPlugin(name = "NihongoWidgets")
public class WidgetsPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing data");
            return;
        }
        WidgetSnapshot.save(getContext(), data);
        Widgets.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        WidgetSnapshot.clear(getContext());
        Widgets.updateAll(getContext());
        call.resolve();
    }
}
