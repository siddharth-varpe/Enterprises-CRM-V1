package com.srenterprises.crm;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.srenterprises.crm.tracking.TechnicianTrackingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TechnicianTrackingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
