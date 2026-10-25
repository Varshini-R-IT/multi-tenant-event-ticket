import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketPass from '../components/TicketPass';
import { Ticket, Loader2, Search, CheckCircle2, XCircle, ShieldCheck, ArrowRight } from 'lucide-react';

export default function MyTicketsPage({ onBrowseEvents }) {
  const { currentUser } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Verification tool state
  const [verifyId, setVerifyId] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function loadTickets() {
      setLoading(true);
      try {
        const res = await api.getMyTickets();
        setTickets(res.data.tickets || []);
      } catch (err) {
        console.error('Failed to load tickets:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, [currentUser]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verifyId.trim()) return;

    setVerifying(true);
    setVerifyResult(null);

    try {
      const res = await api.verifyTicket(verifyId.trim());
      setVerifyResult({ valid: res.data.valid, ticket: res.data.ticket });
    } catch (err) {
      setVerifyResult({ valid: false, error: err.data?.error || 'Ticket not found or invalid' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
            My Digital Passes & Tickets
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Confirmed tickets for <strong className="text-white">{currentUser?.name || 'Attendee'}</strong> with secure QR codes for check-in.
          </p>
        </div>

        <button onClick={onBrowseEvents} className="btn-secondary text-xs">
          Browse More Events
        </button>
      </div>

      {/* Main Tickets Content */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading your digital passes...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
            <Ticket className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg text-white">No Tickets Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              You haven't reserved or purchased any tickets yet under this account.
            </p>
          </div>
          <button onClick={onBrowseEvents} className="btn-primary text-xs w-full py-2.5">
            Explore Events & Buy Pass
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tickets.map((tck) => (
            <TicketPass key={tck.id} ticket={tck} />
          ))}
        </div>
      )}

      {/* Ticket QR Scanner & Check-in Verification Box */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4 max-w-2xl mx-auto border border-white/15">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-white">
              Event Gatekeeper & QR Code Verifier
            </h3>
            <p className="text-xs text-slate-400">
              Test venue admission scanner by verifying any Ticket ID or Serial Number.
            </p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. tck_alice_1 or TCK-AI26-00189"
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value)}
            className="form-input text-xs font-mono"
            required
          />
          <button
            type="submit"
            disabled={verifying}
            className="btn-primary text-xs py-2 px-4 whitespace-nowrap"
          >
            {verifying ? 'Scanning...' : 'Verify Pass'}
          </button>
        </form>

        {verifyResult && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              verifyResult.valid
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
            }`}
          >
            {verifyResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}

            <div>
              <div className="font-bold text-sm">
                {verifyResult.valid ? 'VALID TICKET - ADMISSION GRANTED' : 'INVALID / UNRECOGNIZED PASS'}
              </div>
              {verifyResult.valid && verifyResult.ticket && (
                <div className="mt-1 space-y-0.5 text-slate-300">
                  <div>Attendee: <strong className="text-white">{verifyResult.ticket.attendee_name}</strong></div>
                  <div>Event: <strong className="text-white">{verifyResult.ticket.event_title}</strong></div>
                  <div>Tier: <strong className="text-indigo-300">{verifyResult.ticket.tier_name}</strong></div>
                  <div>Serial: <span className="font-mono">{verifyResult.ticket.ticket_number}</span></div>
                </div>
              )}
              {verifyResult.error && <p className="mt-1">{verifyResult.error}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
