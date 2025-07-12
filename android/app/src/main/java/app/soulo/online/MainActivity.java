package app.soulo.online;

import com.getcapacitor.BridgeActivity;
import com.codetrix.studio.CapacitorGoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(GoogleAuth.class);
    }
}