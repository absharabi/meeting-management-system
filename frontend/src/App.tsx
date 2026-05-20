import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Unauthorized from './pages/Unauthorized';

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggleTheme = () => setDark((prev) => !prev);
  const isAuthenticated = () => !!localStorage.getItem('token');

  return (
    <Router>
      <Routes>
        {/* Public Login Route (Redirects to dashboard if already authenticated) */}
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login dark={dark} toggleTheme={toggleTheme} />
            )
          }
        />

        {/* OAuth Callback Redirect Page */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Access Restriction Notice Page */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected Dashboard Route */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated() ? (
              <Dashboard dark={dark} toggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}