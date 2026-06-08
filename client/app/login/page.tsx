"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';

interface Props {
  dark: boolean
  toggleTheme: () => void
}

// THIS IS THE EXACT CODE YOU PROVIDED
function Login({ dark, toggleTheme }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>

      {/* Subtle grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: 0.04,
        backgroundImage: 'linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 38, height: 38, borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: '48px 42px',
        width: '100%',
        maxWidth: 390,
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.12)',
        position: 'relative',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 15,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 24, fontWeight: 900,
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
          }}>M</div>
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 8,
        }}>
          Meeting Management
        </h1>

        <p style={{
          fontSize: 13.5, color: 'var(--text-muted)',
          lineHeight: 1.6, marginBottom: 34,
        }}>
          Sign in with your organisation Google account to continue
        </p>

        {/* Google button */}
        <button
          onClick={() => { window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/google` }}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '13px 20px',
            fontSize: 14, fontWeight: 600,
            color: 'var(--text)',
            cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget
            b.style.borderColor = '#3b82f6'
            b.style.background = 'rgba(59,130,246,0.07)'
          }}
          onMouseLeave={e => {
            const b = e.currentTarget
            b.style.borderColor = 'var(--border)'
            b.style.background = 'var(--bg)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <p style={{
          marginTop: 28, fontSize: 12,
          color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          Access is restricted to authorised users only.<br />
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  )
}

// THIS WRAPPER CONNECTS HER CODE TO OUR NEXT.JS PROJECT
export default function LoginPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    } else {
      setMounted(true);
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    }
  }, [router]);

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  };

  if (!mounted) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .login-wrapper {
          --bg: ${theme === 'dark' ? '#030712' : '#ffffff'};
          --card: ${theme === 'dark' ? '#111827' : '#ffffff'};
          --border: ${theme === 'dark' ? '#1f2937' : '#f3f4f6'};
          --text: ${theme === 'dark' ? '#ffffff' : '#111827'};
          --text-muted: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
        }
      `}} />
      <div className="login-wrapper">
        <Login dark={theme === 'dark'} toggleTheme={toggleTheme} />
      </div>
    </>
  );
}
