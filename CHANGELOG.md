# Changelog

All notable changes to **Enterprises CRM** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-10-12 — Release Candidate

### Added
- **Technician Field Operations Portal (`/technician`):**
  - Mobile-first Progressive Web App (PWA) interface for field service engineers.
  - Passwordless 6-digit Email/SMS OTP authentication and secure session management (`/api/v1/technician-auth/*`).
  - Daily assigned jobs overview, step-by-step job card execution, checklist inspection, and customer signature capture.
  - Dual PWA manifest support (`manifest-admin.webmanifest` & `manifest-technician.webmanifest`) with dedicated service worker caches (`sw-admin.js` & `sw-technician.js`).
- **Real-Time GPS Telemetry & Admin Live Tracking:**
  - Native Android background location service via Capacitor bridge (`TechnicianLocationService.java`).
  - Secure telemetry ingestion endpoint (`POST /api/v1/maps/technician/location`) with WebSocket push broadcast.
  - Interactive Admin Live Technician Map (`AdminLiveTechnicianMap.tsx`) visualizing real-time engineer presence and workload.
- **Geographic Address Pinpointing:**
  - Interactive modal (`AddressPinpointModal.tsx`) allowing pinpoint customer location selection and coordinate storage.
- **Cloud & Infrastructure Automation:**
  - Comprehensive AWS EC2 deployment automation suite with PM2 process manager, Caddy reverse-proxy SSL, and systemd service failover.
  - Unified **Enterprises CRM** brand identity across all UI panels, legal invoice layouts, and default system settings.
- **Centralized Version Architecture:**
  - Established single authoritative version constant (`APP_VERSION = '1.2.0'`) in `@crm/shared`.
  - Synchronized version displays across `GlobalFooter`, `TechnicianLoginPage`, `TechnicianProfilePage`, `/health` probe, and system settings.

### Fixed
- **Customer Creation & Address Handling:** Resolved validation errors in customer modal and duplicate phone number resolution.
- **Type Safety & Build Gates:** Fixed TypeScript compilation errors in `AddressPinpointModal` and aligned strict typing.
- **Invoice Layout & Branding:** Replaced legacy SR logo with official Enterprises CRM vector branding across bills of supply and payment receipts.
- **Dashboard Responsiveness:** Adjusted operational metrics cards for balanced 2-column mobile and desktop viewports.

### Maintenance
- **Safe Static Asset Cleanup:** Audited 93 static assets; safely removed 9 verified orphaned files saving ~3.00 MB of storage (documented in `docs/CLEANUP_ASSET_AUDIT.md`).
- **Package Manifest Synchronization:** Aligned all monorepo `package.json` manifests (`root`, `apps/web`, `apps/api`, `apps/desktop`, and `packages/*`) to `1.2.0`.

---

## [1.1.0] - 2026-09-15

### Added
- **Backup & Disaster Recovery Subsystem:**
  - Automated database snapshot exports with SHA-256 integrity validation (`BackupValidator`).
  - Web UI modal in System Settings for point-in-time snapshot creation and archive inspection.
- **Dual-Database Supabase Cloud Architecture:**
  - Redundant archive storage on secondary database instance (DB2).
- **AI Support Chatbot Widget:**
  - Embedded customer support assistant with training engine and contextual query handling.
- **PWA Baseline:**
  - Initial service worker registration and installable web application manifests.

### Fixed
- Dues ledger query error handling and zero-activity date serialization.
- SMTP timeout issues with dual-engine failover on port 465 SSL.

---

## [1.0.0] - 2026-09-10 (Tag: `CRM-PRODUCTION-QA-BASELINE`)

### Added
- Initial commercial release baseline for water purification (RO) and home appliance enterprise management.
- Complete core operational modules: Customer Directory, Sales Orders, GST Tax Invoices, Payments & Collections, Customer Assets, Service Dispatches, Field Job Cards, Inventory Register, and Operational Reports.
- Automated Indian GST tax calculation (CGST/SGST 9%+9% or IGST 18%) with printable bills of supply.
- Role-based access control (RBAC) supporting `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, and `TECHNICIAN`.
