"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const publicRoutes = ['/', '/login', '/unauthorized'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      // Allow Google OAuth callback query params on /dashboard
      if (pathname === '/dashboard' && window.location.search.includes('token=')) {
        setIsAuthorized(true);
        return;
      }

      const token = localStorage.getItem('accessToken');
      
      if (!token && !publicRoutes.includes(pathname)) {
        router.push('/login');
      } else {
        setIsAuthorized(true);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Show a loading spinner for protected routes while verifying authentication
  if (!isAuthorized && !publicRoutes.includes(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
