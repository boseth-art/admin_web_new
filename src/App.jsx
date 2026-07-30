import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import theme from './theme/theme';

import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import TransactionsPage from './pages/TransactionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';
import LandingPage from './pages/LandingPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AdminManagementPage from './pages/AdminManagementPage';
import SecurityCenterPage from './pages/superadmin/SecurityCenterPage';
import DatabaseInspectorPage from './pages/superadmin/DatabaseInspectorPage';
import BulkOperationsPage from './pages/superadmin/BulkOperationsPage';
import PermissionMatrixPage from './pages/superadmin/PermissionMatrixPage';
import SystemHealthPage from './pages/superadmin/SystemHealthPage';
import AppConfigPage from './pages/superadmin/AppConfigPage';
import ImpersonationPage from './pages/superadmin/ImpersonationPage';
import CompliancePage from './pages/superadmin/CompliancePage';
import SessionTimeoutModal from './components/layout/SessionTimeoutModal';

import { auth, db } from './data/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  startSession,
  touchSession,
  clearSession,
  isSessionValid,
  SESSION_IDLE_TIMEOUT_MS,
} from './security/authSecurity';

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// ─── Session activity events to track ────────────────────────────────────────
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  // showTimeout: true  => show "You are about to be logged out" modal
  const [showTimeout, setShowTimeout] = useState(false);

  // Refs so interval/timeout handlers always read fresh values
  const userRef          = useRef(null);
  const sessionTimerRef  = useRef(null); // polls session validity
  const warningTimerRef  = useRef(null); // countdown before forced logout
  const navigateRef      = useRef(null); // set by inner component

  // ── Secure logout (callable from anywhere) ──────────────────────────────
  const logout = useCallback(async (reason = 'manual') => {
    // Clear all timers
    clearInterval(sessionTimerRef.current);
    clearTimeout(warningTimerRef.current);
    sessionTimerRef.current = null;
    warningTimerRef.current = null;

    clearSession();
    setShowTimeout(false);

    try {
      await signOut(auth);
    } catch (err) {
      console.error('[FinGuard] signOut error:', err);
    }

    setUser(null);
    userRef.current = null;

    // Navigate to login with optional reason query string
    if (navigateRef.current) {
      navigateRef.current(`/login?reason=${reason}`, { replace: true });
    }
  }, []);

  // ── Activity listener — refreshes the session idle timer ───────────────
  const handleActivity = useCallback(() => {
    if (userRef.current) touchSession();
  }, []);

  // ── Session polling — checks validity every 60 s ────────────────────────
  const startSessionWatcher = useCallback(() => {
    clearInterval(sessionTimerRef.current);
    sessionTimerRef.current = setInterval(() => {
      if (!userRef.current) return;

      const { valid, reason } = isSessionValid();
      if (!valid) {
        // Show warning modal 2 min before forced logout
        // (here we already exceeded idle time, so fire immediately)
        setShowTimeout(true);
        clearInterval(sessionTimerRef.current);

        // Auto logout after 2 minutes if user doesn't act
        warningTimerRef.current = setTimeout(() => {
          logout(reason || 'idle');
        }, 2 * 60 * 1000);
      }
    }, 60 * 1000); // check every minute
  }, [logout]);

  // ── Firebase Auth state listener ────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists() && ['admin', 'superadmin'].includes(userDoc.data().role)) {
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userDoc.data().name || 'Admin',
              role: userDoc.data().role,
              ...userDoc.data(),
            };
            setUser(userData);
            userRef.current = userData;

            // Start session tracking
            startSession();
            startSessionWatcher();

            // Attach activity listeners
            ACTIVITY_EVENTS.forEach((evt) =>
              window.addEventListener(evt, handleActivity, { passive: true })
            );
          } else {
            console.warn('[FinGuard] Access denied: user does not have admin or superadmin role.');
            await signOut(auth);
            setUser(null);
            userRef.current = null;
          }
        } catch (err) {
          console.error('[FinGuard] Error verifying admin role:', err);
          await signOut(auth);
          setUser(null);
          userRef.current = null;
        }
      } else {
        setUser(null);
        userRef.current = null;
        clearSession();
        clearInterval(sessionTimerRef.current);
        clearTimeout(warningTimerRef.current);
        ACTIVITY_EVENTS.forEach((evt) =>
          window.removeEventListener(evt, handleActivity)
        );
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearInterval(sessionTimerRef.current);
      clearTimeout(warningTimerRef.current);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
    };
  }, [startSessionWatcher, handleActivity]);

  // ── "Stay logged in" handler from the warning modal ─────────────────────
  const handleStayLoggedIn = useCallback(() => {
    clearTimeout(warningTimerRef.current);
    setShowTimeout(false);
    // Reset session timestamps and restart watcher
    startSession();
    startSessionWatcher();
  }, [startSessionWatcher]);

  return (
    <AuthContext.Provider value={{ user, logout, loading, navigateRef }}>
      {children}
      {showTimeout && (
        <SessionTimeoutModal
          onStay={handleStayLoggedIn}
          onLogout={() => logout('idle')}
        />
      )}
    </AuthContext.Provider>
  );
}

// ─── Protected Route ──────────────────────────────────────────────────────────
/**
 * Guards all admin routes.
 * - While auth state is resolving: shows a loading spinner.
 * - If no user OR user role !== 'admin': redirects to /login.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #070D18 0%, #0D1B2A 100%)',
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // Double-check role even though AuthProvider already verifies it
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ─── Super Admin Route ────────────────────────────────────────────────────
/**
 * Guards routes that are ONLY accessible to superadmin.
 * Regular admins are redirected to /dashboard.
 */
function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #070D18 0%, #0D1B2A 100%)',
        }}
      >
        <CircularProgress sx={{ color: '#F59E0B' }} />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to="/dashboard" replace />;

  return children;
}

// ─── Navigate bridge — injects navigate into AuthContext ref ─────────────────
function NavigateBridge() {
  const { navigateRef } = useAuth();
  const navigate = useNavigate();
  navigateRef.current = navigate;
  return null;
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <NavigateBridge />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard"    element={<DashboardPage />} />
              <Route path="/users"        element={<UsersPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/analytics"    element={<AnalyticsPage />} />
              <Route path="/settings"     element={<SettingsPage />} />
              {/* Super Admin only routes */}
              <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminPage /></SuperAdminRoute>} />
              <Route path="/super-admin/admins" element={<SuperAdminRoute><AdminManagementPage /></SuperAdminRoute>} />
              <Route path="/super-admin/security" element={<SuperAdminRoute><SecurityCenterPage /></SuperAdminRoute>} />
              <Route path="/super-admin/database" element={<SuperAdminRoute><DatabaseInspectorPage /></SuperAdminRoute>} />
              <Route path="/super-admin/bulk" element={<SuperAdminRoute><BulkOperationsPage /></SuperAdminRoute>} />
              <Route path="/super-admin/permissions" element={<SuperAdminRoute><PermissionMatrixPage /></SuperAdminRoute>} />
              <Route path="/super-admin/health" element={<SuperAdminRoute><SystemHealthPage /></SuperAdminRoute>} />
              <Route path="/super-admin/config" element={<SuperAdminRoute><AppConfigPage /></SuperAdminRoute>} />
              <Route path="/super-admin/impersonate" element={<SuperAdminRoute><ImpersonationPage /></SuperAdminRoute>} />
              <Route path="/super-admin/compliance" element={<SuperAdminRoute><CompliancePage /></SuperAdminRoute>} />
            </Route>
            {/* Catch-all → login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
