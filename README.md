# Multi-Tenant Event & Tiered Ticket Reservation System

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20(WASM)%20%7C%20PostgreSQL-blue.svg)](https://www.postgresql.org/)
[![Caching & Lock](https://img.shields.io/badge/Cache-Redis%20%7C%20In--Memory-red.svg)](https://redis.io/)
[![ACID Concurrency](https://img.shields.io/badge/Concurrency-Zero%20Double--Booking-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-MIT-purple.svg)]()

A production-grade, multi-tenant web application and ticket reservation engine engineered to prevent double-booking under extreme concurrent booking attempts. Built with **Node.js, Express, WebAssembly SQLite / PostgreSQL, Redis distributed locks, and a modern glassmorphic Vite React frontend**.

---

## 🌟 Key Features & Requirements Matrix

| Requirement | Implementation & Technical Architecture | Status |
|---|---|---|
| **Role-Based Access Control (RBAC)** | Strict JWT middleware supporting 3 roles: `ADMIN`, `ORGANIZER`, and `ATTENDEE`. 1-click role switcher included in UI for live testing. | ✅ Complete |
| **Multi-Tenancy** | Organization isolation: Organizers (e.g. *Tech Summits* vs *NeonWave Festivals*) manage their own events, tiers, cut-off dates, and see isolated revenue analytics. Admins have cross-tenant global visibility. | ✅ Complete |
| **Event Management** | Organizers create events, specify ticket tiers (VIP, GA, Early Bird), set prices, physical capacities, purchase limits, and sales cut-off deadlines. | ✅ Complete |
| **10-Minute Hold Engine** | Attendees select tickets and place them in a 10-minute temporary reservation hold (`status: 'HELD'`). Real-time live countdown timer (MM:SS) with urgent visual cues. | ✅ Complete |
| **Race-Condition & Double-Booking Protection** | Serialized Redis mutex lock (`SETNX token PX 6000`) + atomic database transactions (`BEGIN IMMEDIATE` in SQLite, `SELECT ... FOR UPDATE` in Postgres) enforce strict inventory invariants. | ✅ Complete |
| **Mock Payment Gateway** | Realistic gateway endpoint (`/api/payments/charge`) with instant Approval, Card Decline (auto-frees inventory back to pool), and 3-second Asynchronous Webhooks. | ✅ Complete |
| **Digital Tickets & QR Codes** | Upon payment approval, generates confirmed `Order` and individual `Ticket` records with verifiable cryptographic Base64 QR code passes. | ✅ Complete |
| **Analytics Dashboard** | Real-time revenue breakdown by tier, ticket conversion funnels (`Holds Initiated -> Confirmed Orders -> Expired Holds`), and daily sales timeline charts. | ✅ Complete |
| **Caching Layer (Redis)** | High-throughput read cache for active events (`events:active` and `event:<id>`). Sets `X-Cache: HIT` / `MISS` response headers with automatic cache invalidation upon any hold or release. | ✅ Complete |
| **Background Cron Worker** | Automated worker running every 10 seconds (`node-cron`) to sweep expired holds (`expires_at < NOW()`), restore available inventory, and invalidate caches. | ✅ Complete |
| **Automated Concurrency Test Suite** | Automated script (`npm run test:concurrency`) spawning 30 concurrent async requests against 5 tickets, asserting exactly 5 succeed and 25 receive 409 Conflict. | ✅ Complete |
| **Interactive Concurrency Arena** | Live visual stress-testing arena directly inside the web application UI to demonstrate atomic locking in real time. | ✅ Complete |

---

## 📐 Relational Data Model & ER Diagram

```mermaid
erDiagram
    TENANTS ||--o{ USERS : "employs"
    TENANTS ||--o{ EVENTS : "hosts"
    TENANTS ||--o{ ORDERS : "earns revenue"
    USERS ||--o{ EVENTS : "creates (ORGANIZER)"
    USERS ||--o{ RESERVATIONS : "reserves (ATTENDEE)"
    USERS ||--o{ ORDERS : "places"
    EVENTS ||--|{ TICKET_TIERS : "offers"
    EVENTS ||--o{ RESERVATIONS : "holds"
    EVENTS ||--o{ ORDERS : "fulfills"
    EVENTS ||--o{ TICKETS : "admits"
    TICKET_TIERS ||--o{ RESERVATIONS : "reserves capacity"
    TICKET_TIERS ||--o{ ORDERS : "categorizes"
    TICKET_TIERS ||--o{ TICKETS : "specifies tier"
    RESERVATIONS ||--o| ORDERS : "converts on payment"
    RESERVATIONS ||--o{ TRANSACTIONS : "attempts"
    ORDERS ||--|{ TICKETS : "generates"
    ORDERS ||--o{ TRANSACTIONS : "settles via"

    TENANTS {
        string id PK "ten_xxx"
        string name "Organization Name"
        string slug UK "Branded URL slug"
        text description
        timestamp created_at
    }

    USERS {
        string id PK "usr_xxx"
        string tenant_id FK "Nullable for Admin/Attendee"
        string email UK "Login email"
        string password_hash "Bcrypt"
        string name "Full Name"
        string role "ADMIN | ORGANIZER | ATTENDEE"
        timestamp created_at
    }

    EVENTS {
        string id PK "evt_xxx"
        string tenant_id FK "Tenant partition"
        string organizer_id FK
        string title "Headline"
        text description
        string category "Tech, Music, etc."
        string venue "Location or URL"
        string banner_url
        timestamp start_date
        timestamp end_date
        timestamp sales_cutoff_date
        string status "PUBLISHED | CANCELLED"
        timestamp created_at
    }

    TICKET_TIERS {
        string id PK "tier_xxx"
        string event_id FK
        string name "VIP, General Admission"
        text description "Perks"
        decimal price "USD"
        int total_quantity "Total capacity"
        int available_quantity "Available for hold"
        int reserved_quantity "Active in 10-min holds"
        int sold_quantity "Confirmed paid"
        int max_per_order
        timestamp created_at
    }

    RESERVATIONS {
        string id PK "res_xxx"
        string ticket_tier_id FK
        string event_id FK
        string user_id FK
        int quantity
        decimal unit_price
        decimal total_amount
        string status "HELD | CONFIRMED | EXPIRED | CANCELLED"
        string hold_token UK "Unique hold token"
        timestamp created_at
        timestamp expires_at "now + 10 minutes"
        timestamp confirmed_at
    }

    ORDERS {
        string id PK "ord_xxx"
        string order_number UK "ORD-XXXX-XXXX"
        string reservation_id FK
        string event_id FK
        string tenant_id FK
        string user_id FK
        string ticket_tier_id FK
        int quantity
        decimal total_amount
        string status "PAID"
        timestamp created_at
    }

    TICKETS {
        string id PK "tck_xxx"
        string order_id FK
        string ticket_number UK "TCK-XXXX-XXXXXX"
        string event_id FK
        string ticket_tier_id FK
        string attendee_name
        string attendee_email
        text qr_code "Base64 QR image"
        string status "VALID | CHECKED_IN"
        timestamp created_at
    }

    TRANSACTIONS {
        string id PK "txn_xxx"
        string order_id FK
        string reservation_id FK
        decimal amount
        string currency "USD"
        string payment_method "MOCK_CARD"
        string gateway_ref
        string status "PENDING | SUCCESS | FAILED"
        text failure_reason
        timestamp created_at
    }
```

Detailed schema definitions, constraints, and state transition lifecycles are documented in [`docs/ER_DIAGRAM.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/ER_DIAGRAM.md).

---

## ⚡ Concurrency & Double-Booking Protection Mechanics

To prevent double-booking when hundreds of attendees compete for limited inventory:

1. **Distributed Mutex Lock**:
   - The server acquires an atomic lock on the tier resource key (`SET lock:tier:<tierId> <token> NX PX 6000`).
   - If contested, requests queue with randomized exponential backoff.
2. **ACID Transaction Isolation**:
   - The transaction begins with immediate row-level exclusive locks:
     - In **SQLite**: `BEGIN IMMEDIATE` acquires exclusive transaction write locking on disk.
     - In **PostgreSQL**: `SELECT * FROM ticket_tiers WHERE id = $1 FOR UPDATE`.
3. **Atomic Inventory Decrement**:
   - Compares: `available_quantity >= requested_quantity`.
   - If insufficient: immediately aborts with `409 Conflict: TICKETS_UNAVAILABLE`.
   - If available: decrements `available_quantity` and increments `reserved_quantity`.
   - Generates reservation with `status = 'HELD'` and `expires_at = NOW() + 10 minutes`.
4. **Automatic Hold Recovery Worker**:
   - Cron worker runs every 10 seconds:
     ```sql
     SELECT * FROM reservations WHERE status = 'HELD' AND expires_at < CURRENT_TIMESTAMP;
     ```
   - In an atomic transaction, increments `available_quantity` and marks hold as `EXPIRED`.
   - Invalidates Redis cache so other users can immediately book the released tickets.

---

## 🚀 Quickstart & Local Execution

The project features a **Dual-Engine Architecture**:
- Works out of the box with zero external database setup via **WebAssembly SQLite (`sql.js`)** and disk persistence.
- Seamlessly connects to **PostgreSQL (`DATABASE_URL`)** and **Redis (`REDIS_URL`)** when deployed.

### 1. Clone & Install
```bash
git clone <repository-url>
cd "WT assignment"

# Install root orchestration, backend, and frontend dependencies
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. Seed Demonstration Data
Populates realistic organizers, conference events, ticket tiers, orders, and tickets:
```bash
npm run seed
```

### 3. Run Automated Concurrency Stress Test
Fires 30 simultaneous asynchronous booking attempts on a 5-ticket tier, asserting 100% ACID integrity:
```bash
npm run test:concurrency
```

### 4. Start Full-Stack Application
```bash
npm run dev
```

Visit:
- **Frontend Web Application**: [http://localhost:5173](http://localhost:5173)
- **REST API Backend**: [http://localhost:5000/api](http://localhost:5000/api)
- **Health Telemetry**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 👥 Demo Pre-Seeded Accounts

Use the **1-Click Role Switcher** dropdown in the top navigation bar to test any role:

| Role | Email | Password | Tenant / Organization Scope |
|---|---|---|---|
| **Platform Admin** | `admin@eventreserve.com` | `admin123` | Global Platform Visibility (All Tenants) |
| **Organizer (Tech)** | `sarah@techsummit.io` | `organizer123` | *Global Tech Summits Inc.* |
| **Organizer (Music)** | `marcus@neonwave.live` | `organizer123` | *NeonWave Festival Media* |
| **Attendee (Alice)** | `alice@example.com` | `attendee123` | Public Buyer (Pre-loaded with digital tickets) |
| **Attendee (Bob)** | `bob@example.com` | `attendee123` | Public Buyer |

---

## 📬 Postman Test Collection

A complete Postman Collection v2.1 is included at:
[`postman/Multi-Tenant-Event-Reservation-System.postman_collection.json`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/postman/Multi-Tenant-Event-Reservation-System.postman_collection.json)

### Tested Test Suites:
1. **Authentication & RBAC:** Admin, Organizer, and Attendee token generation.
2. **Events & Caching:** Redis `X-Cache` header verification (`MISS` on first fetch, `HIT` on second fetch), Tier creation, and Attendee unauthorized access check (403 Forbidden).
3. **10-Minute Hold Reservation:** Temporary hold placement, live countdown, and over-capacity edge case (409 Conflict).
4. **Mock Payment Gateway:** Instant approval (generates QR codes), simulated decline (auto-frees seats), and 3-second async webhook.
5. **Analytics Dashboard:** Multi-tenant isolated KPIs vs admin global view.
6. **Background Worker:** On-demand hold expiration cleanup sweep.

To import: Open Postman -> Click **Import** -> Select `postman/Multi-Tenant-Event-Reservation-System.postman_collection.json` -> Run Collection.

---

## ☁️ Cloud Deployment Guide

Full step-by-step instructions for deploying to **Render, Railway, and Vercel** are available in [`docs/DEPLOYMENT.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/DEPLOYMENT.md).

### Environment Variables Reference:
```env
PORT=5000
NODE_ENV=production
JWT_SECRET=your_secure_jwt_secret_key_here
DATABASE_URL=postgres://user:password@host:5432/dbname # Optional: uses SQLite WASM if omitted
REDIS_URL=rediss://default:password@upstash.io:6379     # Optional: uses in-memory lock engine if omitted
```

---

## 📚 Project Documentation & References

* **Project Overview & Added Features Guide:** [`PROJECT_OVERVIEW.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/PROJECT_OVERVIEW.md)
* **System Walkthrough & UI User Journeys:** [`SYSTEM_WALKTHROUGH.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/SYSTEM_WALKTHROUGH.md)
* **ER Diagram & Data Model Architecture:** [`docs/ER_DIAGRAM.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/ER_DIAGRAM.md)
* **Cloud Deployment Guide (Render, Railway, Vercel):** [`docs/DEPLOYMENT.md`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/docs/DEPLOYMENT.md)
* **Postman Test Collection v2.1:** [`postman/Multi-Tenant-Event-Reservation-System.postman_collection.json`](file:///c:/Users/Varsha/OneDrive/Desktop/AG%20CODE/WT%20assignment/postman/Multi-Tenant-Event-Reservation-System.postman_collection.json)

---

## 🛡️ License

MIT License. Designed and engineered for high-concurrency event reservations.
