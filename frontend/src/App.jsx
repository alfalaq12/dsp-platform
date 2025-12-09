import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schema from './pages/Schema';
import Network from './pages/Network';
import Jobs from './pages/Jobs';
import Settings from './pages/Settings';
import MainLayout from './components/Layout/MainLayout';
import useSessionTimeout from './hooks/useSessionTimeout';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    // Use session timeout hook (30 minutes = 1800000ms)
    useSessionTimeout(30 * 60 * 1000);

    return token ? children : <Navigate to="/login" />;
};

function App() {
    return (
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
                    <Route path="jobs" element={<Jobs />} />
                    <Route path="settings" element={<Settings />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
