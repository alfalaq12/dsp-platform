import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './components/Layout/MainLayout';
import useSessionTimeout from './hooks/useSessionTimeout';
import { ConfirmModal } from './components/Toast';
import PageLoader from './components/ui/PageLoader';

// Helper function to add minimum delay to lazy loading (3 seconds)
const lazyWithDelay = (importFunc, minDelay = 2000) => {
    return lazy(() => {
        return Promise.all([
            importFunc(),
            new Promise(resolve => setTimeout(resolve, minDelay))
        ]).then(([moduleExports]) => moduleExports);
    });
};

// Lazy load all pages with minimum 3 second delay for smooth loading experience
const Login = lazyWithDelay(() => import('./pages/Login'));
const Dashboard = lazyWithDelay(() => import('./pages/Dashboard'));
const Schema = lazyWithDelay(() => import('./pages/Schema'));
const Network = lazyWithDelay(() => import('./pages/Network'));
const Jobs = lazyWithDelay(() => import('./pages/Jobs'));
const Users = lazyWithDelay(() => import('./pages/Users'));
const Settings = lazyWithDelay(() => import('./pages/Settings'));
const AuditLogs = lazyWithDelay(() => import('./pages/AuditLogs'));
const TokenManagement = lazyWithDelay(() => import('./pages/TokenManagement'));
const Activation = lazyWithDelay(() => import('./pages/Activation'));
const Terminal = lazyWithDelay(() => import('./pages/Terminal'));
const NotFound = lazyWithDelay(() => import('./pages/NotFound'));

// Create a QueryClient instance with default options
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute default stale time
            gcTime: 5 * 60 * 1000, // 5 minutes cache time (formerly cacheTime)
            retry: 1, // Retry failed requests once
            refetchOnWindowFocus: false, // Don't refetch on window focus
        },
    },
});

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    // Check for username instead of token since token is in HttpOnly cookie
    const isAuthenticated = localStorage.getItem('username');
    // Use session timeout hook (30 minutes = 1800000ms)
    const { isWarningOpen, isExpiredOpen, remainActive, confirmLogout } = useSessionTimeout(30 * 60 * 1000);

    return (
        <>
            {isAuthenticated ? children : <Navigate to="/login" />}

            {/* Session Warning Modal */}
            <ConfirmModal
                isOpen={isWarningOpen}
                title="Sesi Akan Berakhir"
                message="Sesi Anda akan berakhir dalam 5 menit karena tidak ada aktivitas. Apakah Anda ingin tetap login?"
                confirmText="Tetap Login"
                onConfirm={remainActive}
                onClose={confirmLogout}
                variant="warning"
            />

            {/* Session Expired Modal */}
            <ConfirmModal
                isOpen={isExpiredOpen}
                title="Sesi Berakhir"
                message="Sesi Anda telah berakhir karena tidak ada aktivitas. Silakan login kembali."
                confirmText="OK"
                onConfirm={confirmLogout}
                onClose={confirmLogout}
                variant="danger"
                showCancel={false}
            />
        </>
    );
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <BrowserRouter>
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/login" element={<Login />} />

                            <Route path="/" element={
                                <ProtectedRoute>
                                    <MainLayout />
                                </ProtectedRoute>
                            }>
                                <Route index element={<Dashboard />} />
                                <Route path="schema" element={<Schema />} />
                                <Route path="network" element={<Network />} />
                                <Route path="jobs" element={<Jobs />} />
                                <Route path="users" element={<Users />} />
                                <Route path="audit-logs" element={<AuditLogs />} />
                                <Route path="tokens" element={<TokenManagement />} />
                                <Route path="activation" element={<Activation />} />
                                <Route path="terminal" element={<Terminal />} />
                                <Route path="settings" element={<Settings />} />
                            </Route>

                            {/* Catch-all 404 route */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </ThemeProvider>
        </QueryClientProvider>
    );
}

export default App;

