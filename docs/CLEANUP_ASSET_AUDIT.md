# Enterprises CRM — Static Asset Audit & Safe Cleanup Report

**Project:** Enterprises CRM v1.2.0  
**Audit Date:** October 11, 2026  
**Status:** Executed & Verified  
**Methodology:** Comprehensive reference graph search (AST imports, HTML/manifest links, API route handlers, CSS selectors, Service Workers, test fixtures, dynamic string patterns) with strict preservation rules.

---

## 1. Executive Summary

| Metric | Count | Percentage | Total Size |
|---|---|---|---|
| **Total Assets Audited** | **93** | 100.0% | 18,228,299 B (17.38 MB) |
| **Confirmed Used Assets (Preserved)** | **81** | 87.1% | 14,237,664 B (13.58 MB) |
| **Confirmed Unused Assets (Removed)** | **9** | 9.7% | 3,002,251 B (2.86 MB / **~3.00 MB**) |
| **Kept — Usage Uncertain (Preserved)** | **3** | 3.2% | 988,384 B (0.94 MB) |

### Net Impact
- **Total Storage Reclaimed:** **3,002,251 bytes (2.86 MB)**
- **Orphan Directories Removed:** `apps/web/public/assets/invoice/`, `apps/web/public/assets/brand/`, and `apps/web/public/assets/`
- **Application Integrity:** **100% Preserved**. All 7 workspace packages pass `pnpm typecheck`, Vite production build succeeds without warnings, and all 50 test files / 263 Vitest tests pass cleanly.

---

## 2. Confirmed Unused Assets Breakdown (Removed)

The following 9 assets were conclusively identified as unused by any code, template, service worker, native platform, test, or documentation file, and have been safely removed:

| # | Asset Path | File Type | Size | Evidence & Rationale |
|---|---|---|---|---|
| 1 | `apps/web/public/assets/invoice/original_invoice_page-1.png` | PNG | 296,321 B (289.4 KB) | Legacy reference scan from template design commit `dad4604`. Zero references in source code, HTML, CSS, API routes, or tests. |
| 2 | `apps/web/public/assets/invoice/sr_enterprises_logo.png` | PNG | 849,488 B (829.6 KB) | Duplicate unreferenced copy. Frontend components import vector SVGs from `apps/web/src/assets/invoiceAssets.ts`. Zero runtime consumers. |
| 3 | `apps/web/public/assets/invoice/sr_enterprises_official_lower_section.png` | PNG | 135,377 B (132.2 KB) | Duplicate unreferenced copy. Lower section is inlined via base64 from `invoiceAssets.ts`. Zero references. |
| 4 | `apps/web/public/assets/brand/crm-logo.png` | PNG | 233,474 B (228.0 KB) | Binary duplicate of `apps/web/public/crm-logo.png`. All code, manifests, and service workers reference `/crm-logo.png`. `assets/brand/` copy is completely orphaned. |
| 5 | `apps/web/public/assets/brand/sr_enterprises_logo.png` | PNG | 849,488 B (829.6 KB) | Legacy logo superseded by official `crm-logo.png` during branding refactor (`af8a720`). Zero code references. |
| 6 | `apps/web/src/assets/sr-enterprises-upi-qr.png` | PNG | 3,519 B (3.4 KB) | Legacy UPI QR code superseded by `enterprises-crm-upi-qr.png`. Referenced only as an output path in local utility script `crop_qr.ps1`. |
| 7 | `apps/web/src/assets/sr-enterprises-upi-qr-card.jpg` | JPG | 99,199 B (96.9 KB) | Raw camera snapshot used once in `crop_qr.ps1`. Never imported by web application. |
| 8 | `apps/web/public/sr-enterprises-upi-qr.png` | PNG | 3,519 B (3.4 KB) | Legacy public QR code superseded by `enterprises-crm-upi-qr.png`. Zero runtime consumers. |
| 9 | `docs/screenshots/auth/01-admin-login.png` | PNG | 531,866 B (519.4 KB) | Obsolete screenshot replaced by `02-admin-login.png` when `01-splash-screen.png` was introduced. Not referenced in `README.md` or screenshot scripts. |

