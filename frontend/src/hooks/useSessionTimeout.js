import { useState, useEffect, useRef, useCallback } from 'react';
import { logout as apiLogout } from '../services/api';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Custom hook to handle automatic session timeout and logout
 * @param {number} timeout - Timeout duration in milliseconds (default: 30 minutes)
 */
const useSessionTimeout = (timeout = SESSION_TIMEOUT) => {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [isExpiredOpen, setIsExpiredOpen] = useState(false);
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  // Logout function
  const confirmLogout = useCallback(async () => {
    try {
        await apiLogout();
    } catch (error) {
        console.error('Logout failed:', error);
    }
    localStorage.removeItem('username');
    localStorage.removeItem('lastActivity');
    window.location.href = '/login';
  }, []);

  // Continue session
  const remainActive = useCallback(() => {
    setIsWarningOpen(false);
    // Update last activity
    localStorage.setItem('lastActivity', Date.now().toString());
    // Restart timers
    resetTimeout();
  }, []);

  // Reset timeout on user activity
  const resetTimeout = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    // Update last activity timestamp if warning is not open
    // If warning is open, we wait for user action
    if (!isWarningOpen) {
        localStorage.setItem('lastActivity', Date.now().toString());
    }

    // Set warning timeout (5 minutes before logout)
    const warningTime = timeout - 5 * 60 * 1000;
    
    if (warningTime > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        setIsWarningOpen(true);
      }, warningTime);
    }

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      setIsWarningOpen(false); // Close warning if open
      setIsExpiredOpen(true);
    }, timeout);
  }, [timeout, isWarningOpen]);

    // Use ref to access current warning state inside event listeners without re-binding
    const isWarningRef = useRef(isWarningOpen);
    useEffect(() => {
        isWarningRef.current = isWarningOpen;
    }, [isWarningOpen]);

    useEffect(() => {
        // Skip if not authenticated
        const token = localStorage.getItem('username');
        if (!token) return;

        // Check if session has already expired
        const lastActivity = localStorage.getItem('lastActivity');
        if (lastActivity) {
            const timeSinceLastActivity = Date.now() - parseInt(lastActivity, 10);
            if (timeSinceLastActivity > timeout) {
                setIsExpiredOpen(true);
                return;
            }
        }

        // Start timeout
        resetTimeout();

        // Activity handler
        const handleActivity = () => {
            // Only reset timeout if warning is NOT open
            // If warning is open, we require explicit interaction with the modal
            if (!isWarningRef.current) {
                resetTimeout();
            }
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        // Add event listeners (throttled/debounced ideally, but this is simple)
        events.forEach((event) => {
            window.addEventListener(event, handleActivity);
        });

        // Cleanup
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
            events.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [resetTimeout, timeout]); // Dependencies look correct

    return { 
        isWarningOpen, 
        isExpiredOpen, 
        remainActive, 
        confirmLogout 
    };
};

export default useSessionTimeout;
