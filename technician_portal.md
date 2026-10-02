# SR Enterprises CRM — Technician Portal
## Standalone Technical, Functional, Security & Phased Development Specification

**Document:** `technician_portal.md`  
**Purpose:** Add a dedicated Technician Portal to the existing CRM.  
**Primary rule:** **The existing CRM must remain behaviorally unchanged.**

---

# 1. NON-NEGOTIABLE EXISTING CRM PROTECTION

## 1.1 Absolute No-Change Rule

During Technician Portal development:

> **NO EXISTING CRM FUNCTIONALITY SHALL BE MODIFIED.**

The existing CRM remains the authoritative system and must continue to work exactly as it does today.

The following are protected:

- Existing CRM pages and UI
- Existing routes
- Existing API contracts and behavior
- Existing authentication for Super Admin, Admin and Staff
- Existing RBAC behavior
- Existing customer, inquiry, sales and service workflows
- Existing invoices, GST and payment calculations
- Existing job-card workflow
- Existing warranty, inventory/FIFO and rental logic
- Existing WhatsApp and email behavior outside the new technician portal flow
- Existing analytics, reports, audit logs and notifications
- Existing backup/recovery behavior
- Existing Electron/desktop behavior

## 1.2 Additive-Only Development

Allowed:

- New Technician Portal routes
- New technician authentication endpoints
- New technician portal APIs
- New portal-only sessions
- New portal-specific notifications
- New portal-specific database tables/indexes when required
- New portal frontend components/modules
- Read-only access to existing CRM records
- Isolated wrappers around existing business logic

Not allowed:

- Refactoring unrelated CRM modules
- Changing existing API response structures
- Rewriting existing business calculations
- Duplicating invoice/payment/job-card engines
- Changing existing navigation
- Changing existing permissions for other roles
- Replacing existing CRM workflows with portal-specific alternatives

## 1.3 Single Source of Truth

The portal must reuse existing CRM records for:

- Customers
- Services
- Job Cards / Work Orders
- Invoices
- Payments
- Assets / Equipment
- Products / Materials
- Warranty where applicable
- Activities / audit events where appropriate

The portal may create only portal-specific authentication/session/notification data where required.

---

# 2. PRODUCT DIRECTION

The current CRM documentation describes an RO/water-purification reference implementation. The Technician Portal must be designed as a **business-agnostic field-work portal**.

The core portal must not hard-code:

- RO
- TDS
- Membrane
- Purifier
- LPH
- Water quality measurements

Instead, the portal must understand generic concepts:

```text
Customer
Service
Work Order / Job Card
Assignment
Location
Problem / Requirement
Execution
Completion
Customer Confirmation
Invoice / Amount Due
Payment Collection
```

Business-specific fields must be configurable or supplied by the relevant business module.

Examples:

```text
RO business       → TDS, membrane condition
AC business       → pressure, temperature, gas type
Electrical        → voltage, load, inspection checklist
Networking        → device, port, signal, installation checklist
```

The same Technician Portal architecture must support these without separate codebases.

---

# 3. EXISTING TECHNICIAN PAGE

The existing:

```text
/technicians
```

remains the **Technician Admin Page**.

It continues to manage:

- Technician registration
- Name
- Phone
- Email
- Status
- Availability
- Skills
- Assignment administration
- Workload
- Completion statistics
- Performance

The portal may add an administrative field such as:

```text
Portal Access: ENABLED / DISABLED
```

but this must be additive and must not change existing technician management behavior.

---

# 4. NEW TECHNICIAN PORTAL

Create a separate technician-facing portal:

```text
/technician
```

A technician must never be redirected into the normal CRM dashboard after technician login.

## 4.1 Portal Navigation

Keep it minimal:

```text
My Work
My Profile
Assigned Services
Completed Services
Notifications
Logout
```

The portal must not expose the existing CRM sidebar/navigation.

---

# 5. TECHNICIAN 360 PROFILE

Every technician must have a dedicated portal-facing profile derived from the existing technician record.

Conceptually:

```text
Technician
├── Profile
├── Assigned Services
├── Active Job
├── Completed Services
├── Workload Summary
├── Collection Summary
└── Personal Performance Summary
```

## 5.1 Profile

Display:

```text
Technician ID
Name
Phone
Email
Status
Availability
Skills
Portal Access Status
```

## 5.2 Personal Work Summary

Display only the technician's own information:

```text
Assigned
In Progress
Completed
Upcoming
Completion Rate
```

No company-wide data.

---

# 6. TECHNICIAN AUTHENTICATION

## 6.1 Login Method

Required credentials:

```text
Registered Mobile Number
+
Registered Technician Name
```

After identity validation, the CRM generates a one-time password.

OTP is sent to:

```text
Registered Technician Email
```

Email must be present for technicians who are enabled for portal access.

## 6.2 Login Flow

