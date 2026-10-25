# Project Overview & Added Features Guide

## Multi-Tenant Event & Tiered Ticket Reservation Engine

---

## 📌 1. Project Background & Problem Statement

In high-demand event ticketing (e.g., concert tours, developer summits, tech conferences), thousands of attendees frequently attempt to purchase a limited allocation of seats at the exact same moment. 

### The Core Problem:
Without atomic transaction controls, concurrent database writes lead to **race conditions**, resulting in:
* **Double-booking:** Selling the same physical seat or VIP ticket to two separate buyers.
* **Negative inventory:** Decrementing inventory past zero when simultaneous checkouts collide.
* **Database lock contention:** Crashing databases during booking surges.
* **Ghost reservations:** Leaving tickets locked permanently when users abandon checkout carts.

### The Solution:
This project implements a multi-tenant ticketing platform with:
1. **Serialized Redis Mutex Locks** + **ACID Database Transactions** (`BEGIN IMMEDIATE` / `SELECT ... FOR UPDATE`) to guarantee **zero double-booking**.
2. **10-Minute Temporary Hold Engine** with automated background cron release.
3. **Multi-Tenant Isolation** allowing organizers to host events, customize tiers, and view isolated conversion funnels.
4. **Mock Payment Simulation** with approval, card decline (which auto-frees seats), and async webhook simulations.

---

## 🚀 2. Comprehensive Guide to Added Features

### Feature 1: Dual-Engine Database Architecture
* **Files:** [`backend/src/config/database.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/config/database.js), [`backend/src/models/schema.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/models/schema.js)
* **What was added:**
  * **Local Zero-Setup Engine:** Runs portable **WebAssembly SQLite (`sql.js`)** saving directly to `backend/data/reservations.sqlite`. Requires zero native C++ compiler or external database installation.
  * **Production Cloud Engine:** Seamlessly connects to **PostgreSQL** (Neon, Supabase, Render, Railway) whenever `DATABASE_URL` is provided.
  * **Unified Transaction Wrapper:** Executes queries inside atomic transactions with automatic rollback on error.

---

