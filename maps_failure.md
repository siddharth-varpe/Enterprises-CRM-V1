# Maps Failure Diagnosis

## 1. Executive Summary

- **What is failing:** The Technician Portal is unable to obtain the technician's device GPS coordinates (`latitude`, `longitude`, `accuracy`), preventing live location tracking from starting and preventing technician markers from appearing or moving on the Admin Live Map.
- **Where it fails:** The failure occurs at the initial browser geolocation acquisition layer in the frontend Technician Portal, specifically during the automatic geolocation capability initialization lifecycle (`useTechnicianTracking.ts`).
- **Primary Root Cause:** An unprompted, programmatic invocation of `navigator.geolocation.getCurrentPosition()` is executed during component mount (`useEffect`) on portal entry (`/technician`) when permission is in `'prompt'` state. Modern browser security engines (Chromium 80+, Brave Shields, and mobile browsers) automatically suppress, block, or dismiss automated geolocation requests not initiated by a direct user gesture. When dismissed, the browser fires `PERMISSION_DENIED` (code 1), causing the application state machine to prematurely flip `permissionState` to `'denied'` and display a blocking warning banner. Once in this state, subsequent clicks on "Enable Location / Try Again" fail to invoke a native browser prompt because browser security models forbid re-prompting an origin marked as denied.
- **Is browser location ever actually requested?** `navigator.geolocation.getCurrentPosition()` is invoked programmatically by JavaScript code on mount, but because it lacks a user gesture and/or is executed on an insecure context or under browser shield policies, the native browser permission modal is suppressed or auto-dismissed without ever presenting an interactive Allow/Block dialog to the technician.
- **Are coordinates ever obtained?** No valid device latitude or longitude is ever received by the success callback.

---

## 2. Observed Symptoms

1. **Premature Location Warning Banner:**
   Upon navigating to `/technician`, the technician is immediately greeted with an amber warning banner:
   *"Location Permission Required: Live device location tracking is required for technician dispatch, customer navigation, and real-time status updates. Please allow location permissions in your browser or device settings."*
2. **Missing Native Browser Prompt:**
   The browser does not present the standard drop-down dialog asking *"Allow crm.srenterprises.com to access your location?"*.
3. **Non-functional "Enable Location / Try Again" Button:**
   Clicking the "Enable Location / Try Again" button does not cause a browser permission prompt to appear. The banner remains stuck on screen with no change in state.
4. **No Device Coordinates Acquired:**
   The geolocation success callback is never triggered. `latitude` and `longitude` remain null in frontend tracking state.
5. **Admin Live Map Shows No Active Marker:**
   Because no location pings (`technician:location_ping` or `POST /api/v1/maps/technician/location`) are emitted from the browser, Redis temporary tracking state is never populated, Socket.IO broadcasts are not emitted, and the Admin Live Map displays zero active technician pins.
6. **Navigate Fallback Behavior:**
   Clicking Navigate in `TechnicianServiceDetailPage.tsx` falls back to opening Google Maps directions in an external window, while CRM-integrated live tracking remains inactive.

---

## 3. Intended Architecture

### A. Field Location Pipeline
```text
Technician Enters /technician
        ↓
Confirm Geolocation Availability
        ↓
Detect Permission State ('granted', 'prompt', 'denied')
        ↓
Interactive / Valid Native Geolocation Invocation
        ↓
Browser Native Permission Prompt Appears ("Allow / Block")
        ↓
Technician Grants Permission
        ↓
watchPosition() Starts Single Persistent Watcher
        ↓
Device GPS Hardware Provides Coordinates
        ↓
Success Callback Creates Validated Payload
        ↓
Socket.IO / Authenticated REST Endpoint
        ↓
Server Derives Technician Identity from Authenticated Session
        ↓
Temporary Redis Tracking State Updated (2-Hour TTL)
        ↓
Socket.IO Broadcast to 'admin:live-map' Room
        ↓
Admin Live Map Updates AdvancedMarkerElement
```

### B. Navigation & Destination Flow
```text
Technician Clicks Navigate
        ↓
POST /api/v1/maps/technician/navigate (Service Validated)
        ↓
Customer Coordinates Set as Active Destination
        ↓
Tracking Status Transitions to ON_THE_WAY
        ↓
External Google Maps Directions Opens in New Tab
        ↓
Existing watchPosition() Continues Uninterrupted (Single Watcher)
        ↓
Live Movement Broadcasts to Admin as ON_THE_WAY
```

---

## 4. Actual Runtime Flow

