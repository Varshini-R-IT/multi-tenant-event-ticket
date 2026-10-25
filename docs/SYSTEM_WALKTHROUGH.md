# System Walkthrough & Architectural Deliverable

## Multi-Tenant Event & Tiered Ticket Reservation Engine

---

### 1. Project High-Level Architecture

The system is a full-stack, multi-tenant ticketing platform engineered with strict ACID transaction controls and distributed mutex locking to prevent double-booking seats during high-concurrency ticket sales.

```
                              ┌───────────────────────────────────┐
                              │     Vite React Glassmorphic UI    │
                              │ (Role Switcher, 10m Hold Banner,  │
                              │  Payment Modal, QR Code Passes)   │
                              └─────────────────┬─────────────────┘
                                                │ REST API / JWT
                                                ▼
                              ┌───────────────────────────────────┐
                              │     Express API Backend Service   │
                              │   (RBAC, Tenant Isolation, Auth)  │
                              └───────┬───────────────┬───────────┘
                                      │               │
                     ┌────────────────┴────┐    ┌─────┴────────────────┐
                     │  Redis Lock & Cache │    │ 10-Min Hold Engine & │
                     │  (SETNX Mutex Lock, │    │ Background Cron Queue│
                     │  'events:active')   │    │ (Sweeps every 10s)   │
                     └─────────────────────┘    └──────────────────────┘
                                      │
                                      ▼
                      ┌─────────────────────────────────┐
                      │    Dual-Engine ACID Database    │
                      │  • SQLite (sql.js WASM + Disk)  │
                      │  • PostgreSQL (SELECT FOR UPDATE│
                      └─────────────────────────────────┘
```

---

### 2. Comprehensive Features Matrix

| Feature | Detailed Implementation | Primary Source Files |
|---|---|---|
| **Role-Based Access Control (RBAC)** | Strict JWT authentication supporting 3 roles: `ADMIN`, `ORGANIZER`, and `ATTENDEE`. Route-level access guards enforce permissions. A 1-click role switcher in the UI allows instant role switching. | [`backend/src/middleware/rbac.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/middleware/rbac.js)<br>[`frontend/src/components/Navbar.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/Navbar.jsx) |
| **Multi-Tenancy** | Organization-level isolation: Organizers (e.g. *Global Tech Summits* vs *NeonWave Festivals*) manage their own events and see isolated revenue/conversion rates. Platform Admins have global cross-tenant visibility. | [`backend/src/services/analyticsService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/analyticsService.js)<br>[`backend/src/middleware/rbac.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/middleware/rbac.js) |
| **Event Management** | Organizers create and update events, define multiple ticket tiers (VIP, General Admission, Early Bird), set prices, set capacities, and define sales cut-off deadlines. | [`backend/src/controllers/eventController.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/controllers/eventController.js)<br>[`frontend/src/pages/OrganizerDashboard.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/OrganizerDashboard.jsx) |
| **10-Minute Hold Reservation Engine** | Attendees select seats and place them in a 10-minute temporary reservation hold (`status: 'HELD'`). The hold persists in `sessionStorage` and is displayed via a real-time countdown banner (`MM:SS`). | [`backend/src/services/reservationService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/reservationService.js)<br>[`frontend/src/components/ReservationHoldBanner.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/ReservationHoldBanner.jsx) |
| **Concurrency & Double-Booking Protection** | Serialized Redis mutex lock (`SETNX token PX 6000`) + atomic database transactions (`BEGIN IMMEDIATE` in SQLite, `SELECT ... FOR UPDATE` in PostgreSQL) enforce strict inventory invariants. | [`backend/src/services/reservationService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/reservationService.js)<br>[`backend/tests/concurrency.test.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/tests/concurrency.test.js) |
| **Mock Payment Gateway Simulation** | Endpoint `/api/payments/charge` simulating instant Approval (issues tickets), Card Decline (auto-frees inventory back to pool), and 3-second Asynchronous Webhooks. | [`backend/src/services/paymentService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/paymentService.js)<br>[`frontend/src/components/CheckoutModal.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/CheckoutModal.jsx) |
| **Digital Tickets with QR Codes** | Order completion issues verifiable tickets with cryptographic Base64 QR codes formatted as concert/airline boarding passes with ticket tear notches. Includes a ticket verification scanner. | [`frontend/src/components/TicketPass.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/components/TicketPass.jsx)<br>[`frontend/src/pages/MyTicketsPage.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/MyTicketsPage.jsx) |
| **Analytics Dashboard & Conversion Funnel** | Real-time conversion funnels (`Holds Initiated -> Confirmed Orders -> Expired Holds`), conversion/abandonment rates %, revenue breakdown by tier, and daily sales timeline. | [`frontend/src/pages/OrganizerDashboard.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/OrganizerDashboard.jsx)<br>[`backend/src/services/analyticsService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/analyticsService.js) |
| **Redis Caching Layer** | High-throughput cache for active events with `X-Cache: HIT/MISS` headers and smart invalidation upon any hold, release, or purchase. | [`backend/src/services/cacheService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/cacheService.js) |
| **Background Cron Worker** | Runs every 10 seconds via `node-cron` to automatically release expired holds back to available inventory. | [`backend/src/services/workerService.js`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/backend/src/services/workerService.js) |
| **Race Condition Arena (In-App)** | Live interactive stress-testing arena in the UI where evaluators can fire 20 or 30 simultaneous booking threads and watch the atomic lock handle them with zero double-booking. | [`frontend/src/pages/ConcurrencyArena.jsx`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/frontend/src/pages/ConcurrencyArena.jsx) |

---

### 3. Concurrency Stress Test Results

Run the automated test at any time:
```bash
npm run test:concurrency
```

**Automated Test Benchmark Execution:**
```text
================================================================
 RUNNING CONCURRENCY & RACE-CONDITION AUTOMATED TEST SUITE
================================================================

[Setup] Creating test event with high-demand tier:
        Tier Capacity: 5 tickets
        Simultaneous Booking Contenders: 30 concurrent users

[TEST 1] Firing 30 simultaneous reservation requests for 5 tickets...
[Results Summary - 134ms]:
 -> Successful Reservations: 5 / 5 (Expected: 5)
 -> Clean 409 Conflict Rejections: 25 / 25 (Expected: 25)
 -> Unexpected Errors: 0 (Expected: 0)

[Database Inventory Verification]:
 -> Total: 5 | Reserved: 5 | Available: 0 | Sold: 0

>>> [PASS] RACE CONDITION TEST PASSED: Exactly 5 bookings succeeded, zero double-bookings! <<<

----------------------------------------------------------------
[TEST 2] Testing 10-Minute Hold Expiry & Automatic Worker Release...
 -> Artificially set reservation expiry to past
 -> Worker executed. Holds released: 1
 -> Restored Available Inventory: 1 (Expected: 1)

>>> [PASS] EXPIRED HOLD WORKER TEST PASSED: Inventory automatically restored! <<<

----------------------------------------------------------------
[TEST 3] Testing Mock Gateway Payments (Decline & Approve)...
 -> Simulated Decline Status: FAILED (Available inventory restored to 2)
 -> Simulated Approval Status: SUCCESS (Order & QR Tickets Issued)

>>> [PASS] PAYMENT GATEWAY & ORDER CHECKOUT TEST PASSED! <<<
================================================================
 ALL TEST SUITES COMPLETED WITH 100% SUCCESS!
 Zero double bookings. Strict ACID transactions verified.
================================================================
```

---

### 4. Step-by-Step UI User Journeys

#### Journey 1: Attendee Booking & 10-Minute Hold
1. Open the web app at `http://localhost:5173/`.
2. Browse active events (e.g., *Global AI & Cloud Architecture Summit 2026*).
3. Click **Reserve Seats**.
4. Choose ticket quantity (e.g., 2 General Admission passes) and click **Place 10-Minute Hold**.
5. Observe the **floating reservation banner** at the top with the live countdown timer (`09:59 remaining`) and the **Mock Payment Gateway Modal**.
6. Select **Approve** and click **Pay $398 USD (Mock Simulation)**.
7. Confetti triggers! View your generated Order and **Digital Passes with dynamic Base64 QR codes**.

#### Journey 2: Race Condition Simulation in UI
1. Click **Race Condition Arena** in the top navigation bar.
2. Select an event tier with limited tickets (e.g. *Ultra VIP Backstage Lounge*, which has only 3 tickets left).
3. Select **20 Rush** (20 simultaneous simulated buyers).
4. Click **Launch 20 Concurrent Requests**.
5. Watch the thread matrix execute in parallel:
   - Exactly the remaining seats succeed (Green cards with reservation tokens).
   - All subsequent threads receive clean `409 Conflict: TICKETS_UNAVAILABLE` (Red cards).
   - Double Bookings counter displays **0 (ZERO)**.

#### Journey 3: Organizer Multi-Tenant Studio
1. Open the **1-Click Role Switcher** dropdown in the top right.
2. Switch to **Sarah Connor (Tech Summit Lead)**.
3. Click **Organizer Studio** in the navigation bar.
4. Review isolated revenue, tickets sold, and the **Ticket Conversion Funnel**:
   - `Holds Started` ➔ `Confirmed & Paid` ➔ `Expired / Abandoned`
5. Click **Create New Event & Tiers** to add custom events and configure sales cut-off deadlines.

#### Journey 4: Platform Administrator & Background Worker
1. Switch role to **Alex Vance (Global Admin)**.
2. Click **Platform Admin** in the navigation bar.
3. Inspect cross-tenant revenue across all organizer organizations.
4. Click **Execute Hold Cleanup Sweep Now** to manually trigger the background queue worker and view the released seat count.

---

### 5. Deliverables Links

* **ER Diagram & Schema Architecture:** [`docs/ER_DIAGRAM.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/ER_DIAGRAM.md)
* **Postman Collection v2.1:** [`postman/Multi-Tenant-Event-Reservation-System.postman_collection.json`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/postman/Multi-Tenant-Event-Reservation-System.postman_collection.json)
* **Cloud Deployment Guide (Render, Railway, Vercel):** [`docs/DEPLOYMENT.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/DEPLOYMENT.md)
* **Main Project README:** [`README.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/README.md)
