import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useState } from 'react';

function MainLayout() {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-panda-dark">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-panda-dark-100 border-b border-panda-dark-300 px-4 sm:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden text-panda-text-muted hover:text-panda-gold transition-colors"
                            aria-label="Open menu"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h2 className="text-lg sm:text-xl font-semibold text-panda-text">
                            Centralized Data Synchronization
                        </h2>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-panda-dark-300 hover:bg-red-600 text-panda-text-muted hover:text-white rounded-xl transition-all duration-200 text-sm sm:text-base border border-panda-dark-400 hover:border-red-600"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </header>

                <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-panda-dark via-panda-dark-50 to-panda-dark">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default MainLayout;