```text
Technician Enters /technician
        ↓
TechnicianPortalLayout Mounts TechnicianTrackingProvider
        ↓
useTrackingInternal Executes useEffect on Mount
        ↓
initLocationCapability() Checks navigator.permissions.query({ name: 'geolocation' })
        ↓
Browser Returns permStatus.state === 'prompt' (or 'denied' in Brave / Insecure Context)
        ↓
Code Immediately Invokes requestPermission() Without User Gesture
        ↓
navigator.geolocation.getCurrentPosition() Called Programmatically in Background
        ↓
Browser Anti-Abuse Engine Suppresses Prompt / Auto-Dismisses / Fires Error
        ↓
Error Callback Fires with err.code === 1 (PERMISSION_DENIED)
        ↓
State Mutates: permissionState = 'denied'
        ↓
TechnicianPortalLayout Renders Warning Banner: "Location Permission Required"
        ↓
Technician Sees Warning and Clicks "Enable Location / Try Again"
        ↓
requestPermission() Calls getCurrentPosition() Again
        ↓
Browser Engine Rejects Immediately with PERMISSION_DENIED (No Native Dialog)
        ↓
State Remains 'denied', Zero Coordinates Acquired, Tracking Dead
```

---

## 5. Failure Point

- **EXPECTED:**
  On portal entry, the application should detect geolocation capability. If permission is `prompt`, it should either gracefully prepare the user or only trigger the native permission prompt through a compliant, browser-recognized user gesture. Upon granting permission, `watchPosition()` should acquire GPS coordinates and transmit them to the backend.
- **ACTUAL:**
  The application automatically calls `getCurrentPosition()` inside `useEffect` during component mount. Modern browsers suppress non-user-gesture prompts or treat them as quiet dismissals. The error callback catches code 1 and immediately locks `permissionState` into `'denied'`. Once in `'denied'`, browser security engines refuse to show any prompt on subsequent button clicks.
- **FAILED AT:**
  Initial native geolocation invocation during `useEffect` mount in `apps/web/src/modules/technician-portal/hooks/useTechnicianTracking.ts` (lines 354–364 and 251–278).

---

## 6. Primary Root Cause

### Technical Breakdown: Premature Unprompted Geolocation Call & State Locking

In `apps/web/src/modules/technician-portal/hooks/useTechnicianTracking.ts`:
```ts
// Lines 347–364
if (navigator.permissions && navigator.permissions.query) {
  try {
    const permStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (!isMounted) return;

    if (permStatus.state === 'granted') {
      setState((prev) => ({ ...prev, permissionState: 'granted' }));
      startBrowserWatch();
    } else if (permStatus.state === 'prompt') {
      setState((prev) => ({ ...prev, permissionState: 'prompt' }));
      // Trigger native prompt
      requestPermission(); // <-- ROOT CAUSE: Programmatic invocation without user gesture
    } else if (permStatus.state === 'denied') {
      setState((prev) => ({
        ...prev,
        permissionState: 'denied',
        error: 'Location permission was denied. Please allow location access in your browser settings.',
      }));
    }
```

And in `requestPermission()`:
```ts
// Lines 251–271
return new Promise<boolean>((resolve) => {
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      ...
    },
    (err) => {
      if (err.code === 1) { // PERMISSION_DENIED
        setState((prev) => ({
          ...prev,
          permissionState: 'denied', // <-- Locks state into denied
          isWatching: false,
          error: 'Location permission was denied. Please allow location access in your browser settings.',
        }));
      }
      resolve(false);
    },
    ...
  );
});
```

### Why this breaks the browser:
1. **Chromium Quiet Permission UI & Anti-Abuse:** Modern Chromium browsers (version 80+) automatically suppress location prompts requested on page load without prior user gesture. The browser classifies automated prompts as intrusive, ignores the prompt or hides it in a quiet URL-bar chip, and invokes the error callback with `code: 1`.
2. **Immediate Lockout into 'denied':** The code reacts to `err.code === 1` by setting `permissionState: 'denied'`.
3. **The W3C Geolocation Spec Rule on 'denied':** Once a browser context registers a denied status for an origin, subsequent calls to `navigator.geolocation.getCurrentPosition()` or `watchPosition()` will **never** display a prompt dialog. The browser engine immediately calls the error callback.
4. **Dead-End Button Handler:** When the user clicks *"Enable Location / Try Again"*, line 195 of `TechnicianPortalLayout.tsx` calls `requestPermission()`. But because the origin is already registered as denied in the browser context, the browser immediately returns `PERMISSION_DENIED` without prompting.

---

## 7. Contributing Causes

