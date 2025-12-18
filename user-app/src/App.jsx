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
import DebugPage from './pages/DebugPage';
import DataInspector from './pages/DataInspector';
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
  const init = useAuthStore((state) => state.init);
  const setTheme = useThemeStore((state) => state.setTheme);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    init();
    setTheme(theme); // Initialize theme on mount
  }, [init, setTheme, theme]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <ScanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <SearchResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/product/:barcode"
          element={
            <ProtectedRoute>
              <ProductDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/price-comparison/:barcode"
          element={
            <ProtectedRoute>
              <PriceComparison />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supermarket/:id"
          element={
            <ProtectedRoute>
              <SupermarketProfile />
            </ProtectedRoute>
          }
        />
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
          path="/feedback"
          element={
            <ProtectedRoute>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/debug"
          element={
            <ProtectedRoute>
              <DebugPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/data-inspector"
          element={
            <ProtectedRoute>
              <DataInspector />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
