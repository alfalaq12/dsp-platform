import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schema from './pages/Schema';
import Network from './pages/Network';
import Jobs from './pages/Jobs';
import MainLayout from './components/Layout/MainLayout';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
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
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