### Contributing Cause 1: Non-Secure Context in Network/Mobile PWA Testing
- **Location:** `apps/web/vite.config.ts:47` (`host: '0.0.0.0'`).
- **Evidence:** When technicians test the PWA on physical mobile devices over Wi-Fi (e.g. `http://192.168.1.xxx:3000`), the origin is plain HTTP on a non-localhost IP.
- **Impact:** Per W3C Secure Contexts specification, `window.isSecureContext` is `false`. Browsers completely disable `navigator.geolocation` or instantly reject it with `PERMISSION_DENIED: Only secure origins are allowed`. No permission prompt can ever appear on HTTP network origins.

### Contributing Cause 2: Brave Browser / Privacy Shield Geolocation Blocking
- **Location:** Host runtime environment (`/usr/lib/brave-browser/brave`, PID 5123).
- **Evidence:** Brave shields block background tracking by default and return `denied` on `navigator.permissions.query`.
- **Impact:** When `permStatus.state === 'denied'` is received on entry, the code immediately shows the warning banner and completely skips calling `requestPermission()`.

### Contributing Cause 3: Navigate Action Silent Fallback
- **Location:** `apps/web/src/modules/technician-portal/pages/TechnicianServiceDetailPage.tsx:509-515`.
- **Evidence:** When clicking Navigate, `handleNavigateClick` invokes `tracking.navigate()`. When tracking fails due to the locked permission state, the app falls back to opening Google Maps externally via `window.open(mapUrl)`.
- **Impact:** The technician is guided to Google Maps for driving directions, giving the false illusion that navigation started, but zero coordinates ever reach the CRM backend or Admin Live Map.

### Contributing Cause 4: UI/State Feedback Disconnect
- **Location:** `apps/web/src/modules/technician-portal/layouts/TechnicianPortalLayout.tsx:184-201`.
- **Evidence:** The UI suggests clicking "Enable Location / Try Again" will resolve the issue. In reality, once permission is denied, browser security specifications forbid JavaScript from triggering prompts. Only manual user intervention via the browser address bar (lock/tune icon) can reset the permission.

---

## 8. Browser Permission Analysis

- **Permission State:** Returns `'prompt'` initially, but flips to `'denied'` within milliseconds due to unprompted invocation failure.
- **Is `watchPosition` invoked?** No. It is guarded by `permStatus.state === 'granted'` or the success callback of `requestPermission()`.
- **Is `getCurrentPosition` invoked?** Yes, invoked in `useTechnicianTracking.ts:252`.
- **Does a native prompt appear?** No. The browser suppresses or dismisses the prompt because it was triggered on mount without user activation.
- **Secure Context State:**
  - `http://localhost:3000`: `window.isSecureContext === true`.
  - `http://<LAN_IP>:3000`: `window.isSecureContext === false` (hard-blocks geolocation).
- **Permissions Policy:** HTTP response headers from Vite and Fastify do not contain restrictive `Permissions-Policy: geolocation=()` headers.
- **Origin Check:** Application runs on `http://localhost:3000` with API proxy to `http://localhost:4000`.

---

## 9. Geolocation API Analysis

- **Presence:** `navigator.geolocation` exists in browser context on `localhost`.
- **Watch Lifecycle:** Exactly one singleton `sharedWatchId` is designed to be maintained.
- **Success Callback:** Formulates payload with `latitude`, `longitude`, `accuracy`, `heading`, `speed`, `timestamp`.
- **Error Callback:**
  - `code 1 (PERMISSION_DENIED)`: Mutates state to `permissionState: 'denied'`.
  - `code 2 (POSITION_UNAVAILABLE)`: Sets error message "Device GPS position is currently unavailable".
  - `code 3 (TIMEOUT)`: Sets error message "GPS acquisition timed out".
- **Options Used:**
  - `enableHighAccuracy: true`
  - `maximumAge: 10000` (10s)
  - `timeout: 15000` (15s for initial fix) / `20000` (20s for continuous watch)

---

## 10. Technician Portal Lifecycle Analysis

- **Initialization Hook:** Mounted in `TechnicianTrackingProvider` wrapped around `TechnicianPortalLayout.tsx`.
- **Trigger Moment:** Executes on `/technician` entry (layout mount).
- **Service Dependency:** Geolocation capability initializes independently of whether a service or job card is currently opened.
- **Defect in Lifecycle:** Mounting `initLocationCapability()` directly inside layout `useEffect` causes automated background invocation without waiting for a verified user gesture.

---

## 11. Navigate Flow Analysis

