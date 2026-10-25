import React from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Clock, AlertTriangle, ShieldCheck, ArrowRight, X } from 'lucide-react';

export default function ReservationHoldBanner({ onOpenCheckout }) {
  const { activeHold, holdSecondsRemaining, clearHold } = useAuth();

  if (!activeHold) return null;

  const isExpired = holdSecondsRemaining <= 0 || activeHold.isExpired;
  const isUrgent = holdSecondsRemaining < 120 && !isExpired;

  const minutes = Math.floor(holdSecondsRemaining / 60);
  const seconds = holdSecondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = Math.min(100, Math.max(0, (holdSecondsRemaining / 600) * 100));

  const handleRelease = async () => {
    try {
      if (activeHold.id) {
        await api.releaseHold(activeHold.id);
      }
    } catch (e) {
      console.warn('Release hold error:', e);
    } finally {
      clearHold();
    }
  };

  return (
    <div
      className={`w-full border-b transition-all duration-300 z-30 ${
        isExpired
          ? 'bg-rose-950/80 border-rose-500/30'
          : isUrgent
          ? 'bg-amber-950/80 border-amber-500/40 pulse-urgent'
          : 'bg-indigo-950/80 border-indigo-500/30 pulse-timer'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Info */}
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isExpired
                  ? 'bg-rose-500/20 text-rose-400'
                  : isUrgent
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-indigo-500/20 text-indigo-300'
              }`}
            >
              {isExpired ? (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm text-white">
                  {isExpired ? 'Reservation Hold Expired' : '10-Minute Temporary Hold Active'}
                </span>
                <span
                  className={`badge ${
                    isExpired ? 'badge-rose' : isUrgent ? 'badge-amber' : 'badge-purple'
                  } text-[10px] py-0 px-2`}
                >
                  {activeHold.tierName || 'Tier Pass'} x {activeHold.quantity}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isExpired
                  ? 'Your reservation window elapsed. Seats were automatically returned to the public pool.'
                  : `Seats reserved for "${activeHold.eventTitle || 'Event'}". Total: $${Number(activeHold.totalAmount).toFixed(2)}`}
              </p>
            </div>
          </div>

          {/* Right Timer & Actions */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            {!isExpired && (
              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                <div className="text-right">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    Time Remaining
                  </div>
                  <div
                    className={`font-mono font-extrabold text-base leading-none ${
                      isUrgent ? 'text-amber-400 animate-pulse' : 'text-indigo-300'
                    }`}
                  >
                    {formattedTime}
                  </div>
                </div>

                {/* Circular / Line progress preview */}
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-1">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      isUrgent ? 'bg-amber-400' : 'bg-indigo-400'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {!isExpired ? (
                <>
                  <button
                    id="banner-checkout-btn"
                    onClick={onOpenCheckout}
                    className="btn-primary text-xs py-2 px-3.5"
                  >
                    <span>Checkout Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id="banner-release-btn"
                    onClick={handleRelease}
                    title="Release Hold"
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  id="banner-dismiss-btn"
                  onClick={clearHold}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
