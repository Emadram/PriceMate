import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import useThemeStore from './stores/themeStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';

import ScanPage from './pages/ScanPage';
import SearchResults from './pages/SearchResults';
import ProductDetails from './pages/ProductDetails';
import Profile from './pages/Profile';
import Favorites from './pages/Favorites';
import FeedbackPage from './pages/FeedbackPage';
import PriceComparison from './pages/PriceComparison';
import SupermarketProfile from './pages/SupermarketProfile';

const ProtectedRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
};

function App() {
  const checkSession = useAuthStore((state) => state.checkSession);
  const setTheme = useThemeStore((state) => state.setTheme);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    checkSession();
    setTheme(theme); // Initialize theme on mount
  }, [checkSession, setTheme, theme]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
    </Router>
  );
}

export default App;
