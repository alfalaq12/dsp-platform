import { useState, useEffect, useRef, useCallback } from 'react';
import { logout as apiLogout } from '../services/api';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Custom hook to handle automatic session timeout and logout
 * @param {number} timeout - Timeout duration in milliseconds (default: 30 minutes)
 */
const useSessionTimeout = (timeout = SESSION_TIMEOUT) => {
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  // Logout function
  const logout = useCallback(async () => {
    try {
        await apiLogout();
    } catch (error) {
        console.error('Logout failed:', error);
    }
    localStorage.removeItem('username');
    localStorage.removeItem('lastActivity');
    window.location.href = '/login';
    alert('Your session has expired due to inactivity. Please login again.');
  }, []);

  // Reset timeout on user activity
  const resetTimeout = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Update last activity timestamp
    localStorage.setItem('lastActivity', Date.now().toString());

    // Set warning timeout (5 minutes before logout)
    const warningTime = timeout - 5 * 60 * 1000;
    if (warningTime > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        const shouldContinue = confirm(
          'Your session will expire in 5 minutes due to inactivity. Click OK to continue your session.'
        );
        if (shouldContinue) {
          resetTimeout();
        }
      }, warningTime);
    }

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      logout();
    }, timeout);
  }, [timeout, logout]);

  useEffect(() => {
    // Skip if not authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    // Check if session has already expired
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity, 10);
      if (timeSinceLastActivity > timeout) {
        logout();
        return;
      }
    }

    // Start timeout
    resetTimeout();

    // Activity events that should reset the timeout
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimeout);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimeout);
      });
    };
  }, [resetTimeout, logout, timeout]);

  return { resetTimeout };
};

export default useSessionTimeout;