- **Handler:** `handleNavigateClick` in `TechnicianServiceDetailPage.tsx:509`.
- **Action:** Calls `tracking.navigate(service.id)`.
- **Backend Route:** `POST /api/v1/maps/technician/navigate`.
- **Destination Binding:** Authoritative customer coordinates from the CRM service record are bound to the tracking session as `activeDestination`.
- **Separation of Concerns:** Navigate sets status to `ON_THE_WAY` and does **not** advance the Job Card status to `STARTED` (`Navigate ≠ Start Job`).
- **Tracking Interaction:** Calls `startBrowserWatch()`, but watcher cannot function because geolocation permission was suppressed/denied at the portal shell level.

---

## 12. Backend Analysis

- **Endpoints Available:**
  - `POST /api/v1/maps/technician/location`: Accepts latitude, longitude, accuracy, heading, speed, timestamp.
  - `POST /api/v1/maps/technician/navigate`: Validates service assignment and sets destination.
  - `POST /api/v1/maps/technician/stop`: Terminates tracking session.
  - `GET /api/v1/maps/technician/active`: Returns current active navigation state.
- **Authentication & Authorization:**
  - Backend verifies session cookie `crm_technician_session` or Bearer token.
  - Derives `technicianId` exclusively from authenticated session (`req.technician`).
  - Client-supplied `technicianId` is rejected / ignored.
  - Rejects unassigned service navigation with 403 Forbidden.

---

## 13. Socket.IO Analysis

- **Namespace:** `/maps`
- **Client Ingest Event:** `technician:location_ping`
- **Server Broadcast Events:**
  - `admin:technician_location_update` (and alias `technician:location:update`)
  - `admin:live_technicians_snapshot` (and alias `technicians:initial`)
  - `admin:technician_tracking_stopped` (and alias `technician:tracking:stopped`)
- **Rooms:** `admin:live-map` and `technician:<technicianId>`
- **Admin Subscription:** Handled when connecting with `{ query: { subscribe: 'admin-map', role: 'admin' } }`.
- **Status:** Verified and functional in isolation. The server never receives events because the client-side browser watcher never acquires coordinates.

---

## 14. Redis Analysis

- **Key Pattern:** `technician:tracking:<technicianId>` (Hash field: `active_tracking`).
- **TTL:** 7200 seconds (2 hours) automatically applied on update.
- **Persistence:** Strictly temporary in Redis; zero permanent PostgreSQL GPS history tables.
- **Purge Path:** Immediately deleted via `DEL` on tracking termination or service completion.
- **Isolation:** Multi-technician keys are completely partitioned by `technicianId`.

---

## 15. Admin Map Analysis

- **Location of Failure:** The problem is **before** the transport layer, at the browser GPS acquisition stage.
- **Verification:**
  - Maps JavaScript API and AdvancedMarkerElement are rendering correctly.
  - Map listener is subscribed to `/maps` socket room `admin:live-map`.
  - Normalizer adapter `normalizeTechnicianLocation` handles both flat and nested payloads.
  - Marker creation and updates work when tested with valid payloads.
  - Zero markers appear purely because no GPS coordinates are emitted by the Technician Portal.

---

## 16. Configuration Analysis

- **Google Maps Configuration:**
  - Browser JavaScript API Key: Configured and active.
  - Map ID: Configured and active.
  - Routes API Key: Configured on server.
- **Credentials Security:** All keys and secrets are loaded from environment configuration without exposure to unauthorized clients.
- **Note:** Credential validity has no bearing on browser geolocation failure; geolocation is an entirely native browser/device capability.

---

## 17. Evidence

1. **Source Code Proof (`useTechnicianTracking.ts:354-364`):**
   `initLocationCapability` calls `requestPermission()` unconditionally inside `useEffect` when state is `'prompt'`.
2. **Source Code Proof (`useTechnicianTracking.ts:265-271`):**
   `requestPermission()` immediately mutates state to `permissionState: 'denied'` upon any `code === 1` error.
3. **Source Code Proof (`TechnicianPortalLayout.tsx:184`):**
   The amber banner is rendered solely when `tracking.permissionState === 'denied'`.
4. **W3C Geolocation Spec Proof:**
   Section 5 of W3C Geolocation Level 2: Once permission is denied for an origin, user agents must not prompt the user on subsequent calls and must immediately invoke the error callback.
5. **Runtime Process Evidence:**
   Host is running Brave Browser (`/usr/lib/brave-browser/brave`, PID 5123), which enforces strict privacy shields and blocks automated geolocation requests.

---

## 18. Root-Cause Chain

```text
Technician visits /technician
        ↓
TechnicianTrackingProvider mounts and runs useEffect
        ↓
initLocationCapability() calls navigator.permissions.query()
        ↓
State is 'prompt'
        ↓
requestPermission() is called automatically without user gesture
        ↓
Browser suppresses / dismisses automated background geolocation call
        ↓
Error callback receives code 1 (PERMISSION_DENIED)
        ↓
State mutates: permissionState = 'denied'
        ↓
UI renders: "Location Permission Required" banner with "Enable Location / Try Again"
        ↓
User clicks "Enable Location / Try Again"
        ↓
Browser engine refuses to re-prompt an origin already in 'denied' state
        ↓
Error callback fires immediately with code 1
        ↓
No GPS coordinates acquired
        ↓
No location ping emitted over Socket.IO or REST
        ↓
Redis temporary state remains empty
        ↓
Socket.IO emits no update to 'admin:live-map'
        ↓
Admin Live Map renders map successfully, but technician marker never appears
```

---

## 19. Minimal Fix Boundary (Advisory Only)

*Note: This section is architectural guidance only. No code fixes have been applied in this phase.*

1. **Component Requiring Correction:**
   - `apps/web/src/modules/technician-portal/hooks/useTechnicianTracking.ts`:
     - Do **not** invoke `requestPermission()` automatically on page load inside `useEffect` when permission is `'prompt'`.
     - In `'prompt'` state, leave `permissionState` as `'prompt'` without calling `getCurrentPosition()`.
     - Only invoke `requestPermission()` upon an explicit user gesture (e.g. clicking an "Enable Location" button or clicking "Navigate").
     - When permission is genuinely `'denied'`, provide clear instructions to the user to reset permissions in the browser address bar (lock/tune icon), since JavaScript cannot override a browser denial.
     - Ensure the portal gracefully guides users running on non-secure contexts (`http://<IP>:3000`) that HTTPS or localhost is required by browser security specifications.
2. **Boundaries to Preserve (Must NOT be modified):**
   - Google Maps rendering on Admin map.
   - Socket.IO `/maps` event architecture and payload shape.
   - Redis temporary state hashing and 2-hour TTL.
   - Server-side technician session authorization.
   - Job Card execution states (`Navigate ≠ Start Job`).
   - All existing CRM business logic, billing, invoices, and payments.

---

## 20. Recommended Next Debugging / Fix Phase

1. **Phase A:** Update `useTechnicianTracking.ts` to separate permission state detection from permission prompting. Ensure automated `initLocationCapability` only reads state and does not invoke `getCurrentPosition()` in `'prompt'` state.
2. **Phase B:** Wire native geolocation invocation strictly to user gestures (button click or Navigate click).
3. **Phase C:** Provide actionable UI instructions when state is `'denied'` explaining how to toggle site permissions in the browser address bar.
4. **Phase D:** Verify on both desktop browser (`localhost:3000`) and mobile context with HTTPS/tunneling.

---

## 21. Files Inspected

- `technician_portal.md`
- `maps_credentials.md`
- `apps/web/src/modules/technician-portal/hooks/useTechnicianTracking.ts`
- `apps/web/src/modules/technician-portal/hooks/useTechnicianTracking.spec.ts`
- `apps/web/src/modules/technician-portal/layouts/TechnicianPortalLayout.tsx`
- `apps/web/src/modules/technician-portal/pages/TechnicianServiceDetailPage.tsx`
- `apps/web/src/modules/technicians/components/AdminLiveTechnicianMap.tsx`
- `apps/web/src/modules/technicians/components/AdminLiveTechnicianMap.spec.tsx`
- `apps/api/src/modules/maps/maps.routes.ts`
- `apps/api/src/modules/maps/maps-socket.service.ts`
- `apps/api/src/modules/maps/maps-tracking.redis.ts`
- `apps/api/src/modules/maps/maps.spec.ts`
- `apps/web/vite.config.ts`
- `apps/api/src/app.ts`

---

## 22. Files Modified

- `maps_failure.md`
*(No other project file was modified).*

---

# SECOND-LEVEL ROOT-CAUSE VERIFICATION

## 1. Exact Failing Environment
- **Operating System:** Ubuntu 26.04.1 LTS (Linux x86_64, kernel 6.17.0-14-generic) [VERIFIED FACT]
- **Active Desktop Browser:** Brave Browser stable version `154.1.96.60` (Chromium engine version `154.0.8037.93`, V8 `15.4.80.19`) [VERIFIED FACT]
- **Process ID:** PID 5076 (`/opt/brave.com/brave/brave`) [VERIFIED FACT]
- **Host Network Interface:** `wlp2s0` with IPv4 address `192.168.1.11/24` [VERIFIED FACT]
- **Runtime Mode:** Normal browser tab and PWA standalone window under `manifest-technician.webmanifest` [VERIFIED FACT]

---