---

## 3. Kept — Usage Uncertain Breakdown (Preserved)

In accordance with Non-Negotiable Protection Rules, any asset whose usage could not be ruled out with 100% certainty was strictly preserved:

| # | Asset Path | File Type | Size | Justification for Retention |
|---|---|---|---|---|
| 1 | `apps/web/public/enterprises-crm-upi-qr.png` | PNG | 3,519 B (3.4 KB) | Served at the web root (`/enterprises-crm-upi-qr.png`). Preserved to protect direct URL links, public invoice previews, or WhatsApp payment links that might construct direct image URLs. |
| 2 | `scripts/mailer/assets/sr_enterprises_logo.png` | PNG | 849,488 B (829.6 KB) | Canonical high-resolution source file corresponding to `InvoiceAssets::$SR_ENTERPRISES_LOGO_B64` in `lower_section_b64.php`. Preserved to allow asset re-encoding if required. |
| 3 | `scripts/mailer/assets/sr_enterprises_official_lower_section.png` | PNG | 135,377 B (132.2 KB) | Canonical high-resolution source file corresponding to `InvoiceAssets::$OFFICIAL_LOWER_SECTION_B64` in `lower_section_b64.php`. Preserved to allow asset re-encoding. |

---

## 4. Confirmed Used Assets Breakdown (Preserved)

### A. Web PWA, Manifest & Brand Assets (`apps/web/public/`) — 11 files (1,154,642 B)
- `favicon.ico`: Default browser favicon (`index.html`, service workers).
- `crm-logo.png`: Main application brand logo (`index.html`, `LoadingScreen.tsx`, service workers).
- `apple-touch-icon.png`, `apple-touch-icon-technician.png`: iOS home screen icons (`index.html`, `pwa-coordinator.tsx`, Fastify API dual-manifest injector).
- `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`: Admin PWA manifest icons (`manifest-admin.webmanifest`, `manifest.webmanifest`, `sw-admin.js`).
- `pwa-technician-192x192.png`, `pwa-technician-512x512.png`, `pwa-technician-maskable-512x512.png`: Technician PWA manifest icons (`manifest-technician.webmanifest`, `sw-technician.js`).
- `og-image.jpg`: Social sharing meta card preview (`index.html`).

### B. Web Source Bundled Assets (`apps/web/src/assets/`) — 2 files (695,090 B)
- `ro-purifier-bg.jpg`: Direct import in `apps/web/src/components/auth/LoginBrandPanel.tsx`.
- `enterprises-crm-upi-qr.png`: Direct import in `apps/web/src/modules/sales/SaleDetailPage.tsx`.
- *(Note: `invoiceAssets.ts` is a TypeScript code module providing SVG/b64 constants across 9 components).*

### C. Documentation Screenshots (`docs/screenshots/`) — 28 files (12,187,013 B)
- **Admin Section (16 screenshots):** `01-dashboard.png`, `02-customer-directory.png`, `04-sales-directory.png`, `05-sale-create.png`, `10-services-directory.png`, `19-inventory-management.png`, `22-reports-analytics.png`, `admin_live_technician_map.png`, `customer_profile.png`, `gst_tax_invoices_register.png`, `job_card_detail.png`, `machine_rentals_management.png`, `payments_and_collections.png`, `system_settings_configuration.png`, `technician_profile.png`, `technicians_roster.png`.
- **Technician Section (8 screenshots):** `01-technician-dashboard.png`, `02-assigned-services.png`, `04-service-navigation.png`, `05-job-completion.png`, `06-profile.png`, `07-technician-notifications.png`, `mobile-01-dashboard.png`, `mobile-03-navigation.png`.
- **Authentication Section (4 screenshots):** `01-splash-screen.png`, `02-admin-login.png`, `03-technician-login.png`, `04-technician-otp.png`.
- *All 28 screenshots are actively embedded in `README.md` and generated by `scripts/capture-screenshots.ts`.*

