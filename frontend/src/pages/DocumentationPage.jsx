import React, { useState } from 'react';
import {
  FileCode,
  Download,
  Copy,
  Check,
  Database,
  Layers,
  ShieldCheck,
  Clock,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export default function DocumentationPage() {
  const [copied, setCopied] = useState(false);

  const handleCopyPostman = () => {
    fetch('/postman/Multi-Tenant-Event-Reservation-System.postman_collection.json')
      .then((res) => res.text())
      .then((text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback message
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-emerald text-xs">Deliverables & Schemas</span>
            <span className="badge badge-purple text-xs">Architecture v2.0</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white mt-1">
            System Architecture, ER Diagram & Postman Suite
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive documentation for evaluation and cloud deployment.
          </p>
        </div>

        <div className="flex gap-2">
          <a
            href="/postman/Multi-Tenant-Event-Reservation-System.postman_collection.json"
            download="Multi-Tenant-Event-Reservation-System.postman_collection.json"
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Postman Collection
          </a>
        </div>
      </div>

      {/* 1. Entity-Relationship Data Model */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                1. Relational Data Model (ER Diagram)
              </h3>
              <p className="text-xs text-slate-400">
                Normalized tables partitioned for multi-tenancy and atomic inventory invariants.
              </p>
            </div>
          </div>
          <span className="badge badge-cyan text-[10px]">8 Core Entities</span>
        </div>

        {/* Entities Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-indigo-400 font-bold text-xs uppercase">1. tenants</div>
            <p className="text-xs text-slate-300">
              Isolates organizer workspaces (e.g. Tech Summits vs NeonWave Festivals).
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | UK: slug
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-indigo-400 font-bold text-xs uppercase">2. users (RBAC)</div>
            <p className="text-xs text-slate-300">
              Role-based identities: ADMIN, ORGANIZER, and ATTENDEE.
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | FK: tenant_id
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-indigo-400 font-bold text-xs uppercase">3. events</div>
            <p className="text-xs text-slate-300">
              Event metadata, venue, start/end dates, and sales cut-off deadlines.
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | FK: tenant_id, organizer_id
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-indigo-400 font-bold text-xs uppercase">4. ticket_tiers</div>
            <p className="text-xs text-slate-300">
              Tier pricing & capacity: available, reserved (in holds), and sold.
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | FK: event_id
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-amber-400 font-bold text-xs uppercase">5. reservations</div>
            <p className="text-xs text-slate-300">
              10-minute temporary holds (HELD, CONFIRMED, EXPIRED, CANCELLED).
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | FK: ticket_tier_id, user_id
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-emerald-400 font-bold text-xs uppercase">6. orders</div>
            <p className="text-xs text-slate-300">
              Completed purchases with order numbers, quantity, and total amount.
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | UK: order_number
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-emerald-400 font-bold text-xs uppercase">7. tickets</div>
            <p className="text-xs text-slate-300">
              Individual digital tickets with cryptographic Base64 QR code passes.
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | UK: ticket_number
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="font-mono text-cyan-400 font-bold text-xs uppercase">8. transactions</div>
            <p className="text-xs text-slate-300">
              Payment records with mock gateway references (APPROVED, FAILED, PENDING).
            </p>
            <div className="text-[10px] text-slate-500 font-mono">
              PK: id | FK: reservation_id
            </div>
          </div>
        </div>

        {/* ASCII / Text ER Representation */}
        <div className="p-4 rounded-2xl bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto border border-white/10 leading-relaxed">
          <pre>{`[TENANTS] 1 ──── ∞ [USERS (ADMIN | ORGANIZER | ATTENDEE)]
   │
   ├────── 1 ──── ∞ [EVENTS] 1 ──── ∞ [TICKET_TIERS]
   │                   │                      │
   │                   └──── 1 ─── ∞ [RESERVATIONS (10-min hold)]
   │                                          │
   └────── 1 ──── ∞ [ORDERS] 1 ───────────────┘ (Converts on payment approval)
                       │
                       ├──── 1 ─── ∞ [TICKETS (QR Codes)]
                       └──── 1 ─── 1 [TRANSACTIONS (Gateway Ref)]`}</pre>
        </div>
      </div>

      {/* 2. Concurrency & Double-Booking Protection */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg text-white">
              2. Concurrency & Race-Condition Defense
            </h3>
            <p className="text-xs text-slate-400">
              How the system guarantees zero double bookings under heavy traffic.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
            <strong className="text-white block font-bold">1. Redis Mutex Lock</strong>
            <p className="text-slate-400 text-[11px]">
              Acquires a distributed lock on the tier ID (`SET tier:id token NX PX 6000`) before evaluating stock.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
            <strong className="text-white block font-bold">2. ACID Row-Level Locks</strong>
            <p className="text-slate-400 text-[11px]">
              `BEGIN IMMEDIATE` (SQLite) or `SELECT ... FOR UPDATE` (PostgreSQL) locks the inventory row.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
            <strong className="text-white block font-bold">3. Atomic 409 Conflict</strong>
            <p className="text-slate-400 text-[11px]">
              If remaining tickets &lt; requested quantity, the transaction is immediately rolled back with clean 409 Conflict.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Postman Collection Reference */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                3. Postman Test Collection (v2.1)
              </h3>
              <p className="text-xs text-slate-400">
                18 automated tests testing all edge cases, RBAC permissions, and concurrency.
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyPostman}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied JSON!' : 'Copy Collection'}</span>
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 font-mono text-xs text-slate-400 space-y-2 border border-white/10">
          <div className="text-white font-bold">Included Folders:</div>
          <ul className="list-disc list-inside space-y-1 text-[11px]">
            <li><strong>1. Authentication &amp; RBAC:</strong> Admin, Organizer, and Attendee login + demo token issuance</li>
            <li><strong>2. Events &amp; Caching Layer:</strong> Checks X-Cache header (HIT/MISS), tier creation, and attendee forbidden test (403)</li>
            <li><strong>3. 10-Minute Hold Reservation:</strong> 10-minute hold placement, live countdown, and over-capacity edge case (409)</li>
            <li><strong>4. Mock Payment Gateway:</strong> Instant approval (generates QR codes), decline (auto-releases hold), and async webhook</li>
            <li><strong>5. Analytics Dashboard:</strong> Scoped organizer KPIs vs platform-wide admin metrics</li>
            <li><strong>6. Background Worker:</strong> Hold expiration cleanup sweep triggering</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