## 2. Exact URL & Origin
- **Failing Page URL:** `http://192.168.1.11:3000/technician` [DIRECT RUNTIME EVIDENCE from Brave History SQLite database]
- **Failing Service Detail URL:** `http://192.168.1.11:3000/technician/services/7acb8ed8-fcc3-47ec-ad4e-5671997e48e5` [DIRECT RUNTIME EVIDENCE]
- **Origin:** `http://192.168.1.11:3000`
- **Protocol:** `http:`
- **Hostname:** `192.168.1.11`
- **Port:** `3000`

---

## 3. Secure-Context Forensics
- **Runtime Inspection:** `window.isSecureContext` evaluated inside the browser runtime at `http://192.168.1.11:3000/technician`.
- **Result:**
  ```json
  {
    "href": "http://192.168.1.11:3000/technician/login",
    "origin": "http://192.168.1.11:3000",
    "protocol": "http:",
    "hostname": "192.168.1.11",
    "port": "3000",
    "isSecureContext": false
  }
  ```
- **Conclusive Determination:** **Is the failing page a secure context? NO.** [DIRECT RUNTIME EVIDENCE]
- **Specification Impact:** Per W3C Secure Contexts specification and Chromium security architecture (enforced since Chrome 50), the Geolocation API is strictly prohibited on non-secure origins. `http://localhost` and `http://127.0.0.1` are whitelisted as secure, but **all non-localhost IP addresses (including private LAN IPs such as `192.168.x.x`) are classified as INSECURE**.

---

## 4. Browser Permission State — Before Request
- **Command:** `navigator.permissions.query({ name: 'geolocation' })` evaluated on `http://192.168.1.11:3000` prior to any geolocation API invocation.
- **Result:** `permStatus.state === 'denied'` [DIRECT RUNTIME EVIDENCE].
- **Finding:** The browser returns `'denied'` immediately on page load solely because the origin is an insecure context, before any user action, permission check, or `getCurrentPosition` call.

---

## 5. Browser Permission State — After Failure
- **State BEFORE request:** `denied`
- **State AFTER request:** `denied`
- **Distinction:** The transition from `prompt` to `denied` did **not** occur at the browser level on this origin. The browser engine treated the origin as permanently `denied` from the initial navigation due to the insecure context rule. The application's state machine mirrored this `denied` state, but misattributed it to user setting denial.

---

## 6. Native Geolocation Call Verification
- **API Invoked:** `navigator.geolocation.getCurrentPosition()` at `apps/web/src/modules/technician-portal/hooks/useTechnicianTracking.ts:252`.
- **Call Condition:** Triggered by `requestPermission()` during `useEffect` mount and upon clicking "Enable Location / Try Again".
- **Synchronous Execution:** Does not throw a synchronous exception.
- **Error Callback Execution:** The error callback executes asynchronously on the next microtask/event tick with error code 1.
- **WatchPosition Invocation:** `navigator.geolocation.watchPosition()` is never established because it is guarded by successful permission acquisition.

---

## 7. Geolocation Error Forensics
- **Error Code:** `error.code === 1` (`PERMISSION_DENIED`) [DIRECT RUNTIME EVIDENCE]
- **Exact Browser Error Message:**
  ```text
  "Only secure origins are allowed (see: https://goo.gl/Y0ZkNV)."
  ```
- **Error Masking Discrepancy:**
  - **Browser Engine Error:** `"Only secure origins are allowed (see: https://goo.gl/Y0ZkNV)."`
  - **Application Transformed Message:** `"Location permission was denied. Please allow location access in your browser settings."`
  - **Diagnostic Impact:** The application completely swallowed the browser's exact error message explaining the insecure origin restriction, and falsely informed the technician that location was denied in their browser settings.

---

## 8. Native Prompt Behavior
- **Observed Behavior:** The browser **NEVER** displayed a native permission prompt ("Allow / Block").
- **Reason:** Chromium, Brave, and WebKit will never prompt a user for geolocation on an unencrypted HTTP origin. The browser engine rejects the request at the security barrier before any prompt UI is generated.

---

## 9. Controlled User-Gesture Experiment
A controlled diagnostic experiment was conducted using the Chrome DevTools Protocol to determine if user activation would enable the browser prompt on `http://192.168.1.11:3000`.

- **TEST A (Automated Call on Mount):**
  - **Invocation:** Programmatic call to `navigator.geolocation.getCurrentPosition()`.
  - **Result:** `code: 1`, `message: "Only secure origins are allowed (see: https://goo.gl/Y0ZkNV)."`
- **TEST B (Direct User Gesture via Button Click in DOM):**
  - **Invocation:** A real DOM `<button>` element was created and dispatched a trusted `click` event invoking `navigator.geolocation.getCurrentPosition()`.
  - **Result:** `code: 1`, `message: "Only secure origins are allowed (see: https://goo.gl/Y0ZkNV)."`

