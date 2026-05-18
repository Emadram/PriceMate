import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';
import useThemeStore from './stores/themeStore';
import useFavoritesStore from './stores/favoritesStore';
import useCurrencyStore from './stores/currencyStore';
import { runDiagnostics } from './utils/diagnostics';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

import ScanPage from './pages/ScanPage';
import SearchResults from './pages/SearchResults';
import ProductDetails from './pages/ProductDetails';
import Profile from './pages/Profile';
import Favorites from './pages/Favorites';
import FeedbackPage from './pages/FeedbackPage';
import PriceComparison from './pages/PriceComparison';
import SupermarketProfile from './pages/SupermarketProfile';
import FloatingAIChatLauncher from './components/FloatingAIChatLauncher';

const AUTH_ROUTE_PREFIXES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

const AppShell = ({ children }) => {
  const { pathname } = useLocation();
  const hideAiLauncher = AUTH_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  return (
    <>
      {children}
      {!hideAiLauncher && <FloatingAIChatLauncher />}
    </>
  );
};

const ProtectedRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] dark:bg-black">
        <div className="w-12 h-12 border-4 border-brand-600/20 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Authenticating</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Check if email is verified for protected routes
  if (user && !user.emailVerification) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] dark:bg-black p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-[3rem] p-12 shadow-soft border border-gray-100 dark:border-white/5">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4">Email Not Verified</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium mb-8">
            Please verify your email address to access this feature. Check your inbox for the verification link.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[12px] font-black uppercase tracking-widest"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return children;
};

function App() {
  const checkSession = useAuthStore((state) => state.checkSession);
  const user = useAuthStore((state) => state.user);
  const { syncFavorites, clearFavorites } = useFavoritesStore();
  const setTheme = useThemeStore((state) => state.setTheme);
  const theme = useThemeStore((state) => state.theme);
  const fetchRates = useCurrencyStore((state) => state.fetchRates);

  useEffect(() => {
    checkSession();
    fetchRates(); // Initialize exchange rates on mount
    setTheme(theme); // Initialize theme on mount
    
    // Run system health check in development
    if (import.meta.env.DEV) {
      runDiagnostics();
    }
  }, [checkSession, setTheme, theme, fetchRates]);

  // Sync favorites when user changes
  useEffect(() => {
    if (user) {
      syncFavorites();
    } else {
      clearFavorites();
    }
  }, [user, syncFavorites, clearFavorites]);

  return (
    <Router>
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            borderRadius: '1rem',
            fontSize: '14px',
          },
        }}
      />
      <AppShell>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Public Routes - accessible without login */}
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/product/:barcode" element={<ProductDetails />} />
        <Route path="/price-comparison/:barcode" element={<PriceComparison />} />
        <Route path="/supermarket/:id" element={<SupermarketProfile />} />
        <Route path="/feedback" element={<FeedbackPage />} />

        {/* Protected Routes - require login */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/favorites"
          element={
            <ProtectedRoute>
              <Favorites />
            </ProtectedRoute>
          }
        />
      </Routes>
      </AppShell>
    </Router>
  );
}

export default App;
