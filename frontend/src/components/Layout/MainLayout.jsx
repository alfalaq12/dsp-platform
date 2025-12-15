import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, Sun, Moon, Bell, User, ChevronDown, Settings, X, Home, ChevronRight } from 'lucide-react';
import { logout, getNotifications } from '../../services/api';
import Sidebar from './Sidebar';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimatedList } from '../ui/AnimatedList';


function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { isDark, toggleTheme } = useTheme();
    const profileRef = useRef(null);
    const notifRef = useRef(null);

    const username = localStorage.getItem('username') || 'User';
    const userRole = localStorage.getItem('userRole') || 'Administrator';
    const userInitials = username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Close dropdowns when clicking outside
    // Close dropdowns when clicking outside
    useEffect(() => {
        if (!isProfileOpen) return;

        const handleProfileClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleProfileClickOutside);
        return () => document.removeEventListener('mousedown', handleProfileClickOutside);
    }, [isProfileOpen]);

    useEffect(() => {
        if (!isNotifOpen) return;

        const handleNotifClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
            }
        };

        document.addEventListener('mousedown', handleNotifClickOutside);
        return () => document.removeEventListener('mousedown', handleNotifClickOutside);
    }, [isNotifOpen]);


    const [notifications, setNotifications] = useState([]);
    const lastSeenNotifIdRef = useRef(0); // Track last seen notification ID

    // Format relative time
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Baru saja';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit lalu`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam lalu`;
        return date.toLocaleDateString('id-ID');
    };

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            const response = await getNotifications();
            const logs = response.data.slice(0, 20); // Limit to 20 items for performance

            const mapped = logs.map(log => {
                let title = 'Job Status';
                let message = '';

                if (log.status === 'completed') {
                    title = 'Job Selesai';
                    message = `Job "${log.job?.name}" berhasil diselesaikan`;
                } else if (log.status === 'failed') {
                    title = 'Job Gagal';
                    message = `Job "${log.job?.name}" gagal: ${log.error_message}`;
                } else if (log.status === 'running') {
                    title = 'Job Berjalan';
                    message = `Job "${log.job?.name}" sedang berjalan`;
                }

                return {
                    id: log.id,
                    title,
                    message,
                    time: formatTime(log.created_at),
                    read: false, // Could be handled better in future
                    status: log.status
                };
            });

            setNotifications(mapped);
            // Only count notifications newer than the last seen one
            const newNotifs = mapped.filter(n => n.id > lastSeenNotifIdRef.current);
            setUnreadCount(newNotifs.length);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    // Generate breadcrumbs from current path
    const generateBreadcrumbs = () => {
        const paths = location.pathname.split('/').filter(Boolean);
        const breadcrumbs = [{ name: 'Dashboard', path: '/', icon: Home }];

        const pathMap = {
            'schema': { name: 'Schema Management', icon: null },
            'network': { name: 'Network Management', icon: null },
            'jobs': { name: 'Job Management', icon: null },
            'tokens': { name: 'Agent Tokens', icon: null },
            'users': { name: 'User Management', icon: null },
            'audit-logs': { name: 'Audit Logs', icon: null },
            'settings': { name: 'Settings', icon: Settings },
        };

        paths.forEach((path, index) => {
            const config = pathMap[path];
            if (config) {
                breadcrumbs.push({
                    name: config.name,
                    path: '/' + paths.slice(0, index + 1).join('/'),
                    icon: config.icon
                });
            }
        });

        return breadcrumbs;
    };

    const breadcrumbs = generateBreadcrumbs();

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
    };

    const handleNotificationClick = (notif) => {
        console.log('Notification clicked:', notif);
        setUnreadCount(Math.max(0, unreadCount - 1));
    };

    return (
        <div className={`flex h-screen ${isDark ? 'bg-panda-dark' : 'bg-slate-100'}`}>
            {/* Backdrop for mobile sidebar */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className={`relative ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-sm'} border-b px-4 sm:px-8 py-4 z-30`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Hamburger Menu - Animated */}
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className={`lg:hidden p-2 rounded-lg transition-all duration-200 ${isDark ? 'text-panda-text-muted hover:text-blue-500 hover:bg-panda-dark-300' : 'text-gov-blue-600 hover:text-gov-blue-800 hover:bg-slate-100'}`}
                                aria-label="Open menu"
                            >
                                <Menu className="w-6 h-6" />
                            </button>

                            {/* Title - Hidden on small screens */}
                            <div className="hidden md:block">
                                <h2 className={`text-lg font-bold ${isDark ? 'text-panda-text' : 'text-gov-blue-900'}`}>
                                    Centralized Data Sync
                                </h2>
                                <p className={`text-xs ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                    Platform Sinkronisasi Data Terpusat
                                </p>
                            </div>

                            {/* Mobile: Show current page title */}
                            <h2 className={`md:hidden text-lg font-semibold truncate ${isDark ? 'text-panda-text' : 'text-gov-blue-900'}`}>
                                {breadcrumbs[breadcrumbs.length - 1]?.name}
                            </h2>
                        </div>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className={`p-2 rounded-xl transition-all duration-200 hover:scale-105 ${isDark
                                    ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-yellow-400'
                                    : 'bg-slate-100 hover:bg-slate-200 text-gov-blue-600 border border-slate-200'
                                    }`}
                                aria-label="Toggle theme"
                            >
                                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>

                            {/* Notifications Dropdown */}
                            <div className="relative" ref={notifRef}>
                                <button
                                    onClick={() => {
                                        const willOpen = !isNotifOpen;
                                        setIsNotifOpen(willOpen);
                                        setIsProfileOpen(false);
                                        // Mark all current notifications as seen
                                        if (willOpen && notifications.length > 0) {
                                            lastSeenNotifIdRef.current = Math.max(...notifications.map(n => n.id));
                                            setUnreadCount(0);
                                        }
                                    }}
                                    className={`relative p-2 rounded-xl transition-all duration-200 hover:scale-105 ${isDark
                                        ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-panda-text-muted'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                                        } ${isNotifOpen ? 'ring-2 ring-blue-500' : ''}`}
                                    aria-label="Notifications"
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Notifications Dropdown */}
                                {isNotifOpen && (
                                    <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200'}`}>
                                        <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-panda-dark-300 bg-panda-dark-200' : 'border-slate-200 bg-slate-50'}`}>
                                            <h3 className={`font-bold ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>
                                                Notifikasi
                                            </h3>
                                            {unreadCount > 0 && (
                                                <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                                    {unreadCount} baru
                                                </span>
                                            )}
                                        </div>
                                        <AnimatedList className="max-h-96 overflow-y-auto custom-scrollbar scroll-smooth">
                                            {notifications.map((notif) => (
                                                <button
                                                    key={notif.id}
                                                    onClick={() => handleNotificationClick(notif)}
                                                    className={`w-full px-4 py-3 text-left transition-colors border-b ${!notif.read ? (isDark ? 'bg-blue-500/5' : 'bg-blue-50/50') : ''
                                                        } ${isDark ? 'border-panda-dark-300 hover:bg-panda-dark-300' : 'border-slate-100 hover:bg-slate-50'}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-2 h-2 rounded-full mt-2 ${!notif.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-semibold text-sm ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>
                                                                {notif.title}
                                                            </p>
                                                            <p className={`text-xs mt-1 ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>
                                                                {notif.message}
                                                            </p>
                                                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
                                                                {notif.time}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </AnimatedList>
                                        <div className={`px-4 py-3 border-t ${isDark ? 'border-panda-dark-300 bg-panda-dark-200' : 'border-slate-200 bg-slate-50'}`}>
                                            <button className={`text-sm font-medium w-full text-center ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>
                                                Lihat Semua Notifikasi
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* User Profile Dropdown */}
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => {
                                        setIsProfileOpen(!isProfileOpen);
                                        setIsNotifOpen(false);
                                    }}
                                    className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 ${isDark
                                        ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-panda-text-muted'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                                        } ${isProfileOpen ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                        {userInitials}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className={`text-sm font-semibold leading-none ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>
                                            {username}
                                        </p>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                            {userRole}
                                        </p>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Profile Dropdown */}
                                {isProfileOpen && (
                                    <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200'}`}>
                                        <div className={`px-4 py-4 border-b ${isDark ? 'border-panda-dark-300 bg-panda-dark-200' : 'border-slate-200 bg-slate-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                                    {userInitials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-bold truncate ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>
                                                        {username}
                                                    </p>
                                                    <p className={`text-xs ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>
                                                        {userRole}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>



                                        <div className={`border-t ${isDark ? 'border-panda-dark-300' : 'border-slate-200'}`}>
                                            <button
                                                onClick={handleLogout}
                                                className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span className="text-sm font-semibold">Logout</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Breadcrumbs - Below header on desktop */}
                    <div className="hidden md:flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-panda-dark-300">
                        {breadcrumbs.map((crumb, index) => {
                            const Icon = crumb.icon;
                            const isLast = index === breadcrumbs.length - 1;
                            return (
                                <div key={crumb.path} className="flex items-center gap-2">
                                    <button
                                        onClick={() => !isLast && navigate(crumb.path)}
                                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-sm transition-colors ${isLast
                                            ? isDark ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold'
                                            : isDark ? 'text-panda-text-muted hover:text-panda-text hover:bg-panda-dark-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                            }`}
                                        disabled={isLast}
                                    >
                                        {Icon && <Icon className="w-4 h-4" />}
                                        {crumb.name}
                                    </button>
                                    {!isLast && (
                                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </header>

                {/* Main Content */}
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