### D. Native Android Resources (`apps/web/android/app/src/main/res/`) — 24 files (145,263 B)
- 15 launcher icons (`ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` across hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi).
- 9 splash screen drawables (`splash.png` across landscape, portrait, and base drawables).

### E. Vendor Library Dependencies (`scripts/mailer/vendor/dompdf/`) — 14 files (55,656 B)
- 12 DejaVu font binaries (`DejaVuSans*.ttf`, `DejaVuSerif*.ttf`).
- 2 broken-image fallback assets (`broken_image.png`, `broken_image.svg`).

---

## 5. Complete 93-Asset Inventory Table

| Asset File Path | Format | Size | Classification | Verification Details & Evidence |
|---|---|---|---|---|
| `apps/web/android/app/src/main/res/drawable-land-hdpi/splash.png` | PNG | 7,705 B (7.5 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-land-mdpi/splash.png` | PNG | 4,040 B (3.9 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-land-xhdpi/splash.png` | PNG | 9,251 B (9.0 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-land-xxhdpi/splash.png` | PNG | 13,984 B (13.7 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-land-xxxhdpi/splash.png` | PNG | 17,683 B (17.3 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-port-hdpi/splash.png` | PNG | 7,934 B (7.7 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-port-mdpi/splash.png` | PNG | 4,096 B (4.0 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-port-xhdpi/splash.png` | PNG | 9,875 B (9.6 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-port-xxhdpi/splash.png` | PNG | 13,346 B (13.0 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable-port-xxxhdpi/splash.png` | PNG | 17,489 B (17.1 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/drawable/splash.png` | PNG | 4,040 B (3.9 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-hdpi/ic_launcher.png` | PNG | 2,786 B (2.7 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png` | PNG | 3,450 B (3.4 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png` | PNG | 4,341 B (4.2 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-mdpi/ic_launcher.png` | PNG | 1,869 B (1.8 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png` | PNG | 2,110 B (2.1 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png` | PNG | 2,725 B (2.7 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` | PNG | 3,981 B (3.9 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png` | PNG | 5,036 B (4.9 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png` | PNG | 6,593 B (6.4 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` | PNG | 6,644 B (6.5 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png` | PNG | 9,793 B (9.6 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png` | PNG | 10,455 B (10.2 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` | PNG | 9,441 B (9.2 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` | PNG | 15,529 B (15.2 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png` | PNG | 15,916 B (15.5 KB) | CONFIRMED USED | Native Android platform resource (Capacitor/Mobile launcher & splash). |
| `apps/web/public/apple-touch-icon-technician.png` | PNG | 42,410 B (41.4 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/apple-touch-icon.png` | PNG | 36,763 B (35.9 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/assets/brand/crm-logo.png` | PNG | 233,474 B (228.0 KB) | **CONFIRMED UNUSED** | Identical duplicate of /public/crm-logo.png; all code and manifests link to /crm-logo.png directly. |
| `apps/web/public/assets/brand/sr_enterprises_logo.png` | PNG | 849,488 B (829.6 KB) | **CONFIRMED UNUSED** | Superseded by /crm-logo.png in branding update (af8a720); zero references in application code. |
| `apps/web/public/assets/invoice/original_invoice_page-1.png` | PNG | 296,321 B (289.4 KB) | **CONFIRMED UNUSED** | Obsolete reference scan from template design (commit dad4604); zero references in source, styles, or runtime. |
| `apps/web/public/assets/invoice/sr_enterprises_logo.png` | PNG | 849,488 B (829.6 KB) | **CONFIRMED UNUSED** | Legacy unreferenced duplicate; CRM frontend uses inlined SVG in invoiceAssets.ts; zero references. |
| `apps/web/public/assets/invoice/sr_enterprises_official_lower_section.png` | PNG | 135,377 B (132.2 KB) | **CONFIRMED UNUSED** | Legacy unreferenced duplicate; CRM uses inlined base64 in invoiceAssets.ts; zero references. |
| `apps/web/public/crm-logo.png` | PNG | 233,474 B (228.0 KB) | CONFIRMED USED | Referenced in index.html, sw-admin.js, sw-technician.js, LoadingScreen.tsx. |
| `apps/web/public/enterprises-crm-upi-qr.png` | PNG | 3,519 B (3.4 KB) | **KEEP — USAGE UNCERTAIN** | Direct web-accessible QR code; kept to ensure external invoice/payment deep-links or URL consumers do not break. |
| `apps/web/public/favicon.ico` | ICO | 14,050 B (13.7 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/og-image.jpg` | JPG | 84,112 B (82.1 KB) | CONFIRMED USED | Referenced in index.html OpenGraph and Twitter card meta tags. |
| `apps/web/public/pwa-192x192.png` | PNG | 42,236 B (41.2 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/pwa-512x512.png` | PNG | 233,474 B (228.0 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/pwa-maskable-512x512.png` | PNG | 233,070 B (227.6 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/pwa-technician-192x192.png` | PNG | 47,569 B (46.5 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/pwa-technician-512x512.png` | PNG | 221,575 B (216.4 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/pwa-technician-maskable-512x512.png` | PNG | 224,824 B (219.6 KB) | CONFIRMED USED | Referenced in index.html, web manifests, PWA coordinator, and API routes. |
| `apps/web/public/sr-enterprises-upi-qr.png` | PNG | 3,519 B (3.4 KB) | **CONFIRMED UNUSED** | Legacy public QR copy; replaced by enterprises-crm-upi-qr.png; zero code or manifest references. |
| `apps/web/src/assets/enterprises-crm-upi-qr.png` | PNG | 3,519 B (3.4 KB) | CONFIRMED USED | Directly imported in SaleDetailPage.tsx for UPI payment modal. |
| `apps/web/src/assets/ro-purifier-bg.jpg` | JPG | 691,571 B (675.4 KB) | CONFIRMED USED | Imported in LoginBrandPanel.tsx for login illustration. |
| `apps/web/src/assets/sr-enterprises-upi-qr-card.jpg` | JPG | 99,199 B (96.9 KB) | **CONFIRMED UNUSED** | Raw uncropped camera photo; referenced only in local crop_qr.ps1; not used in web bundle. |
| `apps/web/src/assets/sr-enterprises-upi-qr.png` | PNG | 3,519 B (3.4 KB) | **CONFIRMED UNUSED** | Legacy brand QR; replaced by enterprises-crm-upi-qr.png; referenced only in crop_qr.ps1 local script. |
| `docs/screenshots/admin/01-dashboard.png` | PNG | 207,823 B (203.0 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/02-customer-directory.png` | PNG | 238,148 B (232.6 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/04-sales-directory.png` | PNG | 267,243 B (261.0 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/05-sale-create.png` | PNG | 307,835 B (300.6 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/10-services-directory.png` | PNG | 246,045 B (240.3 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/19-inventory-management.png` | PNG | 238,041 B (232.5 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/22-reports-analytics.png` | PNG | 223,304 B (218.1 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/admin_live_technician_map.png` | PNG | 527,859 B (515.5 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/customer_profile.png` | PNG | 189,326 B (184.9 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/gst_tax_invoices_register.png` | PNG | 133,303 B (130.2 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/job_card_detail.png` | PNG | 133,303 B (130.2 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/machine_rentals_management.png` | PNG | 129,665 B (126.6 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/payments_and_collections.png` | PNG | 159,748 B (156.0 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/system_settings_configuration.png` | PNG | 132,961 B (129.8 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/technician_profile.png` | PNG | 158,093 B (154.4 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/admin/technicians_roster.png` | PNG | 121,301 B (118.5 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/auth/01-admin-login.png` | PNG | 531,866 B (519.4 KB) | **CONFIRMED UNUSED** | Superseded screenshot replaced by 02-admin-login.png when splash screen was added; unreferenced in README. |
| `docs/screenshots/auth/01-splash-screen.png` | PNG | 1,041,866 B (1017.4 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/auth/02-admin-login.png` | PNG | 1,061,501 B (1.01 MB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/auth/03-technician-login.png` | PNG | 52,896 B (51.7 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/auth/04-technician-otp.png` | PNG | 56,111 B (54.8 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/01-technician-dashboard.png` | PNG | 84,780 B (82.8 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/02-assigned-services.png` | PNG | 75,918 B (74.1 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/04-service-navigation.png` | PNG | 330,976 B (323.2 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/05-job-completion.png` | PNG | 66,427 B (64.9 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/06-profile.png` | PNG | 84,793 B (82.8 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/07-technician-notifications.png` | PNG | 51,844 B (50.6 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/mobile-01-dashboard.png` | PNG | 63,682 B (62.2 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `docs/screenshots/technician/mobile-03-navigation.png` | PNG | 183,554 B (179.3 KB) | CONFIRMED USED | Active screenshot embedded in README.md & scripts/capture-screenshots.ts. |
| `scripts/mailer/assets/sr_enterprises_logo.png` | PNG | 849,488 B (829.6 KB) | **KEEP — USAGE UNCERTAIN** | Canonical source PNG for lower_section_b64.php in PHP Mailer subsystem; kept to allow regeneration. |
| `scripts/mailer/assets/sr_enterprises_official_lower_section.png` | PNG | 135,377 B (132.2 KB) | **KEEP — USAGE UNCERTAIN** | Canonical source PNG for lower_section_b64.php in PHP Mailer subsystem; kept to allow regeneration. |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Bold.ttf` | TTF | 705,684 B (689.1 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSans-BoldOblique.ttf` | TTF | 643,292 B (628.2 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Oblique.ttf` | TTF | 635,416 B (620.5 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSans.ttf` | TTF | 757,076 B (739.3 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSansMono-Bold.ttf` | TTF | 331,992 B (324.2 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSansMono-BoldOblique.ttf` | TTF | 253,580 B (247.6 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSansMono-Oblique.ttf` | TTF | 251,932 B (246.0 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSansMono.ttf` | TTF | 340,712 B (332.7 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSerif-Bold.ttf` | TTF | 356,088 B (347.7 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSerif-BoldItalic.ttf` | TTF | 347,460 B (339.3 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSerif-Italic.ttf` | TTF | 345,996 B (337.9 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/fonts/DejaVuSerif.ttf` | TTF | 380,132 B (371.2 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/res/broken_image.png` | PNG | 618 B (0.6 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |
| `scripts/mailer/vendor/dompdf/dompdf/lib/res/broken_image.svg` | SVG | 581 B (0.6 KB) | CONFIRMED USED | Third-party vendor dependency (Dompdf font / error icon). |

---

## 6. Verification & Post-Cleanup Health Checks

The following automated validation checks were executed before and after cleanup:

1. **Static Analysis & Typecheck (`pnpm typecheck`):**
   - Result: 0 errors across all 7 workspace packages (`@crm/types`, `@crm/validation`, `@crm/shared`, `@crm/db`, `@crm/api`, `@crm/web`, and root scripts).
2. **Production Build (`pnpm build`):**
   - Result: Successfully compiled production bundle via Vite; `dist/` created cleanly with zero missing asset warnings.
3. **Automated Unit & Integration Tests (`pnpm --filter @crm/web test`):**
   - Result: 50 test files passed (100%), 263 unit/integration tests passed (100%).
4. **Codebase Cleanliness:**
   - Zero application code, styles, tests, or config files were modified to force an asset to be unused.