```text
Technician Portal Login
        ↓
Mobile Number + Technician Name
        ↓
Find Active Technician
        ↓
Verify Portal Access Enabled
        ↓
Verify Registered Email
        ↓
Create OTP Challenge
        ↓
Generate OTP
        ↓
Store Hashed OTP
        ↓
Queue Email Delivery
        ↓
Return Challenge ID
        ↓
Technician Enters OTP
        ↓
Verify OTP Challenge
        ↓
Create Technician Session
        ↓
Redirect /technician
```

---

# 7. OTP CONCURRENCY — CRITICAL REQUIREMENT

The system must support many technicians requesting OTPs at the same time.

Example:

```text
Technician A → OTP Request A
Technician B → OTP Request B
Technician C → OTP Request C
Technician D → OTP Request D
```

Every request must be independent.

## 7.1 Forbidden

Never use:

```text
global currentOtp
global technicianOtp
single shared OTP record
```

## 7.2 Independent Challenge

Each OTP request gets a unique challenge ID.

Conceptually:

```text
tech_otp:{challengeId}
```

with:

```text
technicianId
otpHash
expiresAt
attemptCount
createdAt
```

Redis is preferred for short-lived OTP state and rate limiting when available.

Do not store plain OTP values.

## 7.3 OTP Rules

Default:

```text
Length: 6 digits
Validity: 5 minutes
Maximum verification attempts: 3
One-time use: Yes
```

When the same technician requests another OTP:

```text
Previous OTP → invalidated
New OTP → valid
```

This affects only that technician.

Other technicians' OTPs remain valid.

## 7.4 Rate Limiting

Rate-limit independently by:

```text
Technician identity
IP address
Email
```

One technician must not be able to exhaust a global CRM OTP limit and block everyone else.

## 7.5 Email Delivery

OTP email sending must be asynchronous:

```text
Request OTP
   ↓
Validate
   ↓
Generate OTP
   ↓
Store Challenge
   ↓
Queue Email
   ↓
Return response
   ↓
Background worker sends email
```

Reuse the existing PHPMailer / NodeMailer infrastructure where possible.

---

# 8. TECHNICIAN SESSION SECURITY

After OTP verification:

```text
role = TECHNICIAN
technician_id = authenticated technician
```

Use secure server-side session handling with:

- HTTP-only cookie
- Secure cookie in production
- Appropriate SameSite policy
- Session expiration
- Logout invalidation
- Optional inactivity timeout

Do not store authentication secrets in localStorage.

---

# 9. BACKEND AUTHORIZATION

Frontend visibility is not security.

Every Technician Portal endpoint must enforce:

```text
authenticated session
AND
role = TECHNICIAN
AND
resource belongs to authenticated technician
```

Example:

```text
service.technician_id
    ===
session.technician_id
```

Otherwise return:

```text
403 FORBIDDEN
```

Never trust a client-supplied `technicianId`.

Bad:

```text
GET /technician/services?technicianId=12
```

Correct:

```text
GET /technician/services
```

The backend derives the technician ID from the authenticated session.

---

# 10. TECHNICIAN DATA VISIBILITY

## 10.1 Technician May See

Only information necessary to execute assigned work:

```text
Customer name
Relevant contact details
Service address
Service information
Scheduled date/time
Priority
Problem / requirement
Assigned asset/equipment
Relevant service history
Relevant warranty context
Job-card/work-order data
Mandatory execution fields
Current service invoice amount due
Payment-collection information for the current service
```

## 10.2 Technician Must Not See

```text
Other technicians
Unassigned services
Global customer directory
Unrelated customer records
Company-wide reports
Company profit
Profit margins
Inventory profit ledger
Other invoices
Other payment history
System settings
Backup controls
User management
Role management
Global analytics
```

---

# 11. ASSIGNMENT WORKFLOW

The existing CRM remains responsible for creating and assigning services/job cards.

New flow:

```text
Admin / Authorized Staff
        ↓
Assign Technician
        ↓
Existing Service + Job Card linked to technician
        ↓
Portal notification created
        ↓
Assigned service appears in Technician Portal
```

## 11.1 WhatsApp Change

The new technician workflow must **not send service/customer details to the technician over WhatsApp**.

The Technician Portal becomes the authoritative technician work interface.

WhatsApp continues to operate normally elsewhere in the CRM.

## 11.2 Assignment Notification

Create a portal notification such as:

```text
New Service Assigned

SRV-2026-0038
Scheduled Today · 3:00 PM
Priority: HIGH

[ VIEW SERVICE ]
```

Do not place the full customer/service work order into the notification if the portal can fetch it securely from the assigned record.

---

# 12. TECHNICIAN HOME — MY WORK

Purpose:

> What work requires my attention?

Show:

```text
Today's Services
Upcoming Services
Current Job
Completed Today
```

Keep this operational, not analytical.

---

# 13. ASSIGNED SERVICES

The technician sees only assigned services.

Suggested filters:

```text
Today
Upcoming
In Progress
On Hold
```

Each service card can show:

