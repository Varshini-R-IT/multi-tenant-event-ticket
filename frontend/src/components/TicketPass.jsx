import React from 'react';
import { Calendar, MapPin, User, CheckCircle2, QrCode, Download, Printer } from 'lucide-react';

export default function TicketPass({ ticket }) {
  if (!ticket) return null;

  const eventDate = ticket.start_date
    ? new Date(ticket.start_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Upcoming Event';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative w-full max-w-sm rounded-3xl bg-[#0f172a] border border-white/15 shadow-2xl overflow-hidden transition-all hover:scale-[1.01] hover:border-indigo-500/40">
      {/* Top Header Card */}
      <div className="p-6 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-900 relative">
        <div className="flex items-center justify-between">
          <span className="badge badge-purple text-[10px] py-0.5 px-2.5">
            {ticket.tier_name || 'Standard Pass'}
          </span>
          <span className="badge badge-emerald text-[10px] py-0.5 px-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {ticket.status || 'VALID'}
          </span>
        </div>

        <h3 className="font-heading font-extrabold text-lg text-white mt-3 leading-tight line-clamp-2">
          {ticket.event_title || 'Global Conference'}
        </h3>

        <div className="mt-4 space-y-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">{eventDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">{ticket.venue || 'Virtual Main Hall'}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate font-medium text-white">{ticket.attendee_name || 'Attendee'}</span>
          </div>
        </div>
      </div>

      {/* Ticket Perforation / Notch Cutouts */}
      <div className="relative h-6 bg-[#0f172a] flex items-center justify-between">
        {/* Left Cutout Circle */}
        <div className="w-6 h-6 rounded-full bg-[#07090e] -ml-3 border-r border-white/10" />
        {/* Dashed Tear Line */}
        <div className="w-full border-b-2 border-dashed border-white/15 mx-2" />
        {/* Right Cutout Circle */}
        <div className="w-6 h-6 rounded-full bg-[#07090e] -mr-3 border-l border-white/10" />
      </div>

      {/* Bottom Stub: QR Code & Serial */}
      <div className="p-6 pt-2 bg-slate-950/60 text-center space-y-3">
        <div className="flex justify-center">
          {ticket.qr_code ? (
            <div className="p-2 rounded-2xl bg-white shadow-md inline-block">
              <img
                src={ticket.qr_code}
                alt={`QR code for ${ticket.ticket_number}`}
                className="w-36 h-36 object-contain"
              />
            </div>
          ) : (
            <div className="w-36 h-36 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
              <QrCode className="w-12 h-12" />
            </div>
          )}
        </div>

        <div>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
            Ticket Serial Number
          </span>
          <div className="font-mono font-bold text-sm text-indigo-300 tracking-wider">
            {ticket.ticket_number || 'TCK-DEMO-000000'}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            onClick={handlePrint}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Pass
          </button>
        </div>
      </div>
    </div>
  );
}