### Feature 2: Role-Based Access Control (RBAC) & 1-Click Role Switcher
* **Files:** [`backend/src/middleware/auth.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/middleware/auth.js), [`backend/src/middleware/rbac.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/middleware/rbac.js), [`frontend/src/components/Navbar.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/Navbar.jsx)
* **What was added:**
  * Supports 3 distinct roles:
    1. **`ADMIN`**: Platform-wide superuser. Views all tenant analytics, triggers system maintenance, and manages global events.
    2. **`ORGANIZER`**: Scoped to an organization tenant. Can create events, configure ticket tiers, set sales cut-off deadlines, and view isolated revenue charts.
    3. **`ATTENDEE`**: Public customer. Browses events, places 10-minute temporary holds, checks out via mock payment, and accesses digital tickets with QR codes.
  * **1-Click Role Switcher in UI:** A persistent dropdown in the top navigation bar to instantly switch between pre-seeded demo accounts (Alex Vance, Sarah Connor, Marcus Chen, Alice Johnson, Bob Martinez) without logging in and out.

---

### Feature 3: Multi-Tenancy & Organization Isolation
* **Files:** [`backend/src/services/analyticsService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/analyticsService.js), [`frontend/src/pages/OrganizerDashboard.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/OrganizerDashboard.jsx)
* **What was added:**
  * Built-in multi-tenancy where each organizer belongs to a unique **`tenant_id`** (e.g. *Global Tech Summits Inc.* vs *NeonWave Festival Media*).
  * Data isolation ensures Sarah (Tech Summits) only sees her own events, ticket tiers, orders, and revenue metrics, preventing data leakage across organizations.
  * Admins have a tenant selector dropdown to filter metrics by any specific organization or view aggregated platform-wide revenue.

---

### Feature 4: Event & Tiered Ticket Management
* **Files:** [`backend/src/controllers/eventController.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/controllers/eventController.js), [`frontend/src/pages/EventDetailPage.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/EventDetailPage.jsx)
* **What was added:**
  * Organizers can create events with custom categories, venues, banners, dates, and **sales cut-off deadlines**.
  * Multi-tier ticket inventory:
    * **VIP Passes:** High-price, low-quantity seats with perks (lounge access, dinners).
    * **General Admission:** Standard capacity passes.
    * **Early Bird:** Discounted limited tiers (with "Sold Out" state demonstration).
  * Inventory tracking maintaining the strict invariant:
    $$\text{total\_quantity} = \text{available\_quantity} + \text{reserved\_quantity} + \text{sold\_quantity}$$

---

### Feature 5: 10-Minute Hold Reservation Engine
* **Files:** [`backend/src/services/reservationService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/reservationService.js), [`frontend/src/components/ReservationHoldBanner.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/ReservationHoldBanner.jsx)
* **What was added:**
  * When an attendee chooses tickets, they are placed in a temporary reservation hold (`status = 'HELD'`).
  * Decrements `available_quantity` and increments `reserved_quantity` atomically.
  * **Real-Time Sticky UI Banner:** Displays a live digital countdown (`MM:SS`) with a visual progress bar.
  * Turns amber and red with pulsing animations when time drops under 2 minutes.
  * Persisted in `sessionStorage` so refreshing the browser preserves the active hold.
  * Allows early manual cancellation via the "Release Seats" button.

---

### Feature 6: Concurrency & Double-Booking Protection
* **Files:** [`backend/src/services/reservationService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/reservationService.js), [`backend/tests/concurrency.test.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/tests/concurrency.test.js)
* **What was added:**
  * **Distributed Mutex Lock:** Redis command `SET lock:tier:<id> <token> NX PX 6000` serializes concurrent booking requests.
  * **ACID Row Locks:** In SQLite, `BEGIN IMMEDIATE` acquires exclusive disk locks; in PostgreSQL, `SELECT * FROM ticket_tiers WHERE id = $1 FOR UPDATE` locks the inventory row.
  * **Atomic Availability Check:** If available inventory is insufficient, the transaction immediately rolls back and returns a clean `409 Conflict: TICKETS_UNAVAILABLE`.
  * Guarantees **zero double-booking** under extreme load.

---

### Feature 7: Mock Payment Gateway Simulation
* **Files:** [`backend/src/services/paymentService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/paymentService.js), [`frontend/src/components/CheckoutModal.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/CheckoutModal.jsx)
* **What was added:**
  * A mock checkout modal supporting 3 simulation modes:
    1. **Instant Mock Approval:** Charges mock credit card, sets reservation to `CONFIRMED`, creates `Order`, increments `sold_quantity`, decrements `reserved_quantity`, and triggers celebratory confetti!
    2. **Mock Card Decline:** Rejects payment, sets reservation to `CANCELLED`, and atomically releases held tickets back to available inventory.
    3. **3-Second Async Webhook:** Marks transaction as `PENDING`, simulating an asynchronous payment gateway callback that settles after a network delay.

---

### Feature 8: Digital Passes with Dynamic Base64 QR Codes
* **Files:** [`frontend/src/components/TicketPass.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/TicketPass.jsx), [`frontend/src/pages/MyTicketsPage.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/MyTicketsPage.jsx)
* **What was added:**
  * Generates digital passes formatted like airline boarding passes with notch cutouts, tear lines, and event metadata.
  * Embeds dynamic **Base64 QR codes** containing cryptographic ticket verification payloads.
  * Includes an interactive **Gatekeeper / Scanner Tool** where event staff can verify ticket validity (`VALID`, `CHECKED_IN`, `REVOKED`).
  * One-click **Print / Save Pass** button.

---

### Feature 9: Multi-Tenant Analytics & Ticket Conversion Funnel
* **Files:** [`backend/src/services/analyticsService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/analyticsService.js), [`frontend/src/pages/OrganizerDashboard.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/OrganizerDashboard.jsx)
* **What was added:**
  * **Ticket Conversion Funnel:**
    * $\text{Conversion Rate} = \frac{\text{Confirmed Orders}}{\text{Total Holds Initiated}} \times 100\%$
    * $\text{Abandonment Rate} = \frac{\text{Expired Holds}}{\text{Total Holds Initiated}} \times 100\%$
    * Live visual funnel bars tracking hold drop-offs.
  * Revenue breakdown by tier and capacity utilization percentages.
  * Daily sales timeline tracking revenue growth over time.

---

### Feature 10: Redis Caching Layer
* **Files:** [`backend/src/services/cacheService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/cacheService.js), [`backend/src/controllers/eventController.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/controllers/eventController.js)
* **What was added:**
  * Caches high-read endpoints: `events:active` (all published events) and `event:<id>` (event details and tier inventory) with a 60-second TTL.
  * Sets standard **`X-Cache: HIT`** or **`X-Cache: MISS`** response headers for observability.
  * **Smart Invalidation:** Whenever a ticket is held, released, or purchased, the corresponding event cache is purged immediately.

---

### Feature 11: Background Queue Worker (Cron Job)
* **Files:** [`backend/src/services/workerService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/workerService.js), [`backend/src/controllers/workerController.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/controllers/workerController.js)
* **What was added:**
  * Scheduled cron job running every **10 seconds** via `node-cron`.
  * Scans for temporary holds where `status = 'HELD'` and `expires_at < NOW()`.
  * In an atomic transaction, marks holds as `EXPIRED` and increments `available_quantity` back to the pool.
  * Includes an on-demand trigger endpoint (`POST /api/worker/cleanup-holds`) accessible from the Admin Dashboard.

---

### Feature 12: Interactive Concurrency Arena (In-App Stress Tester)
* **File:** [`frontend/src/pages/ConcurrencyArena.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/ConcurrencyArena.jsx)
* **What was added:**
  * A dedicated interactive tab in the web application UI.
  * Allows evaluators to select any tier, choose 10, 20, or 30 simultaneous buyers, and launch a concurrent booking rush with 1 click.
  * Dispatches parallel asynchronous requests and displays an animated matrix of thread cards:
    * **Green Cards:** Thread reserved successfully (Hold token issued).
    * **Red Cards:** 409 Conflict: Sold out / Insufficient tickets.
  * Confirms **Double Bookings: 0 (ZERO)** live in the browser.