```text
Service Number
Customer
Service Type
Scheduled Date
Scheduled Time
Priority
Status
[ VIEW SERVICE ]
```

---

# 14. ASSIGNED SERVICE DETAIL

## Customer

```text
Customer Name
Primary Phone
Relevant Alternate Contact
[ CALL CUSTOMER ]
```

## Location

```text
Service Address
Landmark
City
State
Pincode

[ OPEN MAP ]
```

## Service

```text
Service Number
Service Type
Classification
Priority
Scheduled Date
Scheduled Time
Customer Notes
Current Status
```

## Asset / Equipment

When linked:

```text
Asset / Equipment
Model
Serial / Identifier
Relevant deployment information
```

## Relevant History

Show only work-related history:

```text
Previous service
Previous diagnosis
Previous work performed
Previously used parts/materials
Relevant previous issue
```

---

# 15. JOB EXECUTION

The technician must be able to execute the job completely through the portal.

## 15.1 Start

```text
[ START JOB ]
```

Use the existing job-card state machine where possible.

Expected:

```text
STARTED
started_at = server timestamp
```

## 15.2 Hold / Resume

Where supported by the existing CRM:

```text
[ PUT ON HOLD ]
Hold Reason
[ RESUME JOB ]
```

Do not create another independent job status system.

---

# 16. SERVICE EXECUTION FORM

Universal fields:

```text
Problem / Requirement
Diagnosis
Work Performed
Notes
Materials / Parts Used
Customer Confirmation
Completion
```

The portal must support business-specific fields without hard-coding one industry.

---

# 17. DYNAMIC BUSINESS-SPECIFIC FIELDS

Supported logical field types should include where needed:

```text
Text
Number
Decimal
Boolean
Single Select
Multi Select
Date
Date/Time
Long Text
Photo/File
Signature
```

The initial implementation may expose only the field types required by the current business configuration, but the architecture must remain extensible.

Example:

```text
Current RO implementation:
Raw TDS
Purified TDS
TDS Rejection
```

These are business-specific execution fields, not universal Technician Portal fields.

---

# 18. PARTS / MATERIALS

Technician may record what was actually consumed:

```text
Item
Quantity
```

The portal must not permit direct modification of:

```text
Purchase Cost
FIFO Cost
Profit
Global Stock
Catalog Pricing
```

Existing inventory logic remains authoritative.

---

# 19. BILLING

Existing CRM billing logic remains authoritative.

Technician Portal must not independently calculate:

```text
GST
Invoice Total
Warranty Eligibility
FIFO Cost
Profit
Payment Balance
```

The portal displays the result required for execution and collection.

Example:

```text
Invoice
Total
Paid
Outstanding
Status
```

---

# 20. CUSTOMER CONFIRMATION

Use the existing customer confirmation/signature capability where applicable.

Technician must complete the required confirmation step before job closure.

---

# 21. JOB COMPLETION

Completion must validate all mandatory fields.

Example:

```text
[ COMPLETE JOB ]
```

Before accepting:

```textRequired execution data complete
Required business-specific fields complete
Parts/materials valid
Customer confirmation captured when required
```

Then invoke the existing approved completion/business operation.

Do not duplicate completion logic.

---

# 22. BILLING AFTER COMPLETION

Flow:

```text
Technician completes job
        ↓
Existing business logic processes completion
        ↓
Invoice generated if applicable
        ↓
Portal receives invoice/amount due
```

Never generate a second independent invoice system for technicians.

---

# 23. PAYMENT COLLECTION

No external payment gateway is required.

The technician portal is a:

> **payment collection recording interface**

not a payment processor.

Customer pays the business directly.

The technician records the payment in the CRM.

---

# 24. PAYMENT METHODS

Support business-configured methods such as:

```text
Cash
UPI
Bank Transfer
Cheque
Other
```

Do not introduce a gateway dependency.

---

# 25. BUSINESS PAYMENT DETAILS

Configure business-owned payment details for portal display:

```text
Business Name
UPI ID
Account Name
Bank Name
Account Number
IFSC
UPI QR
```

First check whether equivalent existing CRM settings already exist. Reuse existing configuration rather than duplicating it.

---

# 26. UPI PAYMENT FLOW

```text
Technician opens payment section
        ↓
Portal displays business UPI QR
        ↓
Customer scans and pays business
        ↓
Customer/technician confirms payment
        ↓
Technician enters amount
        ↓
Technician enters UTR/reference when applicable
        ↓
Record Payment
        ↓
Existing CRM payment engine updates ledger
```

The portal must never claim that a UPI payment succeeded solely because the QR was displayed.

---

# 27. PARTIAL PAYMENTS

Allow partial payments.

Example:

```text
Invoice Total: ₹3,540
Paid Today: ₹2,000
Outstanding: ₹1,540
```

Result:

```text
PARTIALLY PAID
```

Use the existing invoice/payment ledger as the authoritative balance.

---

