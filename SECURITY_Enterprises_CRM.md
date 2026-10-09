# SECURITY.md — Enterprises CRM Security Constitution

> **Status:** Mandatory engineering policy  
> **Security priority:** Critical  
> **Product:** Enterprises CRM  
> **Developed by:** Siddharth & Kartik  
> **Development time:** 2 months  
> **Product year:** 2026  
> **Product version:** 1.2.0  
> **Document purpose:** Security requirements for design, implementation, testing, deployment, operation and future changes.

---

## Table of Contents

1. [Purpose, Scope and Normative Language](#1-purpose-scope-and-normative-language)
2. [Project Reality and Architecture Discovery](#2-project-reality-and-architecture-discovery)
3. [Security Principles](#3-security-principles)
4. [Threat Model and Protected Assets](#4-threat-model-and-protected-assets)
5. [Data Classification, Privacy and Retention](#5-data-classification-privacy-and-retention)
6. [Trust Boundaries and Secure Architecture](#6-trust-boundaries-and-secure-architecture)
7. [Identity, Authentication and Account Lifecycle](#7-identity-authentication-and-account-lifecycle)
8. [Admin, Super Admin and Privileged-Account Security](#8-admin-super-admin-and-privileged-account-security)
9. [Technician Portal Authentication and OTP](#9-technician-portal-authentication-and-otp)
10. [Session and Token Security](#10-session-and-token-security)
11. [Authorization and Role-Based Access Control](#11-authorization-and-role-based-access-control)
12. [Object-Level and Property-Level Authorization](#12-object-level-and-property-level-authorization)
13. [API and Request Security](#13-api-and-request-security)
14. [Rate Limiting, Abuse Controls and Availability](#14-rate-limiting-abuse-controls-and-availability)
15. [CSRF, CORS and Browser-Origin Security](#15-csrf-cors-and-browser-origin-security)
16. [XSS and Safe Content Rendering](#16-xss-and-safe-content-rendering)
17. [Injection, Query Safety and Mass Assignment](#17-injection-query-safety-and-mass-assignment)
18. [SSRF, Redirects, Host Headers and Outbound Requests](#18-ssrf-redirects-host-headers-and-outbound-requests)
19. [File Uploads, Attachments and Generated Documents](#19-file-uploads-attachments-and-generated-documents)
20. [Invoices, Payments and Financial Integrity](#20-invoices-payments-and-financial-integrity)
21. [GPS, Maps and Technician Location Privacy](#21-gps-maps-and-technician-location-privacy)
22. [Redis, Cache and Temporary State](#22-redis-cache-and-temporary-state)
23. [PostgreSQL and Database Security](#23-postgresql-and-database-security)
24. [Socket.IO and WebSocket Security](#24-socketio-and-websocket-security)
25. [HTTPS, TLS and Security Headers](#25-https-tls-and-security-headers)
26. [Secrets and Environment Configuration](#26-secrets-and-environment-configuration)
27. [Logging, Audit Trails, Monitoring and Alerting](#27-logging-audit-trails-monitoring-and-alerting)
28. [Email, WhatsApp, Webhooks and External Integrations](#28-email-whatsapp-webhooks-and-external-integrations)
29. [PWA, Browser Storage and Offline Behavior](#29-pwa-browser-storage-and-offline-behavior)
30. [Native Android and Desktop Security, If Present](#30-native-android-and-desktop-security-if-present)
31. [AI Assistant and Automation Security, If Present](#31-ai-assistant-and-automation-security-if-present)
32. [Dependency and Software-Supply-Chain Security](#32-dependency-and-software-supply-chain-security)
33. [Deployment and Infrastructure Security](#33-deployment-and-infrastructure-security)
34. [Backups, Recovery and Data Integrity](#34-backups-recovery-and-data-integrity)
35. [Safe Errors and Failure Handling](#35-safe-errors-and-failure-handling)
36. [Security Testing and Verification](#36-security-testing-and-verification)
37. [Security Incident Response](#37-security-incident-response)
38. [Security Change Control and Escalation](#38-security-change-control-and-escalation)
39. [Production Release Gate](#39-production-release-gate)
40. [Antigravity Mandatory Directive](#40-antigravity-mandatory-directive)
41. [Authoritative Security References](#41-authoritative-security-references)

---

## 1. Purpose, Scope and Normative Language

Enterprises CRM is a business-management CRM with an integrated Technician Portal. The Technician Portal is **part of Enterprises CRM**, not a separate product or an independent authorization boundary. It may use a distinct route, layout or native wrapper, but it shares the CRM's authoritative backend and business records.

This file defines mandatory security constraints for the entire product, including:

- Admin, Super Admin and Staff experiences;
- the integrated Technician Portal and technician authentication;
- frontend, backend, APIs and server-side actions;
- PostgreSQL, Redis, queues and background workers;
- customers, services, job cards, invoices, payments and inventory;
- Google Maps, GPS updates, live technician tracking and Socket.IO;
- email, WhatsApp and other integrations actually present;
- uploaded files, signatures, receipts and generated documents;
- PWA/browser behavior and any native Android/Electron targets that exist;
- build pipelines, deployment, secrets, monitoring, backups and incident response.

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are normative. MUST/MUST NOT requirements are mandatory unless a documented conflict is escalated and explicitly approved by the product owner.

Security controls must be implemented and tested, not merely documented. A checklist item is not evidence that a control exists. Every control must be mapped to real code/configuration/tests or recorded as an unresolved gap.

No document can guarantee that software is perfectly secure. The objective is defense in depth, minimum exposure, verified controls, fast detection and safe recovery.

## 2. Project Reality and Architecture Discovery

### 2.1 Product identity

- **Official product name:** Enterprises CRM
- **Developed by:** Siddharth & Kartik
- **Development time:** 2 months
- **Year:** 2026
- **Product version:** 1.2.0
- **Product topology:** One CRM product; the Technician Portal is integrated into it.

### 2.2 Verify the repository before applying technology-specific controls

The implementation agent MUST inspect the current repository, manifests, lockfiles, environment templates, deployment configuration, API routes and runtime entry points before claiming that a security control exists or changing a dependency.

The project has been described as using a React/Vite frontend, Fastify backend, PostgreSQL, Redis, Socket.IO and email infrastructure. Google Maps and live technician tracking are part of the product requirements. Redis queues/BullMQ, PHPMailer/NodeMailer, PWA support, Electron and a native Android tracking wrapper must be confirmed from the current repository before treating each as deployed.

Do NOT assume that the following unrelated architecture choices exist merely because they appear in generic security examples: MongoDB, Supabase Auth, Better Auth, Next.js, Vercel Blob, Resend, Cloudflare Turnstile, or a public portfolio contact form. Use only the database, authentication library, file storage, mail provider, hosting and validation libraries verified in the current source tree.

### 2.3 Security implementation rule

For each security requirement:

1. identify the real trust boundary;
2. locate the current implementation;
3. verify the control is active in production configuration;
4. add a regression/security test;
5. make the smallest safe change;
6. document any unresolved limitation.

Do not replace a functioning authentication provider, database, queue or tracking architecture merely to follow a generic example. If a material security flaw cannot be fixed without architectural change, stop and present the risk and options for approval.

## 3. Security Principles

1. **Assume the client is hostile.** Browser state, hidden controls, query parameters, path IDs, headers and request bodies can be changed by an attacker.
2. **Server-side enforcement is mandatory.** The frontend is a user interface, not a security boundary.
3. **Least privilege.** Users, application processes, database accounts, API keys, workers and third-party integrations receive only the permissions they require.
4. **Deny by default.** Unknown routes, actions, roles, properties, files, event names and token scopes must be denied unless explicitly authorized.
5. **Fail closed.** If authentication, authorization, signature verification or required validation fails, do not proceed.
6. **Defense in depth.** Combine authentication, authorization, validation, output encoding, rate limits, monitoring and secure deployment; do not rely on a single control.
7. **Secure defaults.** Production must not start with debug features, sample credentials, permissive origins or optional authentication enabled.
8. **Minimize data.** Collect and disclose only what is needed for the user's job. Define retention and deletion behavior.
9. **Integrity first for business mutations.** Payments, invoice balances, stock movements, job completion and service assignment must be checked and committed on the server using existing authoritative logic.
10. **Privacy by design.** Customer data, financial records, signatures and live technician location are sensitive. Access and retention must be limited.
11. **Traceability without secrets.** Security events must be auditable without writing passwords, OTP values, tokens, credentials or unnecessary GPS coordinates to logs.
12. **No silent weakening.** Security controls must not be disabled to solve build, deployment, performance or UX problems without an explicit risk review and approval.

## 4. Threat Model and Protected Assets

Assume the application is exposed to:

- automated scanners, bots and credential stuffing;
- brute force, password spraying, OTP guessing and account enumeration;
- malicious or compromised Admin, Staff or Technician accounts;
- object-level authorization failures and cross-technician access;
- tampered frontend requests and mass assignment;
- XSS, CSRF, SQL injection, command injection, SSRF and path traversal;
- forged/replayed webhooks and repeated state-changing requests;
- malicious or oversized uploads;
- leaked source maps, secrets, logs, backups or deployment artifacts;
- vulnerable dependencies, compromised packages and unauthorized build changes;
- WebSocket origin abuse, unauthorized rooms and event flooding;
- GPS spoofing, forged technician location updates and tracking-token replay;
- denial of service, resource exhaustion, slow requests and expensive queries;
- misconfigured PostgreSQL, Redis, Nginx, HTTPS or cloud access;
- accidental data exposure through caching, exports, PDFs, receipts, email or AI context.

### 4.1 Protected assets

- user credentials, sessions, OTP challenges and recovery secrets;
- customer contact details, addresses and service records;
- invoices, amounts due, payments, receipts and audit events;
- technician profiles, assignments and job-card execution records;
- GPS coordinates, location timestamps, active destination and movement status;
- uploaded images, attachments, signatures and generated documents;
- business settings, mail credentials, Maps keys and other service secrets;
- database data, backups, Redis state and production logs;
- code, build artifacts, dependencies, release configuration and CI/CD credentials.

### 4.2 High-risk threat scenarios to test explicitly

- Technician A modifies a URL or API body to read Technician B's work, profile, payment or location.
- Staff or Technician attempts an Admin-only endpoint directly.
- A browser sends a payment amount higher than the invoice's current outstanding balance.
- Two concurrent payment requests both pass a stale balance check.
- A stolen or replayed GPS credential publishes location after destination switch or logout.
- A Socket.IO client joins another technician's room or subscribes to the Admin live map without permission.
- A disabled technician continues using an existing session or tracking token.
- A public/static cache serves one user's private response to another.
- A backup or Redis persistence artifact retains GPS data beyond the approved retention period.

## 5. Data Classification, Privacy and Retention

Classify data before exposing, logging, caching, exporting or storing it.

| Classification | Examples | Required handling |
|---|---|---|
| Public | Explicitly public company/product information | May be public after approval; never include secrets or private CRM data. |
| Internal | Operational configuration, non-sensitive status metadata | Authenticated/authorized access where applicable; no public diagnostic endpoints. |
| Confidential | Customer details, addresses, service/job records, staff/technician profile, invoice/payment data, receipts, attachments | Server-side authorization, TLS, controlled logs, access auditing and defined retention. |
| Highly restricted | Password hashes, OTP verifiers, session IDs, API tokens, private keys, database/Redis/mail credentials, GPS coordinates and temporary tracking credentials | Strict access restriction, short retention where possible, never log values, never put in client bundles, strong transport/storage protection. |

### 5.1 Privacy requirements

- Collect only data required to operate the CRM and perform assigned work.
- Do not expose global customer, payment or workforce data to a Technician unless the existing role explicitly permits it.
- Do not expose customer data in notification previews if a secure portal fetch can retrieve the detail after authentication.
- Never include private customer information in URLs unnecessarily.
- Define access, retention, export and deletion behavior for each sensitive data category.
- Do not claim regulatory compliance without a documented assessment for the relevant jurisdiction and processing activity.
- If data is sent to a third-party service, document the purpose, payload, recipient and credential scope.

### 5.2 Location retention rule

Technician location is sensitive operational/personal data. The product requirement is temporary current/recent location state, not a permanent route history.

- Store live tracking state only in the approved temporary tracking mechanism.
- Use the current configured Redis TTL; the intended retention target is approximately 1–2 hours maximum, and shorter where possible.
- Do not create a PostgreSQL GPS-history table, permanent location playback, GPS export or analytical movement history without explicit product-owner approval and a separate privacy/security review.
- Do not log raw coordinates or include them in routine audit records.
- Review Redis snapshots, AOF, backups and restore procedures so transient GPS data does not become a retrievable historical archive beyond the approved retention policy.
- A restored location must not be presented as live merely because it exists in a backup; validate timestamp, active-session validity and freshness before use.
- Clear or expire location state when the authorized tracking lifecycle ends, subject to the existing tracking rules.

## 6. Trust Boundaries and Secure Architecture

The current backend remains the authoritative security boundary for business data and state transitions.

- Browser/PWA clients must not connect directly to PostgreSQL or Redis.
- All sensitive reads and mutations must pass through authenticated, authorized backend logic.
- The Technician Portal is part of Enterprises CRM. Its route/layout separation does not make its requests trustworthy and does not justify a separate database or business-logic engine.
- Existing Fastify services and business operations must remain the authority for job cards, invoices, payments, stock and service status.
- Redis is an internal temporary-state/coordination component, not a public API.
- Socket.IO must authenticate connections and authorize every sensitive subscription/event.
- Use a reverse proxy only with a deliberately configured trusted-proxy policy. Do not blindly trust forwarded IP/protocol/host headers.
- Do not create alternate, debug, legacy or hidden endpoints that bypass the main authentication/authorization middleware.
- Maintain an inventory of REST routes, Socket.IO events, scheduled jobs, webhook routes, internal endpoints and native bridge methods.

## 7. Identity, Authentication and Account Lifecycle

### 7.1 General authentication

- Use the currently approved authentication/session library after verifying its configuration; do not build custom authentication unnecessarily.
- Authenticate each protected request at the server.
- Use modern, salted, adaptive password hashing supported by the approved authentication implementation, such as Argon2id where compatible. Never store plaintext or reversibly encrypted passwords.
- Never log or return passwords, hashes, OTPs, recovery codes or tokens.
- Use generic failure messages where detailed responses would permit account enumeration.
- Validate account active/disabled state on authentication and on sensitive operations where revocation must take effect promptly.
- Rate-limit authentication and recovery endpoints server-side.
- Log successful and failed security-relevant authentication events without storing credentials.
- Prevent duplicate or ambiguous identities from creating privilege confusion.
- Account creation, role assignment, activation, deactivation and recovery must be authorized and auditable.

### 7.2 Account lifecycle

- New accounts must be provisioned through the approved invitation or administrative flow.
- No well-known default account/password may remain enabled in production.
- Do not seed a publicly known `admin/admin` account or other default credentials.
- If the existing system has a bootstrap administrator, the first-run flow must use a one-time secret/invitation or controlled out-of-band setup, expire after use, be disabled after successful initialization and never be embedded in source code or production documentation.
- Disabling or deleting an account must revoke active sessions and any associated native tracking credentials.
- Role or privilege changes must take effect server-side and must not rely on cached frontend role state.
- Account recovery must be at least as strong as normal authentication; security questions are not an acceptable substitute for secure recovery.

### 7.3 Password reset, if present

Reset tokens must be generated with a cryptographically secure random generator, sufficiently long, single-use, short-lived, stored safely and invalidated after successful use. Do not place reset tokens or passwords in logs or unnecessary URLs. Return generic request responses to avoid account enumeration. Invalidate relevant sessions after password reset where supported by the authentication system.

## 8. Admin, Super Admin and Privileged-Account Security

Admin access can expose customer, financial, workforce, settings and location information. Privileged accounts require stronger protection.

- Enforce MFA for Super Admin and privileged Admin accounts before production where the current authentication architecture permits it. Prefer phishing-resistant passkeys/WebAuthn; TOTP is an acceptable alternative when supported. Do not treat IP allowlisting or a technician's GPS location as an authentication factor.
- If privileged MFA is not currently available, record it as a production security gap and propose a secure implementation plan rather than pretending the control exists.
- Require re-authentication or step-up verification for high-impact operations where supported: changing privileged roles, changing authentication credentials, modifying security settings, exporting large volumes of data, restoring backups or performing payment reversals.
- Use least-privilege roles and separate everyday accounts from exceptional system-administration access where practical.
- Avoid permanent broad Super Admin access for routine work.
- Alert on repeated failed logins, new privileged-account creation, unexpected role changes and suspicious access patterns.
- Do not permit privilege elevation through client-controlled fields, hidden buttons or local storage.
- Recovery of a privileged account must not be weaker than its normal authentication path.

## 9. Technician Portal Authentication and OTP

The Technician Portal is integrated into Enterprises CRM. Technician authentication remains a first-class security boundary.

The current portal specification uses registered mobile number + registered technician name to identify the record, followed by a CRM-generated OTP delivered to the registered email. Treat name and mobile number as identifiers, not secret credentials.

### 9.1 OTP requirements

- Generate OTPs with a cryptographically secure random-number generator.
- Follow the current approved flow and challenge policy; current portal specification targets a 6-digit OTP, 5-minute validity and no more than 3 verification attempts unless security review approves a stricter policy.
- Store only a short-lived verifier (prefer a keyed/HMAC-based verifier where appropriate), never the plaintext OTP.
- Every challenge must have a unique unpredictable challenge ID and be bound to one technician, purpose and expiry.
- OTPs must be single-use and invalidated after successful verification.
- A new OTP request for one technician invalidates that technician's previous challenge without affecting another technician's challenge.
- Keep concurrent technicians' OTP state entirely independent. Never use a global/current shared OTP.
- Rate-limit OTP requests and verification separately by technician identity, registered email, source IP and reasonable additional abuse signals.
- Prevent one technician or IP from exhausting a single global limit and blocking all technicians.
- Use generic responses that do not reveal unnecessary information about whether a technician, phone or email exists.
- Do not include OTPs in logs, analytics, traces, URLs or client error messages.
- Queue email delivery using existing approved mail infrastructure; handle provider failures safely and permit retry only under rate limits.
- Invalidate challenges on disablement, account deactivation or applicable security changes.
- Add concurrency, expiry, replay, guessing and rate-limit tests.

### 9.2 Technician access control

- Portal access must be enabled administratively and tied to the existing technician record.
- The backend must derive technician identity from the verified server-side session/context, not from `technicianId` supplied by the browser.
- A technician must not access another technician's profile, assignments, jobs, linked invoices, payments, notifications or location.
- A technician must not access company-wide analytics, global customer directories, unrelated invoices/payments, roles, users, settings or backup controls unless a separate explicit permission exists in the verified RBAC implementation.
- Disabling portal access must revoke or invalidate the technician's sessions and active native tracking credentials where present.

## 10. Session and Token Security

- Use the existing approved server-side session/token architecture; do not introduce a competing session system for convenience.
- Rotate session identifiers after successful authentication and privilege changes where supported.
- Define idle and absolute session expiry.
- Invalidate sessions on logout, account disablement and important security events.
- Provide a way to revoke all sessions after suspected compromise.
- For browser cookie sessions, use `HttpOnly`, `Secure` in production and a deliberate `SameSite` policy. Prefer host-only cookies and the `__Host-` prefix when compatible with the architecture.
- Do not store session IDs or long-lived authentication credentials in `localStorage` or URLs.
- Apply CSRF protection to cookie-authenticated state-changing requests.
- Use sufficient entropy and safe rotation for opaque session identifiers.
- Ensure the backend checks token/session expiry, revocation and current permissions; do not trust role claims that can remain valid after a role change without a suitable revocation strategy.
- Never place credentials or private tokens in analytics, client-side logs, browser error telemetry or referrer-bearing URLs.
- Native tracking capabilities, if present, must be purpose-limited to the currently authorized location-update operation, short-lived, revocable and unusable as general CRM authentication.

## 11. Authorization and Role-Based Access Control

Authentication says who the actor is; authorization determines what that actor can do. Every protected operation must enforce both server-side.

- Maintain an explicit role/permission matrix based on the actual existing product roles and permissions. Do not guess or silently grant permissions.
- Preserve existing Super Admin, Admin and Staff role semantics and the distinct Technician role/context where it exists.
- Deny by default when a role/action combination is undefined.
- Check authorization on every backend route, mutation, file operation, WebSocket subscription/event, export, background job and administrative action.
- Re-check sensitive authorization after privilege/session changes.
- Do not treat frontend route guards, hidden buttons, local storage, unguessable IDs or PWA scope as security controls.
- Do not allow a Staff role to inherit Admin powers through an omitted check or inconsistent middleware.
- Do not create broad permissions solely because a particular screen needs one narrow operation.
- Keep administrative correction, historical-payment reversal, account management and global reporting permissions out of Technician access unless separately reviewed and explicitly authorized.

## 12. Object-Level and Property-Level Authorization

Every request that reads or mutates a record must verify access to that exact record and every sensitive field returned or changed.

- Authenticate the actor.
- Check the required role/permission.
- Scope the query to the actor's authorized resources where practical.
- Verify ownership/assignment relationships before returning or changing data.
- Authorize properties independently, not just the record as a whole.
- Select/serialize only fields required by the client.
- Never accept an arbitrary client object and persist all of its properties.
- Reject protected fields such as role, technician ID, portal-enabled state, ownership, audit fields, payment status, calculated totals and timestamps unless that exact mutation is authorized and server-controlled.
- Do not rely on IDs being random or hidden.
- Use consistent safe responses for inaccessible resources, according to the existing API convention.

### 12.1 Technician-specific object scope

For every service, job card, customer context, invoice, payment, attachment, notification, active destination and tracking session, verify that it belongs to or is explicitly accessible to the authenticated technician through the current authorized assignment.

Technician A must not gain access to Technician B by changing path IDs, query parameters, request bodies, Socket.IO room names, event payloads, native tracking session IDs or cached frontend state.

## 13. API and Request Security

Treat every request as attacker-controlled, whether public, authenticated, internal, browser-originated or sent by a native client.

- Validate path parameters, query strings, request bodies, relevant headers, identifiers, pagination, sort fields, filters and uploaded metadata using the project's existing runtime validation mechanism. If Zod is already established, use it consistently; do not add a new validator solely for style.
- Define explicit input schemas and writable fields for each mutation.
- Reject malformed, unexpected, impossible, ambiguous and excessively large values.
- Use allowlists for sort fields, filter fields, actions and enums.
- Bound pagination, query complexity, page sizes and response sizes.
- Set request/body limits, timeouts and concurrency limits where supported.
- Use parameterized SQL/prepared statements or safe query-builder parameters; never concatenate untrusted data into SQL.
- Do not pass raw client objects into database query operators.
- Do not execute user input in a shell, dynamic code evaluator, template engine or filesystem path.
- Do not expose stack traces, database errors, internal paths, SQL text or environment variables in responses.
- Avoid unnecessary data exposure in responses, including internal database fields and unrelated customer/payment information.
- Disable or restrict interactive API documentation, debug endpoints and test routes in production.
- Maintain an inventory of production routes and remove or disable obsolete/duplicate test endpoints only after verifying they are not used.
- Version and document intentional API changes; do not create undocumented bypass endpoints.

## 14. Rate Limiting, Abuse Controls and Availability

Apply server-side, per-operation rate limits to at least:

- Admin login, privileged MFA and account recovery;
- Technician OTP request, resend and verification;
- session creation and suspicious authentication flows;
- sensitive mutations and repeated authorization failures;
- file upload/download operations;
- expensive reports, search/export and large list endpoints;
- email/WhatsApp sending and other cost-incurring integrations;
- public endpoints, if any;
- GPS update transport and Socket.IO events;
- webhook endpoints where present.

Requirements:

- Use atomic/distributed rate limiting if the service runs across multiple instances; reuse Redis safely if it is already the approved mechanism.
- Apply limits by identity as well as IP where appropriate so shared networks do not unfairly block all users.
- Do not trust forwarded client IP headers unless they are supplied by a verified trusted proxy.
- Return safe retry guidance without exposing internal rate-limit keys.
- Avoid permanent account lockouts that attackers can trigger against a victim.
- Place timeouts, concurrency limits, body-size limits and bounded queues around resource-intensive operations.
- Prevent unrestricted database scans, giant exports, infinite retries and unbounded WebSocket messages.
- Monitor abnormal request rates and resource exhaustion.

## 15. CSRF, CORS and Browser-Origin Security

### 15.1 CSRF

Where browser authentication uses cookies or another automatically attached credential, protect state-changing operations against cross-site request forgery.

- Use the framework's appropriate CSRF protection or a synchronizer/double-submit token pattern where applicable.
- Validate `Origin` and, where appropriate, `Referer` on unsafe requests.
- Use `SameSite` cookies as defense in depth, not as the only control.
- Do not perform destructive or state-changing actions through GET.
- Protect login/session-changing flows from login CSRF where relevant.
- Test the actual deployed origin topology; do not blindly change cookie or CSRF configuration to resolve a cross-origin error.

### 15.2 CORS

- Allow only the actual, required production and development origins.
- Do not use wildcard origins with credentialed authentication.
- Do not use naive substring matches or trust arbitrary `Origin` values.
- Restrict methods and headers to what the application uses.
- Keep CORS separate from authentication and authorization; non-browser clients can call APIs directly.
- Treat development tunnels and temporary HTTPS origins as development-only unless explicitly approved.

## 16. XSS and Safe Content Rendering

Treat all user-provided, imported, third-party and database-stored content as untrusted.

This includes customer/technician names, notes, addresses, service descriptions, uploaded filenames, job execution notes, payment references, notification text, email content, chat/assistant content and business-configurable fields.

- Use framework-appropriate contextual output encoding.
- Do not use `dangerouslySetInnerHTML`, raw DOM insertion, unsanitized Markdown/HTML rendering or executable dynamic templates unless explicitly required and reviewed.
- If rich HTML is essential, sanitize with a maintained allowlist-based sanitizer at the correct trust boundary and still encode output appropriately.
- Never treat data as safe because it came from PostgreSQL or an Admin form.
- Validate URL protocols before rendering clickable links; reject `javascript:` and other dangerous schemes.
- Do not execute SVG/HTML uploaded by users inline in the application origin.
- Generate safe filenames and encode them when used in headers or document links.
- Add stored/reflected/DOM XSS tests for all relevant text fields and document previews.

## 17. Injection, Query Safety and Mass Assignment

- Use parameterized database operations and safe ORM/query-builder APIs.
- Never concatenate user input into SQL, shell commands, LDAP/NoSQL syntax, regular expressions or template code without proper safe handling.
- Validate IDs and enum values before using them in business services.
- Build database filters from explicit allowed fields rather than accepting user-defined query operators or raw SQL fragments.
- Whitelist sortable and filterable columns.
- Reject unexpected properties on sensitive mutation endpoints or explicitly strip them under a documented schema policy.
- Calculate invoice totals, GST, payment balances, inventory/FIFO costs, authorization decisions and state transitions on the server through existing authoritative business logic.
- Apply separate read/write allowlists to sensitive properties.
- Protect exports (including CSV) against formula injection by safely encoding cells that could be interpreted as formulas by spreadsheet software.
- Avoid using dynamic code evaluation or executing content from the database.

## 18. SSRF, Redirects, Host Headers and Outbound Requests

- Do not create a generic server-side URL-fetching proxy.
- For required external HTTP requests, define an explicit list of permitted schemes/hosts/ports and constrain redirects, timeouts, response sizes and content types.
- Block loopback, private, link-local and cloud metadata destinations where fetching arbitrary user-controlled URLs is a feature; revalidate redirect targets and resolved addresses to reduce DNS rebinding risks.
- Keep webhook testing, URL previews, imports and remote-image features behind separate security review.
- Validate redirect/return-to destinations; prefer safe internal relative paths or an explicit allowlist.
- Reject dangerous schemes such as `javascript:`.
- Validate allowed hosts and trusted-proxy configuration to prevent Host-header poisoning, password-reset-link poisoning and incorrect redirect construction.
- Do not derive absolute URLs for security links from an untrusted Host or forwarded-host header.
- For Google Maps or approved integrations, call only the intended documented endpoints; do not allow the client to cause arbitrary server-side requests.

## 19. File Uploads, Attachments and Generated Documents

First verify which upload, signature, photo, receipt, PDF and attachment features actually exist. Apply these controls to every applicable route and storage mechanism.

### 19.1 Upload validation

- Enforce an allowlist of file categories and extensions required by the feature.
- Validate decoded filenames, extensions, reported MIME type and actual file signatures where practical. No single check is sufficient.
- Enforce file-size, image-dimension, page-count, decompression and processing-time limits as applicable.
- Generate storage identifiers; never use a client-supplied filename as the storage path.
- Reject traversal patterns, path separators, null bytes, unexpected extensions and unsupported formats.
- Prevent executable files, server configuration files and unexpected archives from being uploaded.
- Re-encode images where appropriate; perform scanning/sandboxing for risky file types when feasible and proportionate.
- Authorize the actor before upload, retrieval, replacement or deletion, and verify access to the linked customer/service/job.
- Apply quotas and rate limits.
- Do not let uploaded content execute under the application's origin.

### 19.2 Storage and access

- Store uploaded files outside executable web roots or in appropriately isolated object storage.
- Use private storage for customer documents, signatures, internal records and technician evidence unless a particular asset is deliberately public.
- Serve private files through an authorization-checked endpoint or short-lived scoped URLs.
- Prevent public bucket/object ACLs for private data.
- Use `Content-Disposition` and content-type/nosniff behavior appropriate to the file type.
- Do not expose permanent predictable links to private documents.
- Do not trust file extensions, URL secrecy or browser preview controls as access protection.

### 19.3 PDFs, receipts, printing and exports

- Treat data inserted into HTML templates, PDFs, print layouts and email receipts as untrusted.
- Prevent stored XSS, HTML injection, formula injection, path injection and server-side template injection.
- Authorize every generated/downloaded document against its source record.
- Do not expose unrelated invoice/payment/customer data through document IDs.
- Ensure generated documents do not unintentionally reveal stack traces, filesystem paths, credentials or internal configuration.

## 20. Invoices, Payments and Financial Integrity

Existing CRM invoice and payment logic is authoritative. Do not create a second payment ledger or duplicate financial engine.

The Technician Portal records payments against authorized existing service invoices; it is not a payment processor and does not establish payment success merely by displaying a QR code.

- Treat client-provided amount, invoice ID, payment method, outstanding balance, status, receipt number and transaction reference as untrusted input.
- Recalculate and validate the current outstanding amount on the server using existing authoritative logic.
- Require a positive amount that does not exceed the currently payable outstanding balance.
- Enforce the check and ledger write atomically using existing transaction/locking mechanisms so concurrent requests cannot overpay an invoice.
- Make retries safe using idempotency/duplicate protection; a double click or retried request must not create duplicate payments.
- Restrict technician payment recording to an invoice associated with a service/job the authenticated technician is authorized to access.
- Technicians must not create arbitrary invoices, edit invoice totals, cancel invoices, reverse payments, alter historical payment records or access the global payment ledger unless a separately reviewed permission explicitly allows it.
- Validate payment-method values against the server-side allowed enum.
- Validate payment references/UTRs as bounded text; never interpret them as trusted proof of payment.
- Keep receipt numbering, totals, paid amounts, balances and status changes in the existing business logic.
- Log an audit event for payment creation and authorized correction/reversal without logging secrets or unnecessary personal data.
- Restrict historical payment correction/reversal to authorized roles and preserve auditability.
- Do not store payment-card data or CVV. If an external gateway is introduced later, require a separate payment-security review and verify payments server-side through trusted provider APIs/webhooks.
- Never fulfill a paid action solely because the frontend reports success.

## 21. GPS, Maps and Technician Location Privacy

Location is sensitive information. Protect acquisition, transmission, display and retention.

### 21.1 Authorization and lifecycle

- Only collect technician location for the existing explicitly authorized tracking/navigation workflow and according to its current permission/lifecycle rules.
- Browser location permission is required for browser geolocation; do not bypass it or claim that permission was granted when it was not.
- A location permission or location coordinate is not proof of identity or authorization.
- The server must bind every update to the authenticated technician and the authorized active tracking/navigation session.
- Do not trust a client-supplied technician ID or destination ID without server-side authorization.
- Keep the existing one-active-destination rule.
- A navigation start is not equivalent to job start or job completion.
- Keep operational state separate from GPS freshness. A stale fix must not silently overwrite a valid `ON_THE_WAY`/job state.
- Do not present an old coordinate as a current live position; show last-update time and freshness accurately.

### 21.2 Location update validation

- Use HTTPS for production updates.
- Validate coordinate ranges, timestamps, accuracy and payload size.
- Reject unauthorized, expired, revoked, out-of-session and materially out-of-order updates.
- Prevent replay from old tracking sessions.
- Apply bounded update rates and payload limits.
- Do not log raw coordinates in routine access/error logs.
- Do not treat GPS alone as proof of arrival, attendance, payment or job completion.
- Use current approved arrival-detection logic; do not change business-state transitions in a tracking transport handler.

### 21.3 Native tracking capability, if a native Android wrapper/service exists

- Start background location only through the approved, user-initiated and permission-compliant lifecycle.
- Provide the required transparent operating-system foreground notification while active.
- Use narrowly scoped, short-lived and revocable tracking credentials if native uploads cannot safely use the existing session.
- Such credentials must authorize only location updates for the currently active authorized navigation session, not general CRM APIs.
- Revoke the credential on logout, destination switch, reassignment, cancellation, completion or session invalidation as applicable.
- Store native secrets using platform-protected storage; do not embed long-lived server credentials in the APK.
- Never claim guaranteed background tracking when the OS has suspended/stopped it or permissions are unavailable.

### 21.4 Maps keys

- Browser Google Maps keys are intentionally visible to the browser, so restrict them by the applicable HTTP referrers/origins and only the required APIs.
- Keep server-side Routes/Maps credentials, if used, in the backend environment and restrict them to server use and required APIs.
- Never expose server keys through `VITE_*` variables, frontend assets, source maps or logs.
- Do not geocode or retain extra location data unnecessarily.

## 22. Redis, Cache and Temporary State

- Redis must not be publicly exposed to the Internet.
- Bind to loopback/private interfaces and use network controls, authentication/ACLs and TLS when the deployment topology requires them.
- Use a least-privilege Redis account where supported; do not use a broad administrative account for application operations.
- Protect Redis from unauthenticated access, unsafe commands and cross-environment reuse.
- Use distinct, documented key namespaces for session, OTP, rate-limit, queue and live-location state.
- Use safe key construction; never allow raw user input to select arbitrary keys or commands.
- Apply TTL to all transient OTP, temporary session capability and live-location records that require expiry.
- Verify TTLs after writes and on error/retry paths; never leave temporary secrets or location state without the intended expiry.
- Do not use Redis as an authorization bypass; validate identity and resource ownership before reading/writing sensitive state.
- Do not cache private API responses in a shared/public cache.
- Treat cache entries as untrusted/stale unless their integrity, scope and expiry are verified.
- Review Redis persistence, AOF/RDB, snapshots and backups so sensitive transient GPS data is not retained beyond the approved policy or restored as a live location.
- Do not disable persistence globally if it is needed for other CRM features without a separate architecture review. Solve location-retention risks without silently breaking queues, sessions or unrelated state.

## 23. PostgreSQL and Database Security

PostgreSQL is the authoritative relational data store if confirmed by the current deployment; verify the actual live database configuration before implementation.

- Database credentials must remain server-side.
- Do not connect browsers or public clients directly to the production database.
- Use parameterized queries or safe query builders.
- Runtime application credentials must not be superuser/owner credentials; use least privilege for required tables and operations.
- Use separate migration/administrative credentials from ordinary runtime credentials where feasible.
- Restrict database network access to the application host/private network and approved administrative paths.
- Use TLS for database connections when traffic crosses a network that is not fully trusted, and verify certificates according to deployment requirements.
- Review indexes, constraints and foreign keys that enforce critical relationships and uniqueness.
- Use transactions for multi-step financial, inventory and job operations.
- Use optimistic/pessimistic locking or equivalent atomic logic where concurrent requests can violate business invariants.
- Validate migration scripts and review destructive operations before production deployment.
- Never run a destructive reset, truncate or drop operation against production as a deployment convenience.
- Minimize the columns returned by queries and avoid exposing internal database records directly.
- Apply record/field authorization before data is returned, not only in the UI.
- Protect database logs from credential leakage and excessive personal data.
- Keep database versions patched and use secure backup/restore procedures.
- If row-level security is already part of the architecture, verify the policies and ensure privileged connection modes do not unintentionally bypass them. Do not assume RLS exists or replace server authorization with RLS alone.

## 24. Socket.IO and WebSocket Security

Socket.IO transports live CRM and technician tracking events and must be treated as a sensitive API surface.

- Require authentication at connection time using the existing approved session/token mechanism.
- Validate `Origin` against an explicit allowlist on browser handshakes. Origin validation is additional protection, not authentication for non-browser clients.
- Authorize each sensitive subscription, room join and client-originated event; a successful handshake does not grant access to every room/action.
- Derive room names and technician identity on the server. Never trust a client-supplied room/user/technician ID as authorization.
- Restrict technicians to their own authorized events and data. Only authorized Admin roles may subscribe to the Admin live map/global operational events.
- Validate event names, payload schemas, identifiers, types, timestamps and sizes.
- Apply per-connection and per-user rate limits and backpressure where supported.
- Limit connection counts and message sizes to reduce resource-exhaustion attacks.
- Re-check relevant session revocation/permission state for long-lived connections; disconnect sessions after logout, disablement or privilege revocation where required.
- Do not expose event payloads containing unrelated customers, technicians, invoices or payments.
- Do not put secrets or complete sensitive payloads in Socket.IO logs.
- Log connection/auth failures, forbidden subscriptions and protocol violations in a privacy-safe way.
- Preserve WebSocket upgrade security behind Nginx or another reverse proxy.

## 25. HTTPS, TLS and Security Headers

Production web, API, native location upload and WebSocket traffic must use correctly configured TLS/HTTPS/WSS.

- Use a valid, trusted certificate and automatic renewal appropriate to the chosen deployment method.
- Redirect browser-facing HTTP to HTTPS where supported; sensitive API endpoints should not accept credentials or mutations over cleartext HTTP.
- Do not treat a private LAN HTTP IP as a secure context for production geolocation.
- Enable HSTS only after HTTPS is verified across the intended hostnames and rollback implications are understood; do not enable preload/includeSubDomains blindly.
- Set appropriate `X-Content-Type-Options: nosniff`, `Referrer-Policy`, frame protection (`frame-ancestors` in CSP and/or compatible headers), and `Permissions-Policy`.
- Define a restrictive Content Security Policy based on actual required sources. It must be tested against React/Vite assets, Google Maps, Socket.IO, any actual mail/verification integrations and PWA behavior.
- Avoid wildcard `script-src`, broad `default-src *`, unnecessary `unsafe-eval` and unnecessary inline scripts. If strict CSP requires nonce/hash-based integration, plan and test the changes rather than silently disabling CSP.
- Use secure cookie attributes in production.
- Configure Nginx/backend proxy headers deliberately. Do not blindly trust all forwarded headers or proxy sources.
- Verify redirects and secure-cookie behavior through the real production HTTPS path.

## 26. Secrets and Environment Configuration

Secrets include database URLs/passwords, Redis credentials, session/signing secrets, SMTP credentials, Maps server keys, native tracking capabilities, backup encryption keys, cloud credentials and any third-party tokens.

- Never commit real secrets into Git, code, documentation, test fixtures, client assets or build output.
- Keep `.env` files with real values out of version control. Provide templates containing placeholders only.
- Do not prefix server secrets with `VITE_` or another public-build prefix.
- Do not include secrets in source maps, debugging UI, error payloads, support screenshots or logs.
- Use a trusted secret manager or protected runtime environment configuration with minimal read access and correct file permissions.
- Avoid baking production secrets into Docker/build artifacts or cloud-init/user-data that is broadly readable.
- Use IAM roles/instance profiles for AWS API access where appropriate instead of long-lived access keys; if the application does not need AWS API access, do not add credentials merely for deployment.
- If running on EC2, require IMDSv2 where compatible and keep application/database/Redis ports private.
- Rotate secrets after suspected or confirmed exposure; revoke old credentials and investigate blast radius. Deleting a Git line is not sufficient.
- Use different credentials for development, testing and production.
- Limit each API key to its required APIs, origin/IP and permissions.
- Check Git history and generated artifacts for secrets before release.

## 27. Logging, Audit Trails, Monitoring and Alerting

### 27.1 Security events to record

Record appropriate security-relevant events, including:

- successful/failed privileged login and MFA;
- OTP request/verification failure, rate-limit events and lockout/recovery actions;
- session creation, logout, revocation and account disablement;
- role/permission changes;
- unauthorized access attempts and repeated IDOR/BOLA-like denials;
- customer/data export and high-volume reads where appropriate;
- invoice/payment creation and authorized reversal/correction;
- service assignment, reassignment and important job lifecycle events;
- sensitive attachment access or permission changes;
- live-map access and tracking-session lifecycle events;
- secret/configuration changes and backup restore operations;
- suspicious WebSocket connections, event failures and rate-limit triggers.

### 27.2 Logging protections

- Use structured logs with timestamp, event type, request/correlation ID, outcome and the minimum actor/resource metadata needed for investigation.
- Never log passwords, OTP values, reset codes, cookie values, session IDs, bearer tokens, private keys, database/Redis credentials or API secrets.
- Do not log raw GPS coordinates or continuous location paths in routine logs.
- Avoid full request/response body logging for authentication, payments, customer data and location updates.
- Sanitize CR/LF and control characters to prevent log injection.
- Avoid logging complete payment details or sensitive customer text when an event identifier and outcome suffice.
- Restrict who can access logs and record sensitive log access where feasible.
- Protect retained logs from unauthorized modification and set an approved retention period.
- Keep logs outside public static directories and disable public access to log files.

### 27.3 Monitoring and alerts

Alert on repeated privileged-login failures, OTP abuse, unusual permission denials, access to another technician's resources, suspicious payment attempts, large exports, secret/configuration changes, unexpected service restarts and anomalous location-update sessions. Monitoring must avoid exposing the secrets or private data it is intended to protect.

## 28. Email, WhatsApp, Webhooks and External Integrations

Apply these controls only to integrations that exist in the current application; verify actual providers before implementation.

### 28.1 Email

- Keep PHPMailer/NodeMailer or the actual mail credentials server-side.
- Use authenticated, TLS-protected SMTP/API delivery and approved sender addresses.
- Do not let user input control arbitrary From/To/CC/BCC or email headers.
- Encode untrusted content inserted into HTML email templates.
- Avoid sending passwords, session credentials, payment secrets or excessive customer information in email.
- OTP email must contain only the intended short-lived code and security context; do not put it in logs or unrelated notifications.
- Rate-limit email-triggering endpoints and make retries idempotent where appropriate.

### 28.2 WhatsApp and messaging

- Do not place sensitive customer/service work-order details in technician WhatsApp messages as a substitute for the authorized portal.
- Keep the Technician Portal as the authoritative field-work interface, according to the current portal requirements.
- Minimize message content and use authenticated provider credentials.
- Do not expose provider tokens in the frontend.
- Validate webhook signatures where the provider supports them and reject unsigned/invalid sensitive events.

### 28.3 Webhooks

- Verify official provider signatures using the raw request body and documented algorithm where required.
- Reject invalid signatures and malformed payloads.
- Validate timestamp/replay controls where supported.
- Make processing idempotent.
- Apply request size limits, rate controls and safe error handling.
- Do not trust a client-provided `verified: true` field.
- Never run sensitive actions based on an unsigned or unverified webhook.

### 28.4 External API responses

Treat external responses as untrusted; validate structure, size and types, set timeouts, handle failures safely and avoid leaking provider error details. Keep API keys restricted to the required origin/IP and API permissions.

## 29. PWA, Browser Storage and Offline Behavior

If PWA/service-worker functionality exists, apply these controls:

- Serve the production app only over HTTPS.
- Keep Admin and Technician UI routing separate where the existing architecture requires it, but do not treat route scope as authorization.
- Do not cache authenticated API responses, private customer records, invoice/payment data, technician GPS responses or security endpoints in a public/shared cache.
- Avoid persisting sensitive CRM responses in service-worker caches, IndexedDB or local storage unless specifically required, threat-assessed and protected.
- Clear appropriate user-specific cache/storage on logout and account switching; never show one user's cached data to the next user on a shared device.
- Do not store session tokens or long-lived secrets in localStorage.
- Handle offline mode as read-only/limited when required; do not queue financial mutations or job completion without a separate idempotency and consistency design.
- Treat stale cached data as stale; never represent cached GPS as current location.
- Keep service-worker update behavior and cache invalidation predictable; review cache poisoning and asset integrity.
- Do not let PWA installation or route visibility bypass backend RBAC.

## 30. Native Android and Desktop Security, If Present

Apply this section only if the current repository includes a native Android wrapper, background-location service or Electron/desktop target. Confirm its presence before changing files.

### 30.1 Android/native bridge

- Follow OWASP MASVS controls appropriate to storage, cryptography, authentication, network communication, platform interactions, code and privacy.
- Use HTTPS and platform trust validation; do not disable certificate validation.
- Do not embed long-lived server secrets in the APK.
- Use Android Keystore/platform protected storage for device-held sensitive credentials when applicable.
- Restrict native bridge methods to the minimum functions required; do not expose arbitrary shell, filesystem or unrestricted HTTP access to web content.
- Use a narrow, short-lived, revocable location capability bound to the currently authorized technician/navigation session if native location upload needs its own credential.
- A tracking credential may upload only permitted location updates; it must not authorize arbitrary CRM API calls.
- Display the required operating-system foreground location notification while tracking is active and follow Android permission/lifecycle requirements.
- Stop/revoke tracking on the authorized lifecycle events; do not continue tracking after logout, explicit termination, reassignment or expired authorization.
- Do not claim continuous tracking when the OS stopped the service, permissions were revoked or device location was disabled.
- Verify APK signing/build integrity and keep private signing keys out of Git.

### 30.2 Electron/desktop, if present

- Set `contextIsolation: true`, `nodeIntegration: false` and sandboxing where compatible with the current Electron version.
- Expose only narrow, validated functions through preload/IPC; validate sender frame/origin and every argument.
- Deny arbitrary navigation, untrusted remote content and unsafe `shell.openExternal` targets.
- Do not load untrusted remote pages into privileged windows.
- Keep update signing/integrity and production packaging secure.
- Do not expose filesystem, process, credentials or shell capabilities to page JavaScript.

## 31. AI Assistant and Automation Security, If Present

If the CRM includes an AI assistant, knowledge engine, automation or tool-using model, apply these requirements:

- Treat user text, documents, retrieved content, tool outputs and web content as untrusted, even when stored in the CRM.
- Enforce user/technician authorization before selecting records or adding private data to model context.
- Do not rely on prompt instructions as the access-control layer.
- Never expose system prompts, credentials, hidden configuration or unrelated customers' records.
- Do not allow model output to directly execute SQL, shell commands, arbitrary URLs, financial mutations or privileged actions.
- Validate structured model outputs against strict schemas and independently authorize any requested action.
- Require explicit user confirmation or privileged approval for high-impact actions such as payments, invoice mutations, destructive actions, bulk exports or permission changes.
- Restrict tools to explicit allowlists and enforce timeouts, budgets and resource limits.
- Do not submit unnecessary sensitive customer, payment or GPS data to third-party AI services.
- Log the action and authorization outcome without logging secrets or excessive private prompts.
- Test prompt injection, data leakage and cross-technician retrieval boundaries.

## 32. Dependency and Software-Supply-Chain Security

- Preserve the repository's intended package manager and lockfile.
- Use reproducible, reviewed dependency installation; do not bypass lockfile integrity in production.
- Review packages before addition: necessity, maintenance, known vulnerabilities, transitive dependencies, licensing and capabilities.
- Run dependency vulnerability audits appropriate to the actual Node/pnpm toolchain and review high/critical findings.
- Keep runtime and build-only dependencies appropriately separated without removing dependencies that are genuinely required.
- Avoid unnecessary lifecycle scripts and investigate unexpected install/build execution.
- Use automated secret scanning and static analysis in development/CI where practical.
- Pin workflow/action versions appropriately and grant CI only the permissions needed.
- Protect release branches and production deployment credentials; require review for security-sensitive changes where the workflow supports it.
- Do not run untrusted pull-request code with production secrets.
- Produce a software bill of materials (SBOM) for releases when feasible.
- Rebuild/redeploy from trusted source after a suspected dependency or build-system compromise.
- Do not blindly upgrade major dependencies during a security fix; assess compatibility and regression risk.

## 33. Deployment and Infrastructure Security

Verify the actual deployment target before applying provider-specific settings. The project has been prepared for a possible AWS EC2 deployment, but this document must not assume it is already deployed there.

### 33.1 Production runtime

- Run in production mode with debug/development routes disabled.
- Bind Fastify to the intended interface and runtime port; do not expose internal listeners unnecessarily.
- Use Nginx/reverse-proxy settings only after reviewing the real deployment.
- Run the application under a dedicated non-root OS user where practical.
- Use a single deliberate process manager (such as systemd or PM2 if selected); avoid competing managers and undocumented background processes.
- Keep logs, uploads, runtime files and backups out of public static directories.
- Set restrictive file and directory permissions.
- Ensure the app does not start with permissive defaults when required environment variables are absent.
- Apply timeouts/body limits at proxy and application layers without breaking legitimate uploads or WebSocket behavior.

### 33.2 AWS EC2, if used

- Open only required public ports (typically HTTPS and, if required for certificate validation/redirects, HTTP). Restrict SSH to trusted source IPs or an approved access mechanism.
- PostgreSQL and Redis must remain private/loopback-bound and unavailable directly from the public Internet.
- Use IAM roles/instance profiles with least privilege for required AWS API access.
- Require IMDSv2 where supported and avoid exposing metadata credentials to untrusted processes.
- Encrypt storage/volumes/backups according to data sensitivity and deployment capability.
- Protect the instance, Nginx, Node, PostgreSQL and Redis with supported security updates.
- Do not place production secrets in Git, Docker build layers, world-readable files or publicly readable user-data.
- Document and test certificate renewal, restart recovery, backup/restore and rollback.
- Monitor disk, memory, CPU, service restarts, authentication abuse and certificate expiration.

### 33.3 Production/dev separation

- Use distinct development, test and production secrets/data.
- Never point local experiments, temporary HTTPS tunnels, automated tests or untrusted branches at production credentials by default.
- Temporary tunnels are for controlled testing, not production security boundaries.
- Verify no debug logs, test routes, seeded users or sample credentials remain in production.

## 34. Backups, Recovery and Data Integrity

- Define backup scope, frequency, access control, encryption, retention, recovery-point objective and recovery-time objective based on actual operational needs.
- Keep backups inaccessible to public web requests and ordinary application credentials.
- Use a separate backup identity with only required permissions.
- Encrypt backups and protect encryption keys separately.
- Test restoration in an isolated environment; a backup is not considered reliable until restore has been verified.
- Do not run destructive database resets as part of production deployment.
- Review migrations before deployment and identify destructive/irreversible changes.
- Use a rollback plan for application releases and migrations; do not claim a migration is reversible when it is not.
- Prevent duplicate business effects during restart/retry, especially payments, job completion, stock movements, email notifications and webhooks.
- After restoring Redis or a database, validate expiry and active-session status before presenting any restored transient tracking data as live.
- Document incident recovery without placing production secret values in the documentation.

## 35. Safe Errors and Failure Handling

- Return generic, useful client errors without internal stack traces or secrets.
- Log diagnostic details server-side in a controlled, redacted form.
- Use a correlation/request ID so support can locate safe logs.
- Do not expose filesystem paths, SQL text, credentials, internal hostnames, provider keys or environment variables.
- Fail closed when authentication, authorization, input validation, OTP verification, webhook signature, upload validation or native tracking credential checks fail.
- Distinguish an unavailable dependency from an authorization success; do not default to allowing operations when Redis/database/provider verification fails.
- Do not silently mark failed payments, OTP delivery, tracking or job updates as successful.
- Ensure errors and retries do not create duplicate transactions or leak internal state.
- Sanitize data reflected into error messages.
- Avoid detailed account-existence errors in login, recovery and OTP requests.

## 36. Security Testing and Verification

Security controls must be tested against the real routes, roles, schemas, database and deployment configuration. Use authorized test accounts and test data. Do not perform destructive testing against production or third-party systems without explicit authorization.

### 36.1 Baseline framework

Use the stable [OWASP Application Security Verification Standard (ASVS) 5.0.0](https://github.com/OWASP/ASVS/releases) as the principal web-application verification framework, with a risk-based Level 2 baseline for this business CRM and additional high-assurance controls for privileged access, payments, technician data isolation and location tracking.

Use the current [OWASP Top 10:2025](https://top10.owasp.org/2025/en/) and [OWASP API Security Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/) as risk-awareness checklists, not as a substitute for testing.

If a native Android app is present, use the [OWASP MASVS](https://mas.owasp.org/MASVS/) and its testing guidance for the mobile-specific attack surface.

### 36.2 Authentication and session tests

- Invalid credentials are rejected.
- Disabled accounts cannot authenticate or keep using existing sessions.
- Admin MFA is required for privileged accounts according to the approved policy.
- OTP expiry, attempt limits, resend invalidation, single-use and concurrency work correctly.
- OTP challenges for one technician do not interfere with others.
- Rate limits apply across relevant identities/IPs.
- Logout/session revocation behaves correctly.
- Password reset/account recovery does not enable enumeration or account takeover.
- Session IDs are rotated and cookie/security attributes are correct in production.

### 36.3 Authorization and object-scope tests

- Unauthenticated requests to protected endpoints fail.
- Staff cannot access Admin-only actions unless explicitly authorized.
- Technician cannot access Admin-only APIs.
- Technician A cannot access Technician B's profile, assignments, service, job card, invoice, payment, notification, attachment or tracking session by manipulating IDs.
- Read responses omit restricted fields.
- Mutation endpoints reject protected/unexpected fields.
- Role changes and account disablement take effect server-side.

### 36.4 Input and browser security tests

- Malformed and oversized input is rejected.
- SQL injection payloads do not alter query structure.
- Stored/reflected/DOM XSS payloads are encoded or rejected safely.
- CSRF protections work for cookie-authenticated mutations.
- CORS rejects unapproved origins.
- Open redirects and unsafe protocols are rejected.
- CSP/security headers are tested against actual Maps, Socket.IO, fonts/assets and PWA behavior.
- Source maps, debug endpoints, stack traces and environment data are not publicly exposed.

### 36.5 File and document tests

- Unauthorized uploads/downloads fail.
- Oversized files, spoofed MIME types, mismatched file signatures and dangerous extensions are rejected.
- Path traversal and malicious filenames are handled safely.
- Private assets cannot be retrieved merely by knowing an ID/URL.
- PDF/receipt/CSV output does not create XSS or spreadsheet formula injection.

### 36.6 Payment and business-integrity tests

- Amount is positive and within the current server-computed outstanding balance.
- Concurrent payment requests cannot overpay an invoice.
- Duplicate/retried submissions do not create duplicate payments.
- Technician payment recording is limited to authorized assigned-service invoices.
- Clients cannot change invoice totals, payment status, receipt numbers or historical payment records through overposting.
- Existing authoritative invoice/payment logic is reused.

### 36.7 GPS and real-time tests

- Invalid, expired, revoked and replayed tracking capabilities are rejected.
- One technician cannot publish for another technician or another technician's destination.
- Destination switch revokes the previous tracking session.
- Stale coordinates are never shown as live.
- Operational state is not changed solely because GPS freshness becomes stale.
- Redis TTL expires temporary location state according to policy.
- Location data is not written to permanent GPS-history storage or routine logs.
- Socket.IO rejects unauthorized origins, connections, rooms and events.
- Long-lived connections respect session invalidation and permission changes.
- Multiple technicians can update concurrently without collisions.

### 36.8 Deployment and supply-chain tests

- Dependency/security scans run and high/critical findings are reviewed.
- Secret scanning finds no real credentials in current files, Git history where available, source maps or build outputs.
- Production binds only intended ports/interfaces.
- PostgreSQL and Redis are not publicly reachable.
- HTTPS/certificate renewal and secure cookie behavior are verified.
- Backups restore successfully in a test environment.
- Application startup, Redis/database failure and restart recovery fail safely.

### 36.9 Test reporting

For every test, report PASS, FAIL, BLOCKED or NOT RUN with evidence. Never label a control secure merely because no test was written. Record vulnerabilities with severity, affected routes/data, exploit conditions, mitigation, owner and verified retest result.

## 37. Security Incident Response

If a security incident or likely compromise is discovered:

1. Preserve relevant evidence and establish scope.
2. Contain the affected behavior or access path where necessary.
3. Revoke/rotate exposed credentials, API keys, signing secrets and tracking capabilities.
4. Invalidate affected sessions/tokens and active native location capabilities where appropriate.
5. Investigate relevant application, proxy, authentication, database and integration logs.
6. Determine whether customer, financial, credential or location data was accessed or exposed.
7. Patch the vulnerability and add a regression test.
8. Restore from verified clean artifacts/backups if needed.
9. Review affected systems and secret reuse.
10. Document root cause, timeline, data impact, corrective measures and retest evidence.
11. Determine any legal/customer/provider notification requirements based on applicable obligations; do not make legal-compliance claims without review.

Never leave a known critical vulnerability active merely because the application continues to function.

## 38. Security Change Control and Escalation

Any change involving authentication, authorization, sessions, passwords, OTP, payments, database access, uploads, GPS, native tracking, Socket.IO, public APIs, secrets, CORS, security headers, deployment, third-party providers or retention MUST include a security review and relevant regression tests.

Before making a security-sensitive change, the implementation agent must identify:

- the threat being mitigated;
- the trust boundary;
- the authenticated principal and required permission;
- the data being accessed or mutated;
- abuse cases and denial-of-service considerations;
- failure behavior;
- logging and privacy effects;
- compatibility/regression risks;
- required tests and rollback strategy.

If an implementation requires changing existing CRM behavior, API semantics, database structure or privacy/retention policy beyond the approved task, stop and request approval. Do not silently weaken another control to make a security test pass.

Security exceptions must document the control, reason, affected assets, compensating controls, owner, expiry/review date and explicit approval. An exception is not permission to leave a known critical/high vulnerability unresolved for production.

## 39. Production Release Gate

A release must not be declared security-ready if any known Critical or High-severity issue remains exploitable in a production path without an explicitly approved, time-limited risk decision.

### Authentication and authorization

- [ ] No unsafe default/bootstrap credentials remain.
- [ ] Privileged-account MFA policy is implemented or tracked as a production blocker.
- [ ] Session expiration, logout and revocation are verified.
- [ ] OTP lifecycle/rate limits are verified where applicable.
- [ ] Every API and sensitive operation is server-authorized.
- [ ] Technician A/B isolation tests pass.
- [ ] Object- and property-level authorization tests pass.

### Input, browser and API

- [ ] Runtime schema validation is applied.
- [ ] Request-size/time/concurrency limits exist.
- [ ] CSRF and CORS configuration matches the real authentication/origin model.
- [ ] XSS, injection and open-redirect tests pass.
- [ ] Security headers and CSP have been tested against real integrations.
- [ ] Debug/test endpoints and verbose errors are disabled in production.

### Data and business integrity

- [ ] PostgreSQL and Redis are private and use least-privilege credentials.
- [ ] SQL/query safety and transaction boundaries are verified.
- [ ] Payment amount, overpayment and idempotency controls pass.
- [ ] File access and upload controls pass for applicable features.
- [ ] Private responses are not publicly/shared cached.
- [ ] Backups are protected and a restore has been tested.

### GPS and realtime

- [ ] Location session is authenticated and technician-scoped.
- [ ] GPS is temporary and TTL is verified.
- [ ] No permanent GPS history or raw coordinate logging was introduced.
- [ ] Stale freshness is distinguished from operational status.
- [ ] Socket.IO origin, authentication, room and event authorization tests pass.
- [ ] Revoked sessions/destinations cannot publish further valid location updates.

### Build and operations

- [ ] Dependency and secret scans have been reviewed.
- [ ] No production secret appears in source, Git, build artifacts or public source maps.
- [ ] HTTPS and certificate renewal are verified.
- [ ] Runtime processes and privileged ports follow least privilege.
- [ ] Security logs/alerts are configured and do not contain secrets.
- [ ] Incident response and rollback instructions exist.
- [ ] All test results and unresolved issues are reported honestly.

## 40. Antigravity Mandatory Directive

`SECURITY.md` is a mandatory engineering constraint for every phase and feature of Enterprises CRM.

Before implementing any change, Antigravity MUST:

1. Read this entire file.
2. Inspect the existing repository and relevant architecture.
3. Identify the security boundaries and trusted/untrusted data.
4. Identify the actors, roles, resources and permissions involved.
5. Determine which security controls already exist and test them.
6. Identify missing controls and document the gap.
7. Implement the smallest secure, compatible change authorized by the task.
8. Add or update security regression tests.
9. Run relevant functional/regression tests.
10. Review the complete Git diff and revert unrelated changes.
11. Report tests that passed, failed, were blocked or were not run.

Antigravity MUST NOT:

- assume frontend checks are sufficient;
- rely on hidden pages, obscure URLs or random IDs for authorization;
- trust a client-supplied role, technician ID, amount, balance, payment status or GPS identity;
- bypass or replace authentication for convenience;
- create broad technician permissions;
- expose secrets, OTP values, tokens, database/Redis credentials or GPS coordinates in logs;
- introduce permanent location history;
- create unsigned sensitive webhooks;
- allow wildcard credentialed CORS;
- introduce unrestricted uploads or generic URL fetchers;
- blindly accept client properties into database records;
- trust frontend payment success;
- disable security controls to fix a development/deployment issue without explicit approval;
- claim production readiness without test evidence;
- change existing CRM business logic, APIs, calculations or workflows beyond the explicitly authorized task.

### Required completion report

Every security-relevant implementation must report:

- threat/root cause;
- exact files changed;
- controls added or verified;
- relevant tests and evidence;
- known limitations;
- any API/database/schema changes;
- Git diff summary;
- confirmation that no unrelated changes were made;
- whether the control is implemented, partially implemented, blocked or not tested.

If a security decision materially affects architecture, privacy, data retention or authorization and is not defined here, Antigravity MUST stop, explain the risk, propose secure options and request approval rather than guessing.

## 41. Authoritative Security References

Use current stable guidance and verify versions before applying a version-specific control. These references inform the policy; they do not replace testing of the actual CRM.

- [OWASP Application Security Verification Standard (ASVS) — stable releases](https://github.com/OWASP/ASVS/releases)
- [OWASP Top 10:2025](https://top10.owasp.org/2025/en/)
- [OWASP API Security Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [OWASP Mobile Application Security Verification Standard (MASVS)](https://mas.owasp.org/MASVS/) — if a native mobile app is present.

---

## Final Security Commandment

> Assume the client is hostile. Assume identifiers will be manipulated. Assume inputs are malicious. Assume endpoints will be called directly. Assume credentials can leak. Verify every security-sensitive decision on the server. Minimize private data. Fail closed. Test controls. Never trade security for convenience without an explicit, documented and approved risk decision.

**Enterprises CRM must be secured as one integrated product: Admin, Staff, Technician Portal, API, database, Redis, real-time tracking, files, integrations and deployment. No screen or route is a substitute for server-side security.**
