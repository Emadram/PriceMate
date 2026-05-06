import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAdminAuthStore from './stores/adminAuthStore';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Products from './pages/Products';
import Supermarkets from './pages/Supermarkets';
import Prices from './pages/Prices';
import PriceHistory from './pages/PriceHistory';
import Feedback from './pages/Feedback';
import Announcements from './pages/Announcements';
import ChatHistory from './pages/ChatHistory';
import UserChatSessions from './pages/UserChatSessions';
import UserChatDetail from './pages/UserChatDetail';

const ProtectedRoute = ({ children }) => {
  const admin = useAdminAuthStore((state) => state.admin);
  const loading = useAdminAuthStore((state) => state.loading);
  const error = useAdminAuthStore((state) => state.error);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="text-gray-400 font-medium">Verifying Credentials...</span>
      </div>
    );
  }

  // Redirect to login if no admin session or if there was an access error
  if (!admin || error) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const init = useAdminAuthStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
            borderRadius: '0.5rem',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <Categories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supermarkets"
          element={
            <ProtectedRoute>
              <Supermarkets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prices"
          element={
            <ProtectedRoute>
              <Prices />
            </ProtectedRoute>
          }
        />
        <Route
          path="/price-history"
          element={
            <ProtectedRoute>
              <PriceHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedback"
          element={
            <ProtectedRoute>
              <Feedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <ProtectedRoute>
              <Announcements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-history"
          element={
            <ProtectedRoute>
              <ChatHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-history/:userId/:threadKey"
          element={
            <ProtectedRoute>
              <UserChatDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-history/:userId"
          element={
            <ProtectedRoute>
              <UserChatSessions />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