# 28. TECHNICIAN PAYMENT PERMISSION

Do not grant broad global payment permissions merely to simplify implementation.

Create a narrowly scoped capability conceptually equivalent to:

```text
technician.service_payment.record
```

Meaning:

> Technician may record a payment only against an invoice associated with an authorized service/job assigned to that technician.

Technician must not:

```text
Create arbitrary invoices
Edit invoices
Cancel invoices
Reverse payments
View unrelated payments
Modify historical payments
Access global accounts receivable
```

---

# 29. PAYMENT RECEIPT

After recording:

```text
Payment Recorded

Receipt Number
Invoice Number
Customer
Amount
Payment Method
Reference
Outstanding Balance
```

Reuse the existing receipt/business-document infrastructure wherever possible.

Do not introduce a conflicting receipt-numbering system.

---

# 30. COMPLETED SERVICES

Show only the logged-in technician's completed work.

Example:

```text
Service Number
Customer
Service Type
Completed Date
Invoice Amount
Payment Status
```

Completed services should default to read-only.

Administrative correction remains an existing CRM function.

---

# 31. TECHNICIAN PROFILE EDITING

Technician may view:

```text
Name
Phone
Email
Skills
Status
Availability
```

Administrative identity and authorization fields remain administrator-controlled.

Technician must never be able to change:

```text
Role
Technician ID
Portal permissions
Portal access status
Administrative permissions
```

unless the existing CRM explicitly provides a safe workflow for it.

---

# 32. PORTAL NOTIFICATIONS

Portal notifications should include:

```text
New Service Assigned
Schedule Changed
Service Cancelled
Service Reassigned
Job Updated
Important Administrative Notice
```

Requirements:

- Read/unread state
- Relevant record link
- Duplicate prevention
- Permission-aware visibility
- Actionability

---

# 33. API NAMESPACE

Use a dedicated API namespace.

## Authentication

```text
POST /api/v1/technician-auth/request-otp
POST /api/v1/technician-auth/verify-otp
POST /api/v1/technician-auth/resend-otp
POST /api/v1/technician-auth/logout
GET  /api/v1/technician-auth/me
```

## Technician

```text
GET /api/v1/technician/me
```

## Services

```text
GET /api/v1/technician/me/services
GET /api/v1/technician/me/services/:id
GET /api/v1/technician/me/completed-services
```

## Job Execution

```text
POST /api/v1/technician/job-cards/:id/start
POST /api/v1/technician/job-cards/:id/hold
POST /api/v1/technician/job-cards/:id/resume
PATCH /api/v1/technician/job-cards/:id
POST /api/v1/technician/job-cards/:id/complete
```

## Payment

```text
GET  /api/v1/technician/job-cards/:id/payment-summary
POST /api/v1/technician/job-cards/:id/payment
GET  /api/v1/technician/payments/:id/receipt
```

## Notifications

```text
GET  /api/v1/technician/me/notifications
POST /api/v1/technician/me/notifications/:id/read
```

These endpoints must be additive and must not alter existing endpoint semantics.

---

# 34. API DATA ISOLATION

Examples:

Service:

```text
service.technician_id === session.technician_id
```

Job Card:

```text
jobCard.technician_id === session.technician_id
```

Invoice:

```text
invoice linked to service/job
AND
service/job belongs to session technician
```

Payment:

```text
payment invoice belongs to authorized assigned service
```

Every authorization check must occur server-side.

---

# 35. ERROR CODES

Recommended:

```text
TECHNICIAN_NOT_FOUND
PORTAL_ACCESS_DISABLED
OTP_RATE_LIMITED
OTP_EXPIRED
OTP_INVALID
OTP_MAX_ATTEMPTS
OTP_ALREADY_USED
SESSION_EXPIRED
FORBIDDEN
SERVICE_NOT_ASSIGNED
JOB_CARD_NOT_ASSIGNED
INVALID_STATE_TRANSITION
VALIDATION_ERROR
PAYMENT_NOT_ALLOWED
PAYMENT_AMOUNT_INVALID
```

Use the existing CRM response envelope convention where compatible.

---

# 36. ADDITIVE DATABASE STRUCTURES

First inspect the current schema.

Do not create duplicates of existing CRM entities.

Potential portal-only structures:

## `technician_portal_access`

```text
id
technician_id
portal_enabled
created_at
updated_at
last_login_at
```

## OTP State

Prefer Redis for transient OTP state.

If PostgreSQL storage becomes necessary:

```text
challenge_id
technician_id
otp_hash
expires_at
attempt_count
used_at
created_at
```

## `technician_portal_sessions`

Create only if existing session infrastructure cannot safely support technician authentication.

## `technician_portal_notifications`

```text
id
technician_id
type
reference_type
reference_id
title
message
is_read
created_at
read_at
```

## Payment Configuration

Reuse existing business settings if possible before adding:

```text
business_name
upi_id
account_name
bank_name
account_number
ifsc
upi_qr
```

