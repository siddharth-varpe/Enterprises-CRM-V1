package com.srenterprises.crm.tracking;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.srenterprises.crm.MainActivity;
import com.srenterprises.crm.R;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native Android Foreground Location Service for Field Technicians.
 *
 * Runs as a foreground service with type "location" and persistent ongoing notification.
 * Captures real hardware GPS coordinates and transmits them directly to the CRM backend
 * while Google Maps is active and while the screen is locked.
 */
public class TechnicianLocationService extends Service implements LocationListener {

    private static final String TAG = "TechLocationService";
    public static final String ACTION_START = "com.srenterprises.crm.tracking.ACTION_START";
    public static final String ACTION_STOP = "com.srenterprises.crm.tracking.ACTION_STOP";

    public static final String EXTRA_API_URL = "apiUrl";
    public static final String EXTRA_TOKEN = "token";
    public static final String EXTRA_SERVICE_ID = "serviceId";
    public static final String EXTRA_TECH_NAME = "technicianName";

    private static final String CHANNEL_ID = "crm_technician_tracking_channel";
    private static final int NOTIFICATION_ID = 2026;

    // Minimum intervals: 10 seconds or 5 meters displacement
    private static final long MIN_TIME_MS = 10000;
    private static final float MIN_DISTANCE_M = 5.0f;

    // Static lifecycle state accessible by Capacitor Plugin
    private static volatile boolean isRunning = false;
    private static volatile String currentStatus = "STOPPED";
    private static volatile String activeServiceId = null;
    private static volatile long lastLocationTimestamp = 0;

    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private ExecutorService networkExecutor;

    private String apiUrl;
    private String navSessionToken;
    private String serviceId;
    private String technicianName;

    private Location lastSentLocation;
    private long lastSendTimeMs = 0;

    public static boolean isServiceRunning() {
        return isRunning;
    }

    public static String getCurrentStatus() {
        return currentStatus;
    }

    public static String getActiveServiceId() {
        return activeServiceId;
    }

    public static long getLastLocationTimestamp() {
        return lastLocationTimestamp;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        networkExecutor = Executors.newSingleThreadExecutor();

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "EnterprisesCRM:LocationWakeLock");
            wakeLock.setReferenceCounted(false);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        if (ACTION_STOP.equals(action)) {
            Log.i(TAG, "Stopping foreground location service per ACTION_STOP");
            stopTracking();
            return START_NOT_STICKY;
        }

        if (ACTION_START.equals(action)) {
            apiUrl = intent.getStringExtra(EXTRA_API_URL);
            navSessionToken = intent.getStringExtra(EXTRA_TOKEN);
            serviceId = intent.getStringExtra(EXTRA_SERVICE_ID);
            technicianName = intent.getStringExtra(EXTRA_TECH_NAME);

            if (apiUrl == null || navSessionToken == null || serviceId == null) {
                Log.e(TAG, "Missing required parameters for location tracking service. Stopping.");
                stopSelf();
                return START_NOT_STICKY;
            }

            // Normalise API URL: ensure no trailing slash
            if (apiUrl.endsWith("/")) {
                apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
            }

            startTracking();
            return START_STICKY;
        }

