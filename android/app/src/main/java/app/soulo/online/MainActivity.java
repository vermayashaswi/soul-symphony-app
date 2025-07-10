
package app.soulo.online;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize plugins
        this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
            // Add any additional plugins here if needed
        }});
    }
}