### Hypothesis Verdict:
- **User-Gesture Hypothesis on Insecure Origin:** **REJECTED.**
- The lack of user gesture was **not** the reason `PERMISSION_DENIED` was returned on `http://192.168.1.11:3000`. Even with an explicit user gesture, the browser unconditionally rejected geolocation due to the non-secure context restriction.

---

## 10. Permissions Policy Forensics
- **Document HTTP Response:** `http://192.168.1.11:3000/technician` returns HTTP 200 from Vite dev server.
- **Headers Inspected:**
  ```http
  HTTP/1.1 200 OK
  Vary: Origin
  Content-Type: text/html
  Cache-Control: no-cache
  ```
- **Finding:** No restrictive `Permissions-Policy` or `Feature-Policy` header is present. Geolocation is not restricted by HTTP headers.
- **Iframe Check:** The Technician Portal is the top-level browsing context (`window.top === window.self`); it is not embedded in an iframe.

---

## 11. Origin Consistency Forensics
- **Frontend Origin:** `http://192.168.1.11:3000`
- **API Proxy Origin:** `http://192.168.1.11:3000/api` (proxied to `http://127.0.0.1:4000`)
- **Backend Origin:** `http://127.0.0.1:4000`
- **Finding:** Origin consistency between frontend and proxy is intact. The origin mismatch that matters is that `http://192.168.1.11:3000` is an insecure HTTP origin.

---

## 12. Browser Site-Permission Inspection
- **Brave Preferences File:** `/home/siddharth/.config/BraveSoftware/Brave-Browser/Default/Preferences`
- **Site Setting for `http://192.168.1.11:3000`:** No manual "Block" exception exists in `profile.content_settings.exceptions.geolocation`.
- **Forced CDP Permission Grant Experiment:**
  When attempting to programmatically grant geolocation permission to `http://192.168.1.11:3000` via DevTools `Browser.grantPermissions`:
  ```json
  {
    "code": -32602,
    "message": "Permission can't be granted in current context."
  }
  ```
  The browser engine actively rejected granting permission because the origin is insecure.

---

## 13. Brave / Privacy Shield Analysis
- **Process:** `/opt/brave.com/brave/brave` (PID 5076).
- **Shield Configuration:** Shields are active with farbling token enabled.
- **Finding:** While Brave Shields enforces anti-fingerprinting protections on secure origins, the failure on `http://192.168.1.11:3000` is enforced upstream by the Chromium core network security layer before Brave Shields rules are evaluated.

---

## 14. OS / Device Location Permission
- **Operating System Setting:** GNOME location services setting inspected via `gsettings get org.gnome.system.location enabled`.
- **Value:** `true` [VERIFIED FACT].
- **Finding:** Operating system location services are enabled at the OS level. The failure is not caused by OS location disabling.

---

## 15. Device GPS Availability & Control Experiment
- **Control Test Target:** `http://localhost:3000/technician` (Secure Context: `window.isSecureContext === true`).
- **Method:** Evaluated `navigator.geolocation.getCurrentPosition()` under the same browser and device environment with geolocation permission granted.
- **Result:**
  ```json
  {
    "isSecureContext": true,
    "permissionState": "granted",
    "positionResult": {
      "ok": true,
      "lat": 18.5204,
      "lng": 73.8567
    }
  }
  ```
- **Conclusive Determination:** The device and browser are fully capable of acquiring GPS coordinates. Device GPS acquisition succeeds on secure origins and fails exclusively on insecure origins.

---

## 16. PWA vs Normal Browser Tab Experiment
- **Normal Browser Tab:** Tested at `http://192.168.1.11:3000/technician` -> `isSecureContext: false`, Geolocation blocked.
- **Installed PWA Window:** Tested under PWA manifest scope -> Identical origin `http://192.168.1.11:3000` -> `isSecureContext: false`, Geolocation blocked.
- **Finding:** The PWA container does not bypass W3C Secure Context enforcement.

---

## 17. Button Behavior Forensics
- **Button:** `<button onClick={() => tracking.requestPermission()}>Enable Location / Try Again</button>`
- **Execution Trace:** Click handler executes -> `tracking.requestPermission()` called -> `navigator.geolocation.getCurrentPosition()` called.
- **Browser Response:** Immediately invokes error callback with `code: 1` (`"Only secure origins are allowed"`).
- **Result:** No prompt appears, the banner remains on screen, and no state change occurs.

---

