import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Ticket,
  Clock,
  Plus,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  X,
  Loader2
} from 'lucide-react';

export default function OrganizerDashboard() {
  const { currentUser } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Event Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technology');
  const [venue, setVenue] = useState('Convention Center & Remote');
  const [bannerUrl, setBannerUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [salesCutoffDate, setSalesCutoffDate] = useState('');
  const [tiers, setTiers] = useState([
    { name: 'VIP Pass', price: 299, totalQuantity: 30, maxPerOrder: 4 },
    { name: 'General Admission', price: 99, totalQuantity: 150, maxPerOrder: 6 }
  ]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, eventsRes] = await Promise.all([
        api.getAnalytics(currentUser?.tenantId),
        api.getOrganizerEvents(currentUser?.tenantId)
      ]);
      setAnalytics(analyticsRes.data.analytics);
      setEvents(eventsRes.data.events || []);
    } catch (err) {
      console.error('Failed to load organizer dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleAddTier = () => {
    setTiers([...tiers, { name: 'Tier ' + (tiers.length + 1), price: 50, totalQuantity: 50, maxPerOrder: 5 }]);
  };

  const handleRemoveTier = (idx) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const handleTierChange = (idx, field, value) => {
    const updated = [...tiers];
    updated[idx][field] = value;
    setTiers(updated);
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      await api.createEvent({
        title,
        description,
        category,
        venue,
        bannerUrl: bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
        startDate: startDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        salesCutoffDate: salesCutoffDate || new Date(Date.now() + 6 * 86400000).toISOString(),
        tiers
      });

      setShowCreateModal(false);
      // Reset form
      setTitle('');
      setDescription('');
      loadData();
    } catch (err) {
      setCreateError(err.data?.error || err.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading organizer tenant analytics...</p>
      </div>
    );
  }

  const kpis = analytics?.kpis || { totalRevenue: 0, totalTicketsSold: 0, totalOrders: 0, activeHolds: 0 };
  const funnel = analytics?.funnel || {
    totalReservations: 0,
    confirmedReservations: 0,
    expiredReservations: 0,
    conversionRate: 0,
    abandonmentRate: 0
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-200">
      {/* Header with Tenant Branding */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan text-xs">Organizer Studio</span>
            <span className="badge badge-purple text-xs flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Tenant: {currentUser?.tenantName || 'Organization Partition'}
            </span>
          </div>

          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white mt-1">
            Revenue Analytics & Event Management
          </h1>
          <p className="text-xs text-slate-400">
            Real-time metrics isolated to your organization tenant.
          </p>
        </div>

        <button
          id="open-create-event-modal"
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create New Event & Tiers
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Gross Revenue */}
        <div className="glass-panel p-6 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider">Gross Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-3xl text-white">
            ${Number(kpis.totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-emerald-400 mt-2 block font-medium">
            Live settled transactions
          </span>
        </div>

        {/* Tickets Sold */}
        <div className="glass-panel p-6 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider">Tickets Sold</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-3xl text-white">
            {kpis.totalTicketsSold}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">
            Confirmed digital passes issued
          </span>
        </div>

        {/* Conversion Rate */}
        <div className="glass-panel p-6 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider">Conversion Rate</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-3xl text-cyan-400">
            {funnel.conversionRate}%
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-medium">
            {funnel.confirmedReservations} completed of {funnel.totalReservations} holds
          </span>
        </div>

        {/* Active 10-Min Holds */}
        <div className="glass-panel p-6 rounded-3xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider">Active 10m Holds</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-3xl text-amber-400">
            {kpis.activeHolds}
          </div>
          <span className="text-[11px] text-amber-300 mt-2 block font-medium">
            Seats in temporary reservation
          </span>
        </div>
      </div>

      {/* Ticket Conversion Funnel Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Visual Funnel Bar */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-lg text-white">
              Ticket Conversion Funnel
            </h3>
            <span className="badge badge-purple text-[10px]">Real-Time Flow</span>
          </div>

          <div className="space-y-4">
            {/* Stage 1: Initiated Holds */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-semibold">1. Holds Initiated (10-Min Window)</span>
                <span className="font-mono text-white font-bold">{funnel.totalReservations}</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full w-full" />
              </div>
            </div>

            {/* Stage 2: Confirmed & Paid */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-300 font-semibold">2. Completed Orders (Paid)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {funnel.confirmedReservations} ({funnel.conversionRate}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, funnel.conversionRate)}%` }}
                />
              </div>
            </div>

            {/* Stage 3: Expired / Abandoned */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-rose-300 font-semibold">3. Expired / Abandoned Holds</span>
                <span className="font-mono text-rose-400 font-bold">
                  {funnel.expiredReservations} ({funnel.abandonmentRate}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, funnel.abandonmentRate)}%` }}
                />
              </div>
            </div>

            {/* Stage 4: In Progress Holds */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-300 font-semibold">4. Currently Active In-Progress Holds</span>
                <span className="font-mono text-amber-400 font-bold">{funnel.activeHeldReservations || 0}</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{
                    width: `${
                      funnel.totalReservations > 0
                        ? Math.max(5, ((funnel.activeHeldReservations || 0) / funnel.totalReservations) * 100)
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Automated Hold Recovery:</span>
            <strong className="text-emerald-400">Worker cleans expired seats every 10s</strong>
          </div>
        </div>

        {/* Tier Capacity Breakdown */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-lg text-white">
              Revenue & Capacity by Ticket Tier
            </h3>
            <span className="badge badge-cyan text-[10px]">Tier Breakdown</span>
          </div>

          <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
            {analytics?.tierBreakdown?.map((tier) => (
              <div key={tier.id} className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-heading font-bold text-sm text-white">{tier.tier_name}</span>
                    <span className="text-xs text-slate-400 ml-2 font-mono">${tier.price}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ${Number(tier.tierRevenue).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Sold: {tier.sold_quantity} / {tier.total_quantity}</span>
                  <span>Utilization: {tier.utilizationRate}%</span>
                </div>

                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                    style={{ width: `${tier.utilizationRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scoped Events Table */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <h3 className="font-heading font-bold text-lg text-white">
          Managed Organization Events
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-3 px-4">Event Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">Sales Deadline</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Available</th>
                <th className="py-3 px-4">Sold</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-semibold text-white">{evt.title}</td>
                  <td className="py-3 px-4 text-slate-300">{evt.category}</td>
                  <td className="py-3 px-4 text-slate-300">
                    {new Date(evt.start_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {new Date(evt.sales_cutoff_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 font-mono">{evt.total_capacity}</td>
                  <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{evt.total_available}</td>
                  <td className="py-3 px-4 font-mono text-indigo-300">{evt.total_sold}</td>
                  <td className="py-3 px-4">
                    <span className="badge badge-emerald text-[9px] py-0 px-2">{evt.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#0e1424] border border-white/15 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div>
                <h3 className="font-heading font-bold text-lg text-white">Create New Event</h3>
                <p className="text-xs text-slate-400">Configure event details and tiered ticket quantities</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Event Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Frontier Distributed Architecture 2026"
                  className="form-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide an overview of the event..."
                  className="form-input text-xs h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-input text-xs bg-slate-900"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Music & Arts">Music & Arts</option>
                    <option value="Finance">Finance</option>
                    <option value="Workshops">Workshops</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Venue / URL</label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="form-input text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Start Date</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Sales Cut-off Date</label>
                  <input
                    type="datetime-local"
                    value={salesCutoffDate}
                    onChange={(e) => setSalesCutoffDate(e.target.value)}
                    className="form-input text-xs"
                    required
                  />
                </div>
              </div>

              {/* Ticket Tiers Builder */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Ticket Tiers Configuration</span>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>

                {tiers.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-indigo-300 text-[11px] font-bold">Tier #{idx + 1}</span>
                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          className="text-rose-400 hover:text-rose-300 text-[10px]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Name (e.g. VIP)"
                        value={t.name}
                        onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                        className="form-input text-xs"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Price ($)"
                        value={t.price}
                        onChange={(e) => handleTierChange(idx, 'price', parseFloat(e.target.value) || 0)}
                        className="form-input text-xs font-mono"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Capacity"
                        value={t.totalQuantity}
                        onChange={(e) => handleTierChange(idx, 'totalQuantity', parseInt(e.target.value, 10) || 1)}
                        className="form-input text-xs font-mono"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Publish Event & Allocate Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
