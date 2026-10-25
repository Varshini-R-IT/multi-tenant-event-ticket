import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ReservationHoldBanner from './components/ReservationHoldBanner';
import CheckoutModal from './components/CheckoutModal';

import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import MyTicketsPage from './pages/MyTicketsPage';
import OrganizerDashboard from './pages/OrganizerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ConcurrencyArena from './pages/ConcurrencyArena';
import DocumentationPage from './pages/DocumentationPage';

function MainApp() {
  const { activeHold } = useAuth();
  const [activeTab, setActiveTab] = useState('events');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToEvents = () => {
    setSelectedEventId(null);
  };

  const handleOpenCheckout = () => {
    setCheckoutModalOpen(true);
  };

  const handlePaymentComplete = (result) => {
    // When payment succeeds, we can stay or direct them to My Tickets
    setSelectedEventId(null);
    setActiveTab('my-tickets');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedEventId(null);
        }}
      />

      {/* Floating 10-Minute Hold Reservation Banner */}
      <ReservationHoldBanner onOpenCheckout={handleOpenCheckout} />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'events' && (
          <>
            {selectedEventId ? (
              <EventDetailPage
                eventId={selectedEventId}
                onBack={handleBackToEvents}
                onOpenCheckout={handleOpenCheckout}
              />
            ) : (
              <EventsPage onSelectEvent={handleSelectEvent} />
            )}
          </>
        )}

        {activeTab === 'my-tickets' && (
          <MyTicketsPage onBrowseEvents={() => setActiveTab('events')} />
        )}

        {activeTab === 'organizer' && <OrganizerDashboard />}

        {activeTab === 'admin' && <AdminDashboard />}

        {activeTab === 'concurrency' && <ConcurrencyArena />}

        {activeTab === 'docs' && <DocumentationPage />}
      </main>

      {/* Mock Payment Gateway Modal */}
      <CheckoutModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        onPaymentComplete={handlePaymentComplete}
      />

      {/* Sleek Footer */}
      <footer className="border-t border-white/10 bg-[#06080d] py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-white">EventReserve</span>
            <span>•</span>
            <span>Multi-Tenant Architecture</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">100% ACID Concurrency Guard</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => {
                setActiveTab('docs');
                setSelectedEventId(null);
              }}
              className="hover:text-white transition-colors"
            >
              ER Diagram
            </button>
            <button
              onClick={() => {
                setActiveTab('concurrency');
                setSelectedEventId(null);
              }}
              className="hover:text-white transition-colors"
            >
              Race Condition Arena
            </button>
            <a
              href="/postman/Multi-Tenant-Event-Reservation-System.postman_collection.json"
              download
              className="hover:text-white transition-colors"
            >
              Postman JSON
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
