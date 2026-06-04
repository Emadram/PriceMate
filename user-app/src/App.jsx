import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';
import useThemeStore from './stores/themeStore';
import useFavoritesStore from './stores/favoritesStore';
import useCurrencyStore from './stores/currencyStore';
import { runDiagnostics } from './utils/diagnostics';
import i18n from './lib/i18n';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Home = lazy(() => import('./pages/Home'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const Favorites = lazy(() => import('./pages/Favorites'));
const AIChat = lazy(() => import('./pages/AIChat'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const PriceComparison = lazy(() => import('./pages/PriceComparison'));
const SupermarketProfile = lazy(() => import('./pages/SupermarketProfile'));
const Settings = lazy(() => import('./pages/Settings'));
import FloatingAIChatLauncher from './components/FloatingAIChatLauncher';
import MobileSplashScreen from './components/MobileSplashScreen';
import PageTransition from './components/PageTransition';
import Navbar from './components/Navbar';
import NavigationListener from './components/NavigationListener';
import { startOverflowDetector } from './utils/overflowDetector';
import usePreventBrowserZoom from './hooks/usePreventBrowserZoom';
import { isDesktopViewport } from './utils/platform';

const AUTH_ROUTE_PREFIXES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
const AI_CHAT_ROUTE_PREFIXES = ['/ai-chat'];

const matchesRoutePrefix = (pathname, prefixes) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const AppShell = ({ children }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAuthRoute = matchesRoutePrefix(pathname, AUTH_ROUTE_PREFIXES);
  const isAiChatRoute = matchesRoutePrefix(pathname, AI_CHAT_ROUTE_PREFIXES);
  const hideAiLauncher = isAuthRoute || isAiChatRoute;
  const hideGlobalNav = isAuthRoute;

  useEffect(() => {
    if (typeof window === 'undefined' || isAuthRoute || isAiChatRoute) return undefined;
    if (isDesktopViewport()) return undefined;

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('openAI') !== '1') return undefined;

      params.delete('openAI');
      const qs = params.toString();
      navigate(`/ai-chat${qs ? `?${qs}` : ''}`, { replace: true });
    } catch {
      // ignore
    }
    return undefined;
  }, [pathname, isAuthRoute, isAiChatRoute, navigate]);

  return (
    <>
      {!hideGlobalNav && <Navbar />}
      <div className="overflow-x-hidden pt-safe md:pt-0">
          {children}
      </div>
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
  usePreventBrowserZoom(true);
  const checkSession = useAuthStore((state) => state.checkSession);
  const user = useAuthStore((state) => state.user);
  const { syncFavorites, clearFavorites } = useFavoritesStore();
  const setTheme = useThemeStore((state) => state.setTheme);
  const theme = useThemeStore((state) => state.theme);
  const fetchRates = useCurrencyStore((state) => state.fetchRates);
  const setCurrency = useCurrencyStore((state) => state.setCurrency);
  const currency = useCurrencyStore((state) => state.currency);

  useEffect(() => {
    checkSession();
    fetchRates(); // Initialize exchange rates on mount
    // Ensure default currency is TRY on first load
    if (!currency) {
      setCurrency('TRY');
    }
    if (typeof window !== 'undefined') {
      const storedTheme = window.localStorage.getItem('pricemate-theme');
      if (!storedTheme) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
      }
    }
    
    // Run system health check in development
    if (import.meta.env.DEV) {
      runDiagnostics();
    }
  }, [checkSession, setTheme, fetchRates, currency, setCurrency]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    // Enable by running in console: localStorage.setItem('pricemate_overflow_debug', '1')
    const enabled = typeof window !== 'undefined' && window.localStorage?.getItem('pricemate_overflow_debug') === '1';
    const stop = startOverflowDetector({ enabled });
    return () => stop?.();
  }, []);

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#020617' : '#6d28d9');
    }
  }, [theme]);

  // Sync favorites when user changes
  useEffect(() => {
    if (user) {
      syncFavorites();
    } else {
      clearFavorites();
    }
  }, [user, syncFavorites, clearFavorites]);

  // Hydrate UI preferences from account prefs (mobile/desktop)
  useEffect(() => {
    if (!user?.prefs || typeof user.prefs !== 'object') return;
    const prefs = user.prefs;

    const prefTheme = prefs.uiTheme;
    const prefCurrency = prefs.uiCurrency;
    const prefLang = prefs.uiLanguage;

    if (prefTheme === 'light' || prefTheme === 'dark') {
      setTheme(prefTheme);
    }
    if (typeof prefCurrency === 'string' && prefCurrency.trim()) {
      setCurrency(prefCurrency);
    }
    if (prefLang === 'en' || prefLang === 'tr') {
      i18n.changeLanguage(prefLang);
    }
  }, [user?.$id, user?.prefs, setTheme, setCurrency]);

  return (
    <Router>
      <NavigationListener />
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
      <MobileSplashScreen />
      <Suspense
        fallback={
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-brand-600/20 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        }
      >
      <PageTransition>
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
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-chat"
          element={
            <ProtectedRoute>
              <AIChat />
            </ProtectedRoute>
          }
        />
      </Routes>
      </PageTransition>
      </Suspense>
      </AppShell>
    </Router>
  );
}

export default App;