---

# 37. MOBILE-FIRST DESIGN

The portal is primarily a field application.

Requirements:

- Mobile-first
- Large touch targets
- Clear primary actions
- Minimal typing
- Fast navigation
- No wide admin tables
- Responsive on common phone widths
- Clear status
- Good use under field conditions

Important actions should remain obvious:

```text
START JOB
PUT ON HOLD
RESUME
COMPLETE JOB
COLLECT PAYMENT
```

---

# 38. OFFLINE BEHAVIOR

Do not implement offline financial mutation in the first release.

Initial behavior:

```text
Connection required for authoritative mutations
```

Do not build offline payment/job-completion queues until a separate consistency/idempotency design exists.

---

# 39. IDEMPOTENCY

Protect state-changing operations from duplicate submissions.

Examples:

```text
Complete Job tapped twice
→ one completion

Record Payment tapped twice
→ one payment
```

Use state validation and appropriate idempotency keys/guards.

---

# 40. TRANSACTION SAFETY

Do not bypass existing business transactions.

For:

```text
Start
Hold
Resume
Complete
Record Payment
```

the authoritative backend logic must validate current state before committing.

Payment must retain the existing invoice locking and overpayment-prevention behavior.

---

# 41. AUDITABILITY

Track important technician events using the existing activity/audit infrastructure where compatible:

```text
Technician login
OTP verification failure where appropriate
Service opened
Job started
Job held
Job resumed
Job completed
Parts/materials recorded
Customer confirmation
Payment recorded
```

Technician must not access the administrative audit interface.

---

# 42. ANTIGRAVITY IDE — MANDATORY DEVELOPMENT DIRECTIVE

The Technician Portal will be implemented using **Antigravity IDE**.

The file:

```text
technician_portal.md
```

will be placed inside the main existing CRM project folder.

This document is the authoritative specification for the Technician Portal implementation.

## 42.1 Mandatory Full-Document Analysis

Before executing **ANY phase**, Antigravity must:

1. Read the **entire `technician_portal.md` file**.
2. Analyze the existing CRM codebase, architecture, database schema, API contracts, authentication/session system, RBAC, service/job-card logic, invoice/payment logic, mail/queue infrastructure, and related dependencies.
3. Compare this specification against the current implementation.
4. Identify existing functionality that can be safely reused without changing its behavior.
5. Identify conflicts, risks, dependencies, and isolation boundaries.
6. Establish an implementation understanding before editing code.
7. Execute **only the currently authorized phase**.

Antigravity must not begin implementation by immediately editing files without completing this analysis.

## 42.2 Phase Authorization Rule

The required sequence is:

```text
Read complete technician_portal.md
        ↓
Analyze existing CRM
        ↓
Understand authorized phase
        ↓
Identify dependencies
        ↓
Check existing-CRM protection rules
        ↓
Implement only current phase
        ↓
Run phase tests
        ↓
Run existing CRM regression checks
        ↓
Proceed to next phase
```

Antigravity must not silently skip phases or implement future-phase functionality early.

## 42.3 Existing CRM Protection

The existing CRM is treated as **behaviorally immutable** during this project.

Before changing any existing file, Antigravity must determine whether the requirement can be implemented through:

```text
New module
New route
New API namespace
New repository/service
New database structure
Existing business-service call
Existing authentication/queue infrastructure
```

Prefer isolated/additive implementation.

If an existing CRM file truly must be touched, verify that:

```text
Existing UI behavior remains unchanged
Existing route behavior remains unchanged
Existing API contracts remain unchanged
Existing calculations remain unchanged
Existing workflow behavior remains unchanged
Existing role permissions remain unchanged
Existing business rules remain unchanged
```

If the same result can be achieved without touching the existing CRM implementation, use the isolated approach.

## 42.4 No Future-Phase Leakage

Do not implement:

```text
Authentication
Service execution
Billing/payment
Notifications
Personal analytics
```

during an earlier phase unless the current phase explicitly requires it.

Each phase must remain independently testable.

---

# 42. PHASED DEVELOPMENT

Development must happen in controlled phases.

No later phase is considered complete if its isolation/security criteria fail.

---

## PHASE 0 — DISCOVERY, PROTECTION & CRM PREPARATION

### Objective

Prepare the existing CRM and development environment for Technician Portal implementation **without changing existing CRM business behavior, UI behavior, workflows, calculations, API contracts, or permissions**.

This phase is mandatory before portal functionality is implemented.

### 0.1 Full Documentation Analysis

Antigravity must first read and analyze the complete:

```text
technician_portal.md
```

This must happen **before implementing Phase 0 work and before every subsequent phase**.

The complete document is the specification. An agent must not rely only on the current phase section.

### 0.2 Existing CRM Analysis

Inspect the current implementation against this specification.

At minimum analyze:

- Technician entity and registration flow
- Service entity
- Job-card entity
- Technician-to-service relationship
- Technician-to-job-card relationship
- Existing authentication/session architecture
- Existing RBAC and permission middleware
- Existing email infrastructure
- Existing PHPMailer / NodeMailer behavior
- Existing Redis / BullMQ / queue infrastructure
- Existing invoice engine
- Existing payment engine
- Existing receipt generation
- Existing settings/configuration storage
- Existing notification infrastructure
- Existing activity/audit infrastructure
- Existing migration structure
- Existing API routing structure
- Existing frontend routing
- Existing mobile/responsive patterns
- Existing tests/regression tests
- Existing Electron/desktop behavior
- Existing technician WhatsApp-dispatch behavior

### 0.3 Existing CRM Baseline

Before implementing portal features:

```text
Capture current application state
Capture current database schema state
Run existing automated tests
Verify critical existing workflows
Record baseline API behavior
Record baseline RBAC behavior
Record baseline calculations
```

This baseline will be used throughout development to prove that the existing CRM remains unchanged.

### 0.4 Prepare the CRM for Technician Portal Implementation

The CRM must be made technically ready for the portal while preserving all current behavior.

Preparation may include, only where inspection shows it is required:

```text
Create isolated Technician Portal module boundaries
Create isolated technician-auth namespace
Create isolated portal API namespace
Create isolated frontend route/module namespace
Prepare portal-only migration files
Prepare Redis key namespace for OTP challenges
Prepare queue/job namespace for technician OTP emails
Prepare portal notification structures
Prepare portal-specific tests/fixtures
Prepare safe interfaces for reusing existing services
Prepare configuration extension points
```

All preparation must be:

```text
Additive
Non-breaking
Isolated
Reversible
```

Do not use Phase 0 as an excuse to refactor or rewrite existing CRM modules.

### 0.5 Protected CRM Inventory

Create a written protected list covering:

```text
Existing pages
Existing routes
Existing APIs
Existing business services
Existing calculations
Existing RBAC
Existing payment logic
Existing invoice logic
Existing service logic
Existing job-card logic
Existing inventory/FIFO logic
Existing rental logic
Existing WhatsApp behavior
Existing analytics/reports
Existing desktop behavior
Existing authentication for non-technician roles
```

These remain regression-protected through every phase.

### 0.6 Development and Rollback Readiness

Before implementation:

```text
Create/confirm dedicated development branch
Confirm database backup/restore path
Confirm migration rollback strategy
Confirm existing test suite can run
Confirm development configuration is isolated
Confirm production credentials/data are protected
```

Do not execute destructive migration or data operations against production/authoritative data.

### 0.7 Portal Integration Boundary

Document exactly how the portal will access:

```text
Technicians
Customers
Services
Job Cards
Invoices
Payments
Existing notifications
Existing email infrastructure
Existing queue infrastructure
Existing authentication/session infrastructure
```

For each dependency, classify it as:

```text
READ-ONLY CONSUMPTION
SAFE EXISTING SERVICE REUSE
NEW PORTAL-ONLY STRUCTURE
REQUIRES ARCHITECTURAL REVIEW
```

No existing dependency should be modified merely for convenience.

### 0.8 Phase 0 Verification

Verify the existing CRM still works:

```text
Existing CRM starts normally
Existing Super Admin login works
Existing Admin login works
Existing Staff login works
Existing customer workflow works
Existing inquiry workflow works
Existing sales workflow works
Existing invoice workflow works
Existing payment workflow works
Existing service workflow works
Existing job-card workflow works
Existing Technician Admin page works
Existing WhatsApp behavior works
Existing reports/analytics work
```

### Phase 0 Deliverables

```text
Existing CRM dependency map
Technician Portal dependency map
Protected-module list
Current-state baseline
Test baseline
Database/schema impact assessment
Authentication/session integration assessment
OTP concurrency design confirmation
Payment integration boundary
Portal API boundary
Portal route boundary
Migration strategy
Rollback strategy
Risk/dependency register
CRM preparation/readiness record
```

### Phase 0 Exit Criteria

```text
Complete technician_portal.md analyzed
Existing CRM fully analyzed
Existing behavior baselined
Protected modules identified
Portal dependencies documented
CRM prepared with additive/non-breaking scaffolding only where required
OTP concurrency architecture confirmed
Payment integration boundary confirmed
Migration/rollback strategy confirmed
No existing business behavior modified
No existing CRM UI behavior modified
No existing API contract modified
Existing regression tests successful
Phase 1 is authorized
```

---

## PHASE 1 — PORTAL SHELL

Implement:

```text
/technician/login
/technician
/technician/profile
/technician/services
/technician/completed-services
```

Create:

- Portal layout
- Mobile navigation
- Route structure
- Portal module boundary
- Placeholder authentication guard

Do not modify existing CRM UI/navigation.

### Exit Criteria

Portal shell works independently.

---

## PHASE 2 — AUTHENTICATION + OTP

Implement:

- Technician identification
- Portal access validation
- OTP generation
- OTP hashing
- Independent challenge IDs
- Redis/short-lived storage
- Expiry
- Attempt limit
- Resend behavior
- OTP invalidation
- Per-technician rate limiting
- Per-IP/email controls
- Async email delivery
- Technician sessions
- Logout

### Mandatory concurrency testing

```text
1 technician → multiple OTP requests
5 technicians → simultaneous OTP requests
20+ technicians → simultaneous OTP requests
```

Also test:

```text
Expired OTP
Wrong OTP
Reused OTP
Brute force attempts
Rate limiting
Email delivery failure
```

### Exit Criteria

No OTP collision, replay, or cross-technician authentication.

---

## PHASE 3 — TECHNICIAN 360 PROFILE

Implement:

```text
Own profile
Own status
Own skills
Own availability
Own work statistics
```

### Exit Criteria

Technician A cannot retrieve Technician B's profile.

---

## PHASE 4 — ASSIGNED SERVICES

Implement:

```text
Today's Services
Upcoming
In Progress
On Hold
Service Detail
Customer Context
Location
Equipment/Asset
Relevant History
```

Assignment should automatically appear in the portal.

### Exit Criteria

```text
Technician A → sees own assigned service
Technician B → cannot see it
Admin → existing CRM behavior unchanged
```

---

## PHASE 5 — JOB EXECUTION

Implement:

```text
Start
Hold
Resume
Execution Form
Business-Specific Fields
Parts / Materials
Work Performed
Customer Confirmation
Complete
```

Reuse existing job-card/service logic.

### Exit Criteria

Technician can complete assigned work through portal without receiving work-order details through WhatsApp.

---

## PHASE 6 — BILLING VISIBILITY

Implement:

```text
Invoice Number
Invoice Total
Paid
Outstanding
Payment Status
```

The existing billing engine remains authoritative.

### Exit Criteria

Portal billing values match existing CRM values.

---

## PHASE 7 — PAYMENT COLLECTION

Implement:

```text
Business Payment Details
UPI QR
Cash
UPI
Bank Transfer
Cheque
Other
Reference / UTR
Partial Payment
Receipt
```

Use technician-scoped payment permission.

### Exit Criteria

Portal-recorded payment appears in the existing payment ledger without changing existing payment behavior.

---

## PHASE 8 — PORTAL NOTIFICATIONS

Implement:

```text
New Assignment
Schedule Change
Cancellation
Reassignment
Job Updates
```

Do not send technician work-order details through WhatsApp.

### Exit Criteria

Technician can discover all operational updates from the portal.

---

## PHASE 9 — PERSONAL TECHNICIAN SUMMARY

Implement:

```text
Assigned Count
Completed Count
Current Workload
Completion Rate
Average Completion Time (if data is reliable)
```

No global business analytics.

### Exit Criteria

Only personal technician metrics are visible.

---

## PHASE 10 — HARDENING + REGRESSION

### Security tests

```text
IDOR
URL manipulation
API manipulation
Role bypass
Cross-technician access
Session abuse
OTP replay
OTP brute force
Payment overpayment
Duplicate submissions
```

### Regression tests

Verify the existing CRM is unchanged for:

```text
Customers
Inquiries
Sales
Invoices
Payments
Services
Job Cards
Warranty
Inventory
Rentals
WhatsApp
Email
Analytics
Reports
Technician Admin
Authentication for existing roles
```

### Exit Criteria

Existing CRM regression suite remains successful and Technician Portal passes security/isolation tests.

---

# 43. TEST MATRIX

## Authentication

```text
Valid technician
Invalid technician
Inactive technician
Portal disabled
Valid OTP
Invalid OTP
Expired OTP
Reused OTP
Maximum attempts exceeded
Repeated OTP requests
Multiple technicians simultaneously
Email delivery failure
```

## Authorization

```text
Technician A → own service
Technician A → Technician B service
Technician A → another customer
Technician A → another technician profile
Technician A → unrelated invoice
Technician A → global report
Technician A → global payment ledger
```

All unauthorized cases must return 403 or an equivalent safe response.

## Service

```text
Start
Hold
Resume
Complete
Invalid transition
Missing mandatory field
```

## Payment

```text
Full payment
Partial payment
Overpayment attempt
Duplicate submission
Wrong invoice
Unassigned invoice
Concurrent payment attempts
```

---

# 44. FAILURE RECOVERY

## OTP Email Failure

Do not leave an unusable authentication state.

Return a controlled delivery failure and permit retry according to rate limits.

## Database Failure

Do not partially complete critical operations.

## Network Failure During Mutation

The technician UI must not assume success until the server confirms it.

Retries must not duplicate payments or completion.

---

# 45. BUSINESS-AGNOSTIC EXTENSIBILITY

Core portal fields:

```text
Customer
Location
Service
Priority
Schedule
Problem / Requirement
Diagnosis
Work Performed
Materials
Confirmation
Completion
Invoice
Payment
```

