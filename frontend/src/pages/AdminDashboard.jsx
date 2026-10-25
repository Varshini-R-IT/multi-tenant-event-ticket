import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  ShieldAlert,
  Server,
  Database,
  Cpu,
  Clock,
  RefreshCw,
  Building2,
  DollarSign,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  Zap
} from 'lucide-react';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  // Worker manual execution state
  const [workerResult, setWorkerResult] = useState(null);
  const [triggeringWorker, setTriggeringWorker] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, healthRes] = await Promise.all([
        api.getAnalytics(selectedTenant || null),
        api.getHealth()
      ]);
      setAnalytics(analyticsRes.data.analytics);
      setTenants(analyticsRes.data.tenants || []);
      setHealth(healthRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTenant]);

  const handleTriggerWorker = async () => {
    setTriggeringWorker(true);
    setWorkerResult(null);
    try {
      const res = await api.triggerCleanup();
      setWorkerResult(res.data);
      // Reload analytics to reflect released seats
      loadData();
    } catch (err) {
      setWorkerResult({ error: err.message || 'Worker trigger failed' });
    } finally {
      setTriggeringWorker(false);
    }
  };

  const kpis = analytics?.kpis || { totalRevenue: 0, totalTicketsSold: 0, activeEvents: 0, activeHolds: 0 };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-purple text-xs flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Platform Administrator
            </span>
            <span className="badge badge-emerald text-xs">Superuser Scope</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white mt-1">
            Global Systems & Cross-Tenant Oversight
          </h1>
          <p className="text-xs text-slate-400">
            Platform-wide metrics, tenant inspections, and queue worker controls.
          </p>
        </div>

        {/* Tenant Switcher Filter */}
        <div className="flex items-center gap-2 bg-slate-900 border border-white/10 p-1.5 rounded-2xl">
          <Building2 className="w-4 h-4 text-purple-400 ml-2" />
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="bg-transparent text-xs text-white font-medium focus:outline-none pr-3"
          >
            <option value="" className="bg-slate-900 text-white">All Organization Tenants (Global)</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                Tenant: {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-6 rounded-3xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Global Revenue
          </div>
          <div className="font-heading font-black text-3xl text-white">
            ${Number(kpis.totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-emerald-400 mt-2 block">
            Across {tenants.length || 3} tenant organizations
          </span>
        </div>

        <div className="glass-panel p-6 rounded-3xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Tickets Processed
          </div>
          <div className="font-heading font-black text-3xl text-indigo-400">
            {kpis.totalTicketsSold}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Confirmed digital passes generated
          </span>
        </div>

        <div className="glass-panel p-6 rounded-3xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Hosted Events
          </div>
          <div className="font-heading font-black text-3xl text-cyan-400">
            {kpis.activeEvents}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Published active events
          </span>
        </div>

        <div className="glass-panel p-6 rounded-3xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Live 10-Min Holds
          </div>
          <div className="font-heading font-black text-3xl text-amber-400">
            {kpis.activeHolds}
          </div>
          <span className="text-[11px] text-amber-300 mt-2 block">
            Seats in temporary reservation window
          </span>
        </div>
      </div>

      {/* Background Queue Worker Control Panel */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-indigo-500/30 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                Background Hold Expiration Queue Worker
              </h3>
              <p className="text-xs text-slate-400">
                Scheduled cron job running every 10 seconds (`node-cron`). Automatically restores expired 10-minute holds.
              </p>
            </div>
          </div>

          <button
            id="trigger-worker-cleanup-btn"
            onClick={handleTriggerWorker}
            disabled={triggeringWorker}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-2 whitespace-nowrap"
          >
            {triggeringWorker ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>Execute Hold Cleanup Sweep Now</span>
          </button>
        </div>

        {workerResult && (
          <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-xs font-mono space-y-1">
            <div className="text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {workerResult.message || 'Cleanup complete'}
            </div>
            {workerResult.result && (
              <div className="text-slate-400 text-[11px]">
                Released Count: <strong>{workerResult.result.releasedCount}</strong> hold(s) restored back to active inventory.
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Infrastructure Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <Database className="w-4 h-4" />
            Database Layer
          </div>
          <div className="text-white font-mono text-sm font-semibold">
            {health?.database || 'SQLite (sql.js WASM) + PostgreSQL'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ACID transaction isolation. Row locks on PostgreSQL (`FOR UPDATE`) & immediate serialized locks on SQLite.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Layers className="w-4 h-4" />
            Redis Caching & Mutex Lock
          </div>
          <div className="text-white font-mono text-sm font-semibold">
            {health?.caching || 'Active Distributed Lock Engine'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Caches active event reads (`events:active`). Distributed lock (`SET tier:id NX PX 6000`) prevents simultaneous race conflicts.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            Background Scheduler
          </div>
          <div className="text-white font-mono text-sm font-semibold">
            {health?.worker || 'Active (10s intervals)'}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Recovers abandoned seats after 600 seconds. Emits cache invalidations to keep public listings synchronized.
          </p>
        </div>
      </div>
    </div>
  );
}
