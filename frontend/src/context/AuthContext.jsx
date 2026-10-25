import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [activeHold, setActiveHold] = useState(() => {
    try {
      const saved = sessionStorage.getItem('activeHold');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [holdSecondsRemaining, setHoldSecondsRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load demo accounts on initial mount
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await api.getDemoAccounts();
        setDemoAccounts(res.data.accounts || []);

        // Default to Attendee Alice if no user is logged in
        if (!token && res.data.accounts && res.data.accounts.length > 0) {
          const defaultAttendee = res.data.accounts.find((a) => a.role === 'ATTENDEE') || res.data.accounts[0];
          switchUser(defaultAttendee);
        }
      } catch (err) {
        console.warn('Failed to load demo accounts:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAccounts();
  }, []);

  // Fetch current user if token exists
  useEffect(() => {
    if (token) {
      api.getMe()
        .then((res) => {
          setCurrentUser(res.data.user);
        })
        .catch(() => {
          // Token expired or invalid
          logout();
        });
    }
  }, [token]);

  // Active Hold Countdown Timer
  useEffect(() => {
    if (!activeHold || !activeHold.expiresAt) {
      setHoldSecondsRemaining(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.floor((new Date(activeHold.expiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setHoldSecondsRemaining(0);
        setActiveHold((prev) => (prev ? { ...prev, isExpired: true } : null));
      } else {
        setHoldSecondsRemaining(diff);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeHold]);

  const setHold = (holdData) => {
    setActiveHold(holdData);
    if (holdData) {
      sessionStorage.setItem('activeHold', JSON.stringify(holdData));
    } else {
      sessionStorage.removeItem('activeHold');
    }
  };

  const clearHold = () => {
    setActiveHold(null);
    setHoldSecondsRemaining(0);
    sessionStorage.removeItem('activeHold');
  };

  const switchUser = (account) => {
    localStorage.setItem('token', account.token);
    localStorage.setItem('activeUserId', account.id);
    setToken(account.token);
    setCurrentUser({
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      tenantId: account.tenantId,
      tenantName: account.tenantName
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeUserId');
    setToken(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        demoAccounts,
        switchUser,
        logout,
        activeHold,
        setHold,
        clearHold,
        holdSecondsRemaining,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
