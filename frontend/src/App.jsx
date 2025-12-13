import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schema from './pages/Schema';
import Network from './pages/Network';
import Jobs from './pages/Jobs';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import MainLayout from './components/Layout/MainLayout';
import useSessionTimeout from './hooks/useSessionTimeout';

import { ConfirmModal } from './components/Toast';

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
        <ThemeProvider>
            <BrowserRouter>
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
                        <Route path="/jobs" element={<Jobs />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/audit-logs" element={<AuditLogs />} />
                        <Route path="/settings" element={<Settings />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;