---

### Feature 13: Automated Concurrency Test Suite
* **File:** [`backend/tests/concurrency.test.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/tests/concurrency.test.js)
* **What was added:**
  * Standalone CLI test executed via `npm run test:concurrency`.
  * Creates a test event with a 5-ticket tier, fires 30 simultaneous asynchronous requests, and asserts that:
    1. Exactly 5 succeed.
    2. Exactly 25 receive 409 Conflict.
    3. Exactly 0 double bookings occur.
    4. Expired hold worker restores inventory automatically.
    5. Payment decline restores inventory automatically.

---

## 🗂️ 3. Submission & Deliverables Index

| Deliverable | Path | Description |
|---|---|---|
| **System Walkthrough** | [`SYSTEM_WALKTHROUGH.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/SYSTEM_WALKTHROUGH.md) | High-level system walkthrough, test execution logs, and step-by-step UI user journeys. |
| **Project Overview** | [`PROJECT_OVERVIEW.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/PROJECT_OVERVIEW.md) | This document: comprehensive feature guide, problem statement, and architecture breakdown. |
| **Main README** | [`README.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/README.md) | Project introduction, quickstart guide, setup instructions, and feature matrix. |
| **ER Diagram & Data Model** | [`docs/ER_DIAGRAM.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/ER_DIAGRAM.md) | Mermaid relational schema, data dictionary, and state transition lifecycle. |
| **Postman Test Collection** | [`postman/Multi-Tenant-Event-Reservation-System.postman_collection.json`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/postman/Multi-Tenant-Event-Reservation-System.postman_collection.json) | 18 pre-configured automated tests covering RBAC, edge cases, caching, and concurrency. |
| **Cloud Deployment Guide** | [`docs/DEPLOYMENT.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/DEPLOYMENT.md) | Cloud deployment guide for Render, Railway, and Vercel. |

---

## ⚡ 4. Quickstart Command Reference

```bash
# 1. Seed demonstration events, organizers, tiers, and orders
npm run seed

# 2. Run automated concurrency stress test
npm run test:concurrency

# 3. Start full-stack web application (Frontend: 5173, Backend: 5000)
npm run dev
```
