import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Lock,
  Sparkles,
  X
} from 'lucide-react';

export default function CheckoutModal({ isOpen, onClose, onPaymentComplete }) {
  const { activeHold, holdSecondsRemaining, clearHold, currentUser } = useAuth();

  const [simulationMode, setSimulationMode] = useState('APPROVE'); // 'APPROVE' | 'REJECT' | 'ASYNC_WEBHOOK'
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardHolder, setCardHolder] = useState(currentUser?.name || 'Alice Johnson');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('888');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  if (!isOpen || !activeHold) return null;

  const isExpired = holdSecondsRemaining <= 0 || activeHold.isExpired;

  const minutes = Math.floor(holdSecondsRemaining / 60);
  const seconds = holdSecondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isExpired) {
      setError('Your 10-minute temporary reservation has expired. Please select tickets again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.processPayment({
        reservationId: activeHold.id,
        cardNumber: cardNumber.replace(/[^0-9]/g, '') || '4242424242424242',
        cardHolder,
        simulationMode
      });

      const resData = response.data;

      if (resData.status === 'SUCCESS') {
        // Trigger celebratory confetti
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        setPaymentResult({
          status: 'SUCCESS',
          order: resData.order,
          tickets: resData.tickets,
          transaction: resData.transaction
        });
        clearHold();
        if (onPaymentComplete) onPaymentComplete(resData);
      } else if (resData.status === 'FAILED') {
        setPaymentResult({
          status: 'FAILED',
          message: resData.message
        });
        clearHold();
      } else if (resData.status === 'PENDING') {
        setPaymentResult({
          status: 'PENDING',
          message: resData.message
        });
      }
    } catch (err) {
      setError(err.data?.error || err.message || 'Payment processing failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e1424] border border-white/15 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                Mock Payment Gateway
              </h3>
              <p className="text-xs text-slate-400">
                Safe checkout simulation with atomic concurrency commit
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content State: Result or Form */}
        {paymentResult ? (
          <div className="py-6 text-center space-y-4">
            {paymentResult.status === 'SUCCESS' && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="font-heading font-extrabold text-xl text-white">
                    Payment Approved & Order Confirmed!
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Order <span className="font-mono text-indigo-400">{paymentResult.order?.orderNumber}</span> has been issued.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-left space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Event:</span>
                    <span className="text-white font-medium">{paymentResult.order?.eventTitle}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Ticket Tier:</span>
                    <span className="text-indigo-300 font-medium">{paymentResult.order?.tierName} x {paymentResult.order?.quantity}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Amount Charged:</span>
                    <span className="text-emerald-400 font-bold font-mono">${Number(paymentResult.order?.totalAmount).toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Digital Passes:</span>
                    <span className="text-white">{paymentResult.tickets?.length} QR Ticket(s) Generated</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      onClose();
                      window.location.hash = '#my-tickets';
                    }}
                    className="btn-primary text-xs w-full py-2.5"
                  >
                    View Digital Tickets & QR Codes
                  </button>
                </div>
              </>
            )}

            {paymentResult.status === 'FAILED' && (
              <>
                <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
                  <XCircle className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-lg text-white">
                    Simulated Payment Declined
                  </h4>
                  <p className="text-xs text-rose-300 mt-1">
                    {paymentResult.message}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-400 text-left">
                  <strong>Atomic Rollback Verified:</strong> The temporary reservation hold was cancelled immediately, and all held seats have returned to the public ticket pool.
                </div>
                <button
                  onClick={onClose}
                  className="btn-secondary text-xs w-full py-2.5 mt-2"
                >
                  Close & Browse Other Tickets
                </button>
              </>
            )}

            {paymentResult.status === 'PENDING' && (
              <>
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center border border-cyan-500/30">
                  <Clock className="w-9 h-9 animate-spin" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-lg text-white">
                    Asynchronous Webhook Processing...
                  </h4>
                  <p className="text-xs text-cyan-300 mt-1">
                    {paymentResult.message}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-400 text-left">
                  Simulating payment provider webhook callback after a 2.5 second network delay.
                </div>
                <button
                  onClick={onClose}
                  className="btn-primary text-xs w-full py-2.5 mt-2"
                >
                  Got It
                </button>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Hold Details Summary Card */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider block">
                  Active Reservation Hold
                </span>
                <div className="font-heading font-bold text-white text-sm mt-0.5">
                  {activeHold.eventTitle || 'Conference'}
                </div>
                <div className="text-xs text-slate-300">
                  {activeHold.tierName} • {activeHold.quantity} Ticket(s)
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 font-mono block">Expires In</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formattedTime}
                </span>
                <div className="font-mono font-bold text-white text-base mt-1">
                  ${Number(activeHold.totalAmount).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Simulation Mode Toggle (Core Requirement) */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Simulate Payment Gateway Outcome
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  id="sim-approve-btn"
                  onClick={() => setSimulationMode('APPROVE')}
                  className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                    simulationMode === 'APPROVE'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                      : 'bg-slate-900/60 border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-emerald-400 mb-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight block">
                    Instant 200 OK & Tickets
                  </span>
                </button>

                <button
                  type="button"
                  id="sim-reject-btn"
                  onClick={() => setSimulationMode('REJECT')}
                  className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                    simulationMode === 'REJECT'
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 shadow-sm'
                      : 'bg-slate-900/60 border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-rose-400 mb-0.5">
                    <XCircle className="w-3.5 h-3.5" />
                    Decline
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight block">
                    Frees up hold seats
                  </span>
                </button>

                <button
                  type="button"
                  id="sim-async-btn"
                  onClick={() => setSimulationMode('ASYNC_WEBHOOK')}
                  className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                    simulationMode === 'ASYNC_WEBHOOK'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm'
                      : 'bg-slate-900/60 border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-cyan-400 mb-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    Async
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight block">
                    3s Webhook Delay
                  </span>
                </button>
              </div>
            </div>

            {/* Mock Card Details */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="form-input text-xs"
                  placeholder="Full Name"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mock Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="form-input text-xs font-mono pr-10"
                    placeholder="4242 4242 4242 4242"
                    required
                  />
                  <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Expires
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="form-input text-xs font-mono"
                    placeholder="MM/YY"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    CVC
                  </label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="form-input text-xs font-mono"
                    placeholder="123"
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="modal-submit-charge-btn"
                disabled={loading || isExpired}
                className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Gateway Transaction...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>
                      Pay ${Number(activeHold.totalAmount).toFixed(2)} USD (Mock Simulation)
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
