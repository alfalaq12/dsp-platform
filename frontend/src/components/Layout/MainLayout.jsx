import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { LogOut, Menu, Sun, Moon, Bell, User, ChevronDown, Settings, X, Home, ChevronRight, Database, Network as NetworkIcon, Play, Key, Terminal, Users, Shield, LayoutDashboard } from 'lucide-react';
import { logout, getNotifications } from '../../services/api';
import Sidebar from './Sidebar';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimatedList } from '../ui/AnimatedList';

// Mobile Menu Component for dropdown
function MobileMenu({ isDark, onClose }) {
    const userRole = localStorage.getItem('role') || 'viewer';
    const menuItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/schema', label: 'Schema', icon: Database },
        { path: '/network', label: 'Network', icon: NetworkIcon },
        { path: '/jobs', label: 'Jobs', icon: Play },
        { path: '/tokens', label: 'Agent Tokens', icon: Key },
        { path: '/terminal', label: 'Terminal', icon: Terminal, role: 'admin' },
        { path: '/users', label: 'Users', icon: Users, role: 'admin' },
        { path: '/audit-logs', label: 'Audit Logs', icon: Shield, role: 'admin' },
        { path: '/settings', label: 'Settings', icon: Settings },
    ];

    return (
        <nav className="p-2">
            <ul className="space-y-1">
                {menuItems.filter(item => !item.role || item.role === userRole).map((item) => {
                    const Icon = item.icon;
                    return (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                end
                                onClick={onClose}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                        ? 'bg-blue-500 text-white font-semibold'
                                        : isDark
                                            ? 'text-panda-text-muted hover:bg-panda-dark-300 hover:text-blue-400'
                                            : 'text-blue-100 hover:bg-gov-blue-800 hover:text-white'
                                    }`
                                }
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}



function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showAllNotifs, setShowAllNotifs] = useState(false);
    const { isDark, toggleTheme } = useTheme();
    const profileRef = useRef(null);
    const notifRef = useRef(null);
    const initialLoadDone = useRef(false); // Track if initial load is done

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
                    read: false,
                    status: log.status
                };
            });

            setNotifications(mapped);

            // Only count new notifications AFTER initial load
            if (initialLoadDone.current) {
                const newNotifs = mapped.filter(n => n.id > lastSeenNotifIdRef.current);
                setUnreadCount(newNotifs.length);
            } else {
                // First load - mark current as "seen" baseline, no badge
                if (mapped.length > 0) {
                    lastSeenNotifIdRef.current = Math.max(...mapped.map(n => n.id));
                }
                initialLoadDone.current = true;
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s for better INP
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
            'terminal': { name: 'Terminal Console', icon: null },
            'users': { name: 'User Management', icon: null },
            'audit-logs': { name: 'Audit Logs', icon: null },
            'activation': { name: 'License Activation', icon: null },
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

    // Get displayed notifications based on showAll state
    const displayedNotifications = showAllNotifs ? notifications : notifications.slice(0, 5);

    return (
        <div className={`flex h-screen ${isDark ? 'bg-panda-dark' : 'bg-slate-100'}`}>
            {/* Backdrop for mobile dropdown - transparent, just for click-outside */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header - z-50 to ensure dropdown stays above content */}
                <header className={`relative z-50 ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-sm'} border-b px-4 sm:px-8 py-4`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Mobile: Hamburger Menu with Dropdown */}
                            <div className="lg:hidden relative">
                                <button
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                    className={`p-2 rounded-lg transition-all duration-200 ${isDark ? 'text-panda-text-muted hover:text-blue-500 hover:bg-panda-dark-300' : 'text-gov-blue-600 hover:text-gov-blue-800 hover:bg-slate-100'}`}
                                    aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
                                >
                                    <div className="w-6 h-6 flex flex-col justify-center items-center relative">
                                        <span className={`block absolute h-0.5 w-5 transform transition-all duration-300 ease-in-out bg-current ${isSidebarOpen ? 'rotate-45' : '-translate-y-1.5'}`}></span>
                                        <span className={`block absolute h-0.5 w-5 transform transition-all duration-300 ease-in-out bg-current ${isSidebarOpen ? 'opacity-0 scale-0' : 'opacity-100'}`}></span>
                                        <span className={`block absolute h-0.5 w-5 transform transition-all duration-300 ease-in-out bg-current ${isSidebarOpen ? '-rotate-45' : 'translate-y-1.5'}`}></span>
                                    </div>
                                </button>

                                {/* Dropdown Menu - expands below hamburger */}
                                <div className={`
                                    absolute left-0 top-full mt-2 w-64 rounded-xl shadow-2xl border overflow-hidden
                                    transform transition-all duration-300 ease-out origin-top-left
                                    ${isSidebarOpen
                                        ? 'scale-100 opacity-100 translate-y-0'
                                        : 'scale-95 opacity-0 -translate-y-2 pointer-events-none'
                                    }
                                    ${isDark
                                        ? 'bg-panda-dark-100 border-panda-dark-300'
                                        : 'bg-gov-blue-900 border-gov-blue-800'
                                    }
                                `}>
                                    <MobileMenu isDark={isDark} onClose={() => setIsSidebarOpen(false)} />
                                </div>
                            </div>

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
                                        // Reset showAll when closing
                                        if (!willOpen) {
                                            setShowAllNotifs(false);
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
                                            {notifications.length > 0 && (
                                                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                                    {notifications.length} total
                                                </span>
                                            )}
                                        </div>
                                        <div className="max-h-80 overflow-y-auto custom-scrollbar scroll-smooth">
                                            {displayedNotifications.length === 0 ? (
                                                <div className={`px-4 py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">Tidak ada notifikasi</p>
                                                </div>
                                            ) : (
                                                displayedNotifications.map((notif, index) => (
                                                    <button
                                                        key={notif.id}
                                                        onClick={() => handleNotificationClick(notif)}
                                                        className={`w-full px-4 py-3 text-left transition-all border-b
                                                            ${!notif.read ? (isDark ? 'bg-blue-500/5' : 'bg-blue-50/50') : ''}
                                                            ${isDark ? 'border-panda-dark-300 hover:bg-panda-dark-300' : 'border-slate-100 hover:bg-slate-50'}
                                                        `}
                                                        style={{
                                                            animation: `fadeSlideIn 0.3s ease-out ${index * 0.05}s forwards`,
                                                            opacity: 0,
                                                            transform: 'translateY(-10px)'
                                                        }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.status === 'completed' ? 'bg-emerald-500' : notif.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`font-semibold text-sm ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>
                                                                    {notif.title}
                                                                </p>
                                                                <p className={`text-xs mt-1 truncate ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>
                                                                    {notif.message}
                                                                </p>
                                                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
                                                                    {notif.time}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        {notifications.length > 5 && (
                                            <div className={`px-4 py-3 border-t ${isDark ? 'border-panda-dark-300 bg-panda-dark-200' : 'border-slate-200 bg-slate-50'}`}>
                                                <button
                                                    onClick={() => setShowAllNotifs(!showAllNotifs)}
                                                    className={`text-sm font-medium w-full text-center ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                                                >
                                                    {showAllNotifs ? 'Tampilkan Lebih Sedikit' : `Lihat Semua (${notifications.length})`}
                                                </button>
                                            </div>
                                        )}
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