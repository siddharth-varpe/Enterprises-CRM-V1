package com.srenterprises.crm.tracking;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Capacitor Bridge Plugin for Native Technician Background Location Tracking.
 * Exposes methods to start/stop the Android Foreground Location Service and query its live status.
 */
@CapacitorPlugin(
        name = "TechnicianTracking",
        permissions = {
                @Permission(
                        alias = "location",
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }
                ),
                @Permission(
                        alias = "notifications",
                        strings = {
                                Manifest.permission.POST_NOTIFICATIONS
                        }
                )
        }
)
public class TechnicianTrackingPlugin extends Plugin {

    private static final String TAG = "TechTrackingPlugin";

    @PluginMethod
    public void startTracking(PluginCall call) {
        String apiUrl = call.getString("apiUrl");
        String token = call.getString("token");
        String serviceId = call.getString("serviceId");
        String technicianName = call.getString("technicianName", "Technician");

        if (apiUrl == null || token == null || serviceId == null) {
            call.reject("MISSING_PARAMETERS", "apiUrl, token, and serviceId are required");
            return;
        }

        // Verify Location Permission
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("PERMISSION_REQUIRED", "Location permission is required to start live navigation tracking");
            return;
        }

        // Verify Device Location Services are switched on
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        boolean gpsEnabled = false;
        boolean networkEnabled = false;
        try {
            gpsEnabled = lm != null && lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
            networkEnabled = lm != null && lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception ignored) {}

        if (!gpsEnabled && !networkEnabled) {
            call.reject("LOCATION_SERVICES_DISABLED", "Device location (GPS) is turned off. Please enable GPS in device settings.");
            return;
        }

        try {
            Intent intent = new Intent(getContext(), TechnicianLocationService.class);
            intent.setAction(TechnicianLocationService.ACTION_START);
            intent.putExtra(TechnicianLocationService.EXTRA_API_URL, apiUrl);
            intent.putExtra(TechnicianLocationService.EXTRA_TOKEN, token);
            intent.putExtra(TechnicianLocationService.EXTRA_SERVICE_ID, serviceId);
            intent.putExtra(TechnicianLocationService.EXTRA_TECH_NAME, technicianName);

            ContextCompat.startForegroundService(getContext(), intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("status", "TRACKING");
            ret.put("serviceId", serviceId);
            call.resolve(ret);
            Log.i(TAG, "Native foreground tracking successfully requested for service: " + serviceId);
        } catch (Exception e) {
            Log.e(TAG, "Error starting native foreground location service: " + e.getMessage(), e);
            call.reject("SERVICE_START_FAILED", e.getMessage());
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), TechnicianLocationService.class);
            intent.setAction(TechnicianLocationService.ACTION_STOP);
            getContext().startService(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("status", "STOPPED");
            call.resolve(ret);
            Log.i(TAG, "Native foreground tracking stopped.");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping native foreground location service: " + e.getMessage(), e);
            call.reject("SERVICE_STOP_FAILED", e.getMessage());
        }
    }

    @PluginMethod
    public void getTrackingStatus(PluginCall call) {
        JSObject ret = new JSObject();
        boolean isRunning = TechnicianLocationService.isServiceRunning();
        String status = TechnicianLocationService.getCurrentStatus();
        String activeServiceId = TechnicianLocationService.getActiveServiceId();
        long lastUpdate = TechnicianLocationService.getLastLocationTimestamp();

        ret.put("isRunning", isRunning);
        ret.put("status", status);
        ret.put("activeServiceId", activeServiceId != null ? activeServiceId : "");
        ret.put("lastUpdate", lastUpdate);

        call.resolve(ret);
    }

    @PluginMethod
    public void requestTrackingPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAliases(new String[]{"location", "notifications"}, call, "trackingPermissionsCallback");
        } else {
            requestPermissionForAlias("location", call, "trackingPermissionsCallback");
        }
    }

    @PermissionCallback
    private void trackingPermissionsCallback(PluginCall call) {
        boolean locationGranted = getPermissionState("location") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("locationGranted", locationGranted);
        ret.put("status", locationGranted ? "GRANTED" : "DENIED");
        call.resolve(ret);
    }
}
