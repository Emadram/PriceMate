import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAdminAuthStore from './stores/adminAuthStore';
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Categories = lazy(() => import('./pages/Categories'));
const Products = lazy(() => import('./pages/Products'));
const Supermarkets = lazy(() => import('./pages/Supermarkets'));
const Prices = lazy(() => import('./pages/Prices'));
const PriceHistory = lazy(() => import('./pages/PriceHistory'));
const Feedback = lazy(() => import('./pages/Feedback'));
const Announcements = lazy(() => import('./pages/Announcements'));
const ChatHistory = lazy(() => import('./pages/ChatHistory'));
const UserChatSessions = lazy(() => import('./pages/UserChatSessions'));
const UserChatDetail = lazy(() => import('./pages/UserChatDetail'));

const ProtectedRoute = ({ children }) => {
  const admin = useAdminAuthStore((state) => state.admin);
  const loading = useAdminAuthStore((state) => state.loading);
  const error = useAdminAuthStore((state) => state.error);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600"></div>
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
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
          </div>
        }
      >
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
      </Suspense>
    </Router>
  );
}

export default App;
