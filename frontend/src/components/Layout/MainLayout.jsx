import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Sun, Moon } from 'lucide-react';
import { logout } from '../../services/api';
import Sidebar from './Sidebar';
import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

function MainLayout() {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { isDark, toggleTheme } = useTheme();

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
        localStorage.removeItem('username');
        window.location.href = '/login';
    };

    return (
        <div className={`flex h-screen ${isDark ? 'bg-panda-dark' : 'bg-slate-100'}`}>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className={`${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-sm z-10'} border-b px-4 sm:px-8 py-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className={`lg:hidden ${isDark ? 'text-panda-text-muted hover:text-blue-500' : 'text-gov-blue-600 hover:text-gov-blue-800'} transition-colors`}
                            aria-label="Open menu"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h2 className={`text-lg sm:text-xl font-semibold ${isDark ? 'text-panda-text' : 'text-gov-blue-900 tracking-tight'}`}>
                            Centralized Data Synchronization
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-xl transition-all duration-200 ${isDark
                                ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-yellow-400'
                                : 'bg-slate-100 hover:bg-white text-gov-blue-600 border border-slate-200 shadow-sm'
                                }`}
                            aria-label="Toggle theme"
                        >
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        <button
                            onClick={handleLogout}
                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all duration-200 text-sm sm:text-base border ${isDark
                                ? 'bg-panda-dark-300 hover:bg-red-600 text-panda-text-muted hover:text-white border-panda-dark-400 hover:border-red-600'
                                : 'bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-200 hover:border-red-200 shadow-sm'
                                }`}
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </header>

                <main className={`flex-1 overflow-auto p-4 sm:p-6 lg:p-8 ${isDark
                    ? 'bg-gradient-to-br from-panda-dark via-panda-dark-50 to-panda-dark'
                    : 'bg-slate-50'
                    }`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default MainLayout;