        return START_NOT_STICKY;
    }

    private void startTracking() {
        try {
            createNotificationChannel();
            Notification notification = buildForegroundNotification();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }

            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(120 * 60 * 1000L); // 2 hours max safe timeout
            }

            registerLocationUpdates();

            isRunning = true;
            currentStatus = "TRACKING";
            activeServiceId = serviceId;
            Log.i(TAG, "Foreground location service started for service: " + serviceId);

            // Fetch last known location for immediate ping
            Location lastKnownGps = null;
            try {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lastKnownGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                }
                if (lastKnownGps == null && locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lastKnownGps = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                }
            } catch (SecurityException se) {
                Log.w(TAG, "SecurityException reading last known location: " + se.getMessage());
            }

            if (lastKnownGps != null) {
                transmitLocation(lastKnownGps);
            }

        } catch (Exception e) {
            Log.e(TAG, "Failed to start location foreground service: " + e.getMessage(), e);
            currentStatus = "SERVICE_ERROR";
            stopTracking();
        }
    }

    private void registerLocationUpdates() {
        try {
            boolean gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            boolean networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);

            if (!gpsEnabled && !networkEnabled) {
                Log.w(TAG, "Neither GPS nor Network location provider is enabled on this device.");
                currentStatus = "LOCATION_UNAVAILABLE";
                return;
            }

            if (gpsEnabled) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        MIN_TIME_MS,
                        MIN_DISTANCE_M,
                        this
                );
            }

            if (networkEnabled) {
                locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        MIN_TIME_MS,
                        MIN_DISTANCE_M,
                        this
                );
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Location permission not granted: " + se.getMessage(), se);
            currentStatus = "PERMISSION_REQUIRED";
            stopTracking();
        }
    }

    private void stopTracking() {
        isRunning = false;
        currentStatus = "STOPPED";
        activeServiceId = null;

        try {
            if (locationManager != null) {
                locationManager.removeUpdates(this);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error removing location updates: " + e.getMessage());
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }

        stopSelf();
        Log.i(TAG, "Foreground location service cleanly terminated.");
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        // Coordinates sanity check
        double lat = location.getLatitude();
        double lng = location.getLongitude();
        if (lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) {
            Log.w(TAG, "Discarding out-of-bounds coordinates: " + lat + ", " + lng);
            return;
        }

        // Throttle check: require at least 5 seconds between network posts unless moved > 15 meters
        long now = System.currentTimeMillis();
        if (lastSentLocation != null) {
            long elapsedSec = (now - lastSendTimeMs) / 1000;
            float movedM = lastSentLocation.distanceTo(location);
            if (elapsedSec < 5 && movedM < 15.0f) {
                return;
            }
        }

        transmitLocation(location);
    }

    private void transmitLocation(Location location) {
        final double lat = location.getLatitude();
        final double lng = location.getLongitude();
        final float accuracy = location.hasAccuracy() ? location.getAccuracy() : 10.0f;
        final Float heading = location.hasBearing() ? location.getBearing() : null;
        final Float speed = location.hasSpeed() ? location.getSpeed() : null;
        final long timestamp = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();

        networkExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                String endpoint = apiUrl + "/maps/technician/location";
                URL url = new URL(endpoint);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + navSessionToken);

                JSONObject payload = new JSONObject();
                payload.put("latitude", lat);
                payload.put("longitude", lng);
                payload.put("accuracy", (double) accuracy);
                if (heading != null) payload.put("heading", (double) heading);
                if (speed != null) payload.put("speed", (double) speed);
                payload.put("timestamp", timestamp);

                byte[] bodyBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(bodyBytes.length);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bodyBytes);
                    os.flush();
                }

                int responseCode = conn.getResponseCode();
                if (responseCode >= 200 && responseCode < 300) {
                    lastSentLocation = location;
                    lastSendTimeMs = System.currentTimeMillis();
                    lastLocationTimestamp = lastSendTimeMs;
                    currentStatus = "TRACKING";
                    Log.d(TAG, "GPS location fix uploaded successfully: " + lat + ", " + lng);
                } else if (responseCode == 401) {
                    Log.w(TAG, "Backend returned 401 Unauthorized: Scoped navigation token has expired or been revoked.");
                    currentStatus = "STOPPED";
                    stopTracking();
                } else {
                    Log.w(TAG, "Backend returned HTTP " + responseCode + " for location ping");
                }

            } catch (Exception e) {
                Log.w(TAG, "Network transmission notice: " + e.getMessage());
                currentStatus = "NETWORK_UNAVAILABLE";
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Technician Live Navigation",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Ongoing location sharing for active customer navigation");
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        String title = "SR Enterprises CRM";
        String content = technicianName != null && !technicianName.isEmpty()
                ? technicianName + " — Active navigation location sharing enabled"
                : "Active navigation location sharing enabled";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    @Override
    public void onProviderEnabled(String provider) {
        Log.i(TAG, "Location provider enabled: " + provider);
    }

    @Override
    public void onProviderDisabled(String provider) {
        Log.w(TAG, "Location provider disabled: " + provider);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopTracking();
        if (networkExecutor != null) {
            networkExecutor.shutdown();
        }
    }
}
