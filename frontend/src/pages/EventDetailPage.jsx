import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
  Check,
  Flame,
  Ticket,
  Loader2,
  Users
} from 'lucide-react';

export default function EventDetailPage({ eventId, onBack, onOpenCheckout }) {
  const { setHold } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected quantities per tier: { [tierId]: number }
  const [quantities, setQuantities] = useState({});
  const [reservingTierId, setReservingTierId] = useState(null);
  const [reservationError, setReservationError] = useState(null);
  const [cacheSource, setCacheSource] = useState('database');

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getEventById(eventId);
        setEvent(res.data.event);
        setCacheSource(res.data.source || 'database');

        // Initialize default quantity of 1 for available tiers
        const initialQty = {};
        if (res.data.event?.tiers) {
          res.data.event.tiers.forEach((t) => {
            initialQty[t.id] = t.available_quantity > 0 ? 1 : 0;
          });
        }
        setQuantities(initialQty);
      } catch (err) {
        setError(err.message || 'Failed to load event details.');
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [eventId]);

  const handleQuantityChange = (tierId, delta, maxAvailable, maxPerOrder) => {
    setQuantities((prev) => {
      const current = prev[tierId] || 1;
      const next = Math.max(1, Math.min(current + delta, Math.min(maxAvailable, maxPerOrder)));
      return { ...prev, [tierId]: next };
    });
  };

  const handleReserve = async (tier) => {
    setReservingTierId(tier.id);
    setReservationError(null);

    const qty = quantities[tier.id] || 1;

    try {
      const response = await api.createHold(tier.id, qty);
      const hold = response.data.hold;

      // Update context and trigger checkout modal
      setHold(hold);
      if (onOpenCheckout) onOpenCheckout();
    } catch (err) {
      if (err.status === 409) {
        setReservationError(err.data?.error || 'Conflict: Another attendee just reserved these tickets.');
      } else {
        setReservationError(err.data?.error || err.message || 'Failed to place reservation hold.');
      }
    } finally {
      setReservingTierId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading event inventory & tiers...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-heading font-bold text-lg text-white mb-2">Event Not Found</h3>
        <p className="text-xs text-slate-400 mb-6">{error || 'Unable to locate the requested event.'}</p>
        <button onClick={onBack} className="btn-secondary text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Events
        </button>
      </div>
    );
  }

  const isSalesClosed = event.sales_cutoff_date && new Date(event.sales_cutoff_date).getTime() < Date.now();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Back button and cache pill */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </button>

        <span className="badge badge-purple text-[10px] font-mono py-0.5 px-2.5">
          Redis Cache: {cacheSource.toUpperCase()}
        </span>
      </div>

      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0f172a] shadow-2xl">
        <div className="h-64 sm:h-80 w-full relative">
          <img
            src={event.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200'}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent" />
        </div>

        <div className="p-6 sm:p-10 -mt-24 relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-cyan text-xs">{event.category}</span>
            <span className="badge badge-purple text-xs">Organizer: {event.organizer_name}</span>
            {isSalesClosed && (
              <span className="badge badge-rose text-xs">Ticket Sales Ended</span>
            )}
          </div>

          <h1 className="font-heading font-extrabold text-2xl sm:text-4xl text-white tracking-tight">
            {event.title}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
            {event.description}
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-slate-300 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                {new Date(event.start_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{event.venue}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Sales Cut-off:{' '}
                {new Date(event.sales_cutoff_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Error Banner */}
      {reservationError && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{reservationError}</span>
          </div>
          <button
            onClick={() => setReservationError(null)}
            className="text-rose-400 hover:text-white text-xs underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Ticket Tiers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-extrabold text-xl text-white">
              Available Ticket Tiers
            </h2>
            <p className="text-xs text-slate-400">
              Select your tier. Placing a hold locks inventory for 10 minutes to prevent double-booking.
            </p>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <ShieldCheck className="w-4 h-4" />
            ACID Row-Lock Concurrency Guard
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {event.tiers?.map((tier) => {
            const isSoldOut = tier.available_quantity === 0;
            const isLowStock = tier.available_quantity > 0 && tier.available_quantity <= 5;
            const isReserving = reservingTierId === tier.id;
            const currentQty = quantities[tier.id] || 1;

            return (
              <div
                key={tier.id}
                className={`glass-panel p-6 rounded-3xl flex flex-col justify-between transition-all ${
                  isSoldOut
                    ? 'opacity-60 grayscale-[40%]'
                    : isLowStock
                    ? 'border-amber-500/30 hover:border-amber-500/60'
                    : 'hover:border-indigo-500/40'
                }`}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading font-bold text-lg text-white">
                      {tier.name}
                    </h3>

                    {isSoldOut ? (
                      <span className="badge badge-rose text-[10px]">Sold Out</span>
                    ) : isLowStock ? (
                      <span className="badge badge-amber text-[10px] flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        Only {tier.available_quantity} Left!
                      </span>
                    ) : (
                      <span className="badge badge-emerald text-[10px]">Available</span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 min-h-[36px] line-clamp-2">
                    {tier.description || 'Full event admission and privileges.'}
                  </p>

                  {/* Price */}
                  <div className="mt-4 mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="font-heading font-black text-3xl text-white">
                        ${Number(tier.price).toFixed(0)}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">.00 USD</span>
                    </div>
                  </div>

                  {/* Inventory Visual Progress */}
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2 mb-6">
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>Available: <strong className="text-emerald-400">{tier.available_quantity}</strong></span>
                      <span>On 10m Hold: <strong className="text-amber-400">{tier.reserved_quantity}</strong></span>
                      <span>Sold: <strong className="text-slate-300">{tier.sold_quantity}</strong></span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        title="Sold"
                        className="bg-indigo-500 h-full"
                        style={{ width: `${(tier.sold_quantity / tier.total_quantity) * 100}%` }}
                      />
                      <div
                        title="Held"
                        className="bg-amber-400 h-full"
                        style={{ width: `${(tier.reserved_quantity / tier.total_quantity) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions: Quantity and Hold Button */}
                <div className="space-y-3 pt-3 border-t border-white/10">
                  {!isSoldOut && !isSalesClosed && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">Quantity</span>
                      <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(tier.id, -1, tier.available_quantity, tier.max_per_order)}
                          disabled={currentQty <= 1}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:hover:bg-slate-800 flex items-center justify-center font-bold text-sm"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-white font-mono">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(tier.id, 1, tier.available_quantity, tier.max_per_order)}
                          disabled={currentQty >= tier.available_quantity || currentQty >= tier.max_per_order}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:hover:bg-slate-800 flex items-center justify-center font-bold text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    id={`reserve-tier-btn-${tier.id}`}
                    onClick={() => handleReserve(tier)}
                    disabled={isSoldOut || isSalesClosed || isReserving}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      isSoldOut || isSalesClosed
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                  >
                    {isReserving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Acquiring Lock & Reserving...</span>
                      </>
                    ) : isSoldOut ? (
                      <span>Sold Out</span>
                    ) : isSalesClosed ? (
                      <span>Sales Closed</span>
                    ) : (
                      <>
                        <Ticket className="w-4 h-4" />
                        <span>Place 10-Minute Hold (${(tier.price * currentQty).toFixed(0)})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