Business-specific fields are added through configurable metadata/modules.

Do not fork the Technician Portal per industry.

---

# 46. FUTURE EXTENSIONS — NOT INITIAL RELEASE

Do not include these in the first portal release unless separately approved:

```text
GPS/live location tracking
Route optimization
Attendance
Leave management
Offline-first execution
AI diagnosis
Photo AI inspection
Automatic technician assignment
Predictive scheduling
Push-notification expansion
Advanced field analytics
```

---

# 47. IMPLEMENTATION RULES FOR DEVELOPMENT AGENTS

Any developer/AI agent implementing this document through Antigravity must follow:

1. **Read the entire `technician_portal.md` before executing every phase.**
2. **Analyze the existing CRM before editing any file.**
3. **Execute only the currently authorized phase.**
4. Prefer new isolated files/modules over modifications to existing modules.
5. Do not refactor unrelated CRM code.
6. Do not change existing API response contracts.
7. Do not alter existing calculations.
8. Do not duplicate billing/payment/job-card logic.
9. Do not use frontend button hiding as authorization.
10. Scope every technician resource server-side.
11. Reuse existing business services whenever safe.
12. Regression-test the existing CRM after every phase.
13. If a proposed implementation requires changing existing behavior, stop and redesign it as an additive integration.
14. Do not add RO-specific assumptions to the universal portal core.
15. Do not implement future-phase functionality early.
16. Before declaring a phase complete, verify protected CRM behavior remains unchanged.
17. Prefer additive database structures over modifications to existing business tables.
18. Never use a global/shared OTP value; every OTP request must have an independent challenge.
19. Never trust a client-supplied technician ID for authorization.
20. Never allow technician access to another technician's records through URL/API manipulation.
21. Do not add external payment gateway dependencies for the Technician Portal.
22. Technician payment recording must remain scoped to authorized service invoices.
23. Do not send technician work-order/customer details through WhatsApp as part of the new portal workflow.
24. Do not convert the reference RO implementation into hard-coded universal portal behavior.
25. If a requirement conflicts with existing CRM behavior, preserve existing CRM behavior and implement an isolated portal solution instead.

---

# 48. DEFINITION OF DONE

Technician Portal is complete only when:

```text
✓ Separate technician login exists
✓ Login uses registered mobile + registered name
✓ OTP is delivered to registered email
✓ Multiple technicians can request OTPs concurrently
✓ OTP challenges are independent
✓ OTPs are hashed, expiring, rate-limited and single-use
✓ Technician session is isolated
✓ Technician A cannot access Technician B
✓ Existing /technicians page remains the admin technician page
✓ Existing CRM roles remain unchanged
✓ No technician work-order details are sent through WhatsApp
✓ Assigned services appear automatically in portal
✓ Customer/service/location details are available to the assigned technician
✓ Technician can start jobs
✓ Technician can hold/resume where applicable
✓ Technician can fill execution details
✓ Technician can complete jobs
✓ Business-specific fields are extensible
✓ Customer confirmation is captured where required
✓ Existing billing engine remains authoritative
✓ Technician can see amount due for assigned service
✓ Technician can display business payment details/UPI QR
✓ Technician can record customer payment for authorized service invoices
✓ Partial payment works
✓ Payment cannot exceed outstanding amount
✓ Duplicate payment submission is protected
✓ Receipt is generated through compatible existing infrastructure
✓ Technician cannot access unrelated financial data
✓ Completed services are visible read-only
✓ Technician has a dedicated 360 profile
✓ All backend access is technician-scoped
✓ Existing CRM regression tests pass
✓ Existing CRM behavior is unchanged
```

---

# 49. FINAL ARCHITECTURE

```text
                         EXISTING CRM
                    AUTHORITATIVE / UNCHANGED
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
      Customers           Services           Job Cards
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                     Authorized Portal Access
                              │
                              ▼
                  ┌───────────────────────┐
                  │   TECHNICIAN PORTAL   │
                  └───────────────────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
           Profile       Assigned Work     Completed
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                  Start    Execute   Complete
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                 Notes      Parts    Confirmation
                              │
                              ▼
                    Existing Billing Engine
                              │
                              ▼
                         Invoice / Due
                              │
                              ▼
                    Direct Customer Payment
                              │
                              ▼
                  Technician Records Payment
                              │
                              ▼
                    Existing Payment Ledger
                              │
                              ▼
                         Receipt / Close
```

---

# 50. FINAL PRINCIPLE

> **The Technician Portal is a separate, restricted field-work interface layered on top of the existing CRM. It is not a second CRM and must never become a reason to alter the existing CRM's business behavior.**

Core characteristics:

```text
ADDITIVE
ISOLATED
BUSINESS-AGNOSTIC
MOBILE-FIRST
ROLE-SCOPED
CONCURRENCY-SAFE
AUDITABLE
BACKWARD-COMPATIBLE
```

The existing CRM remains the single source of truth.
