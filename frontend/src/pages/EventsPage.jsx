import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Calendar,
  MapPin,
  Ticket,
  Search,
  Filter,
  Flame,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  Database
} from 'lucide-react';

export default function EventsPage({ onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [cacheHeader, setCacheHeader] = useState('MISS');

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const res = await api.getEvents();
        setEvents(res.data.events || []);
        setCacheHeader(res.cacheHeader || (res.data.source === 'cache' ? 'HIT' : 'MISS'));
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const categories = ['ALL', 'Technology', 'Music & Arts', 'Finance'];

  const filteredEvents = events.filter((e) => {
    const matchesCategory = category === 'ALL' || e.category === category;
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.venue.toLowerCase().includes(search.toLowerCase()) ||
      e.organizer_name?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-200">
      {/* Hero Showcase Section */}
      <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 border border-white/10 bg-gradient-to-br from-[#0d1322] via-[#090d16] to-[#07090e] shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>High-Throughput Concurrency Engine with Zero Double-Booking</span>
          </div>

          <h1 className="font-heading font-black text-3xl sm:text-5xl text-white tracking-tight leading-tight">
            Reserve Tiered Tickets with{' '}
            <span className="gradient-text-primary">Atomic Guarantee.</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Multi-tenant event ticketing powered by temporary 10-minute hold engines, Redis distributed locks,
            and background queue workers. Experience seamless concurrent bookings without race conditions.
          </p>

          {/* Architecture Feature Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-left">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-1">
                <Database className="w-3.5 h-3.5" />
                ACID Locking
              </div>
              <div className="text-[11px] text-slate-400">SELECT FOR UPDATE / Atomic TX</div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-left">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                <Clock className="w-3.5 h-3.5" />
                10-Min Holds
              </div>
              <div className="text-[11px] text-slate-400">Temporary seat hold engine</div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-left">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-1">
                <Layers className="w-3.5 h-3.5" />
                Redis Caching
              </div>
              <div className="text-[11px] text-slate-400">High-read performance ({cacheHeader})</div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-left">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Multi-Tenant
              </div>
              <div className="text-[11px] text-slate-400">RBAC Organizer isolation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                category === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search events, cities, organizers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input text-xs pl-9 py-2"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Fetching active events from cache...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-3xl p-8">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-heading font-bold text-lg text-white">No Events Found</h3>
          <p className="text-xs text-slate-400 mt-1">Try tweaking your search keywords or filter category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => {
            const minPrice = evt.minPrice || (evt.tiers?.[0]?.price ?? 0);
            const totalAvailable = evt.totalAvailable ?? 0;
            const totalCapacity = evt.totalCapacity ?? 1;
            const isLowStock = totalAvailable > 0 && totalAvailable <= 10;
            const isSoldOut = totalAvailable === 0;

            return (
              <div
                key={evt.id}
                className="glass-panel overflow-hidden flex flex-col justify-between group hover:border-indigo-500/40 transition-all duration-300 rounded-3xl"
              >
                <div>
                  {/* Card Banner Image */}
                  <div className="h-48 w-full relative overflow-hidden bg-slate-800">
                    <img
                      src={evt.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'}
                      alt={evt.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-black/30" />

                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="badge badge-purple text-[10px] py-0.5 px-2">
                        {evt.category}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                      <span className="font-medium text-slate-200 truncate">
                        {evt.organizer_name}
                      </span>
                      <span className="font-mono font-bold text-indigo-300">
                        {evt.tiers?.length || 1} Tiers Available
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-3">
                    <h3 className="font-heading font-bold text-lg text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {evt.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {evt.description}
                    </p>

                    <div className="space-y-1.5 pt-2 text-xs text-slate-300 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">
                          {new Date(evt.start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{evt.venue}</span>
                      </div>
                    </div>

                    {/* Capacity Indicator */}
                    <div className="pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span>
                          {isSoldOut ? (
                            <strong className="text-rose-400">Sold Out</strong>
                          ) : isLowStock ? (
                            <strong className="text-amber-400 flex items-center gap-1">
                              <Flame className="w-3 h-3" /> Only {totalAvailable} Left!
                            </strong>
                          ) : (
                            <span>{totalAvailable} tickets available</span>
                          )}
                        </span>
                        <span>{totalCapacity} total</span>
                      </div>

                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            isSoldOut
                              ? 'bg-rose-500'
                              : isLowStock
                              ? 'bg-amber-400'
                              : 'bg-indigo-500'
                          }`}
                          style={{
                            width: `${Math.max(5, ((totalCapacity - totalAvailable) / totalCapacity) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 pt-0 flex items-center justify-between border-t border-white/5 mt-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block">Starting from</span>
                    <span className="font-heading font-extrabold text-lg text-white">
                      ${minPrice}<span className="text-xs font-normal text-slate-400">/pass</span>
                    </span>
                  </div>

                  <button
                    id={`view-event-${evt.id}`}
                    onClick={() => onSelectEvent(evt.id)}
                    className="btn-primary text-xs py-2 px-3.5"
                  >
                    <span>Reserve Seats</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