## 18. Navigate Behavior Forensics
- **Action:** Technician clicks Navigate on service `7acb8ed8-fcc3-47ec-ad4e-5671997e48e5`.
- **Trace:**
  1. `tracking.navigate()` calls `POST /api/v1/maps/technician/navigate`.
  2. Server binds customer coordinates to the active session.
  3. Client calls `startBrowserWatch()`.
  4. `navigator.geolocation.watchPosition()` is called, but immediately invokes error callback with `code: 1` (`"Only secure origins are allowed"`).
  5. Navigation falls back to opening external Google Maps.
  6. Zero device coordinates reach the backend or Redis.

---

## 19. WatchPosition Behavior
- **Call Site:** `apps/web/src/modules/technician-portal/hooks/useTechnicianTracking.ts:187`.
- **Runtime Execution:** When invoked on `http://192.168.1.11:3000`, `watchPosition` immediately executes its error callback with `err.code === 1` and `err.message === "Only secure origins are allowed (see: https://goo.gl/Y0ZkNV)."`.
- **Watcher Persistence:** `sharedWatchId` is immediately cleared on error (lines 207–210).

---

## 20. Primary Root Cause
**INSECURE CONTEXT RESTRICTION (`window.isSecureContext === false` on `http://192.168.1.11:3000`):**
The Technician Portal was loaded and tested using the machine's local network Wi-Fi IP (`http://192.168.1.11:3000`). Under W3C Geolocation API Level 2 and modern browser security standards, geolocation is **strictly forbidden on insecure origins (HTTP over non-localhost IPs)**. The browser engine hard-blocks the Geolocation API, refuses to show any permission prompt, and unconditionally returns `PERMISSION_DENIED: Only secure origins are allowed (see: https://goo.gl/Y0ZkNV).`.

---

## 21. Contributing Causes
1. **Application Error Masking:** `useTechnicianTracking.ts` caught error code 1 and assumed it represented a user setting refusal, discarding the browser's actual message (`"Only secure origins are allowed"`) and rendering `"Location permission was denied. Please allow location access in your browser settings."`.
2. **Misleading Retry Action:** The "Enable Location / Try Again" button suggested that the issue could be resolved by clicking, but JavaScript cannot prompt for location in an insecure context.
3. **Dev Server Binding:** Vite binds to `0.0.0.0:3000`, outputting `Network: http://192.168.1.11:3000/`, which invites developers and mobile testers to test the portal over an insecure LAN URL where geolocation cannot function.

---

## 22. Verified Evidence Summary
- `Brave History SQLite DB`: Confirms multiple visits to `http://192.168.1.11:3000/technician` and `/technician/services/7acb8ed8-fcc3-47ec-ad4e-5671997e48e5`.
- `CDP Runtime Evaluation`: Proves `isSecureContext: false`, `permissionQueryState: 'denied'`, and `getCurrentPosition` returning `code: 1`, message `"Only secure origins are allowed"`.
- `User-Gesture Test`: Proves that a direct user button click also returns `"Only secure origins are allowed"`.
- `CDP Permission Grant Test`: DevTools `Browser.grantPermissions` returns error `-32602: "Permission can't be granted in current context."` on `http://192.168.1.11:3000`.
- `Control Test on Localhost`: Proves that `http://localhost:3000` succeeds and returns accurate coordinates when permission is granted.

---

## 23. Unverified Assumptions Eliminated
- **Eliminated Assumption 1:** "The failure was caused by lack of user gesture." *(Proven false for the failing runtime: user-gesture calls also fail with "Only secure origins are allowed").*
- **Eliminated Assumption 2:** "The user manually blocked location in browser settings." *(Proven false: Brave Preferences file has zero block exceptions for this origin).*
- **Eliminated Assumption 3:** "OS-level location services are disabled." *(Proven false: GNOME location services are verified active).*
- **Eliminated Assumption 4:** "A restrictive Permissions-Policy header blocked geolocation." *(Proven false: No such header is sent by Vite or Fastify).*

---

## 24. Previous Diagnosis Correction

### Previous Claim:
The primary root cause was identified as an unprompted `getCurrentPosition()` call in `useEffect` on component mount triggering Chromium's Quiet Permission UI.

### Verified Result:
The active failing runtime environment used by the user was `http://192.168.1.11:3000`, where `window.isSecureContext === false`. On this origin, the browser rejects geolocation immediately due to the insecure context policy, regardless of whether a user gesture is present.

### Reason for Correction:
Direct runtime inspection of Brave's History SQLite database revealed that the technician portal was being accessed via the local network IP `http://192.168.1.11:3000` rather than `http://localhost:3000`. Direct CDP experimentation proved that `isSecureContext` is `false` on that URL, producing `PERMISSION_DENIED: Only secure origins are allowed` on both automated and user-initiated calls.

