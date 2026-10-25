import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Ticket,
  Calendar,
  BarChart3,
  ShieldAlert,
  Flame,
  FileCode,
  UserCheck,
  ChevronDown,
  LogOut,
  Sparkles,
  Zap
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { currentUser, demoAccounts, switchUser, logout } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Platform Admin', class: 'badge-purple', icon: '👑' };
      case 'ORGANIZER':
        return { label: 'Organizer', class: 'badge-cyan', icon: '💼' };
      default:
        return { label: 'Attendee', class: 'badge-emerald', icon: '🎟️' };
    }
  };

  const badge = currentUser ? getRoleBadge(currentUser.role) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090d16]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer select-none group"
          onClick={() => setActiveTab('events')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[1.5px] shadow-lg shadow-indigo-500/25">
            <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
              <Ticket className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-lg text-white tracking-tight">
                Event<span className="text-indigo-400">Reserve</span>
              </span>
              <span className="badge badge-purple text-[10px] py-0.5 px-2">v2.0 Multi-Tenant</span>
            </div>
            <span className="text-[11px] text-slate-400 block font-mono">
              Atomic Concurrency & Redis Lock Engine
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
          <button
            id="nav-events-btn"
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'events'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Events
          </button>

          <button
            id="nav-tickets-btn"
            onClick={() => setActiveTab('my-tickets')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'my-tickets'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Ticket className="w-4 h-4" />
            My Tickets
          </button>

          {(currentUser?.role === 'ORGANIZER' || currentUser?.role === 'ADMIN') && (
            <button
              id="nav-organizer-btn"
              onClick={() => setActiveTab('organizer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'organizer'
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Organizer Studio
            </button>
          )}

          {currentUser?.role === 'ADMIN' && (
            <button
              id="nav-admin-btn"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Platform Admin
            </button>
          )}

          <button
            id="nav-concurrency-btn"
            onClick={() => setActiveTab('concurrency')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'concurrency'
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Race Condition Arena
          </button>

          <button
            id="nav-docs-btn"
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'docs'
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileCode className="w-4 h-4" />
            ERD & Docs
          </button>
        </nav>

        {/* Right Action: Demo Role Switcher */}
        <div className="relative">
          <button
            id="role-switcher-dropdown"
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-all text-left"
          >
            <span className="text-base">{badge?.icon}</span>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1.5">
                {currentUser?.name || 'Guest User'}
                <span className={`badge ${badge?.class} text-[9px] py-0 px-1.5`}>
                  {currentUser?.role}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                {currentUser?.tenantName ? currentUser.tenantName : currentUser?.email}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {/* Role Switcher Menu */}
          {roleMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0f172a] border border-white/15 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    1-Click Role Switcher
                  </span>
                  <span className="text-[10px] text-indigo-400 font-mono">RBAC Test</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Instantly impersonate any seeded tenant role to verify RBAC & multi-tenancy.
                </p>
              </div>

              <div className="py-1 space-y-1">
                {demoAccounts.map((acc) => {
                  const isCurrent = currentUser?.id === acc.id;
                  const itemBadge = getRoleBadge(acc.role);

                  return (
                    <button
                      key={acc.id}
                      onClick={() => {
                        switchUser(acc);
                        setRoleMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        isCurrent
                          ? 'bg-indigo-600/20 border border-indigo-500/40 text-white font-medium'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{itemBadge.icon}</span>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {acc.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {acc.tenantName || acc.email}
                          </div>
                        </div>
                      </div>
                      <span className={`badge ${itemBadge.class} text-[9px] py-0 px-1.5`}>
                        {acc.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
