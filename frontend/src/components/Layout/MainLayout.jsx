import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { LogOut, Menu, Sun, Moon, Bell, ChevronDown, Settings, Home, ChevronRight, Database, Network as NetworkIcon, Play, Key, Terminal, Users, Shield, LayoutDashboard, Lock, AlertTriangle } from 'lucide-react';
import { logout, getNotifications } from '../../services/api';
import Sidebar from './Sidebar';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimatedList } from '../ui/AnimatedList';
import { TabProvider, useTabs } from '../../contexts/TabContext'; // Import TabContext
import TabNavigation from './TabNavigation'; // Import TabNavigation
import { routes } from '../../config/routes'; // Import Routes

// Mobile Menu Component for dropdown
function MobileMenu({ isDark, onClose }) {
    const userRole = localStorage.getItem('role') || 'viewer';
    // Use routes config for consistency
    const menuItems = routes.filter(r => !r.hidden && (!r.role || r.role === userRole));

    return (
        <nav className="p-2">
            <ul className="space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                end={item.exact}
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

// Internal Layout Logic that needs access to TabContext
const MainLayoutContent = () => {
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
    const initialLoadDone = useRef(false);

    // Get Tab Context
    const { tabs, activeTabPath } = useTabs();

    const username = localStorage.getItem('username') || 'User';
    const userRole = localStorage.getItem('userRole') || 'Administrator';
    const userInitials = username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
    const lastSeenNotifIdRef = useRef(0);

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return 'Baru saja';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit lalu`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam lalu`;
        return date.toLocaleDateString('id-ID');
    };

    const fetchNotifications = async () => {
        try {
            const response = await getNotifications();
            const logs = response.data.slice(0, 20);

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
            if (initialLoadDone.current) {
                const newNotifs = mapped.filter(n => n.id > lastSeenNotifIdRef.current);
                setUnreadCount(newNotifs.length);
            } else {
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
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const generateBreadcrumbs = () => {
        const paths = location.pathname.split('/').filter(Boolean);
        const breadcrumbs = [{ name: 'Dashboard', path: '/', icon: Home }];

        // Use routes config for breadcrumb naming
        paths.forEach((path, index) => {
            const fullPath = '/' + paths.slice(0, index + 1).join('/');
            const route = routes.find(r => r.path === fullPath);
            if (route) {
                breadcrumbs.push({
                    name: route.label,
                    path: fullPath,
                    icon: route.icon
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

    const displayedNotifications = showAllNotifs ? notifications : notifications.slice(0, 5);

    return (
        <div className={`flex h-screen ${isDark ? 'bg-panda-dark' : 'bg-slate-100'}`}>
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className={`sticky top-0 z-50 ${isDark ? 'bg-panda-dark-100/95' : 'bg-white/95'} backdrop-blur-md border-b ${isDark ? 'border-panda-dark-300' : 'border-slate-200'} transition-colors duration-200`}>
                    <div className={`flex items-center justify-between px-4 sm:px-8 py-3 ${isDark ? 'border-b border-panda-dark-300' : 'border-b border-slate-100'}`}>
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Mobile Hamburger */}
                            <div className="lg:hidden relative">
                                <button
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                    className={`p-2 rounded-lg transition-all duration-200 ${isDark ? 'text-panda-text-muted hover:text-blue-500 hover:bg-panda-dark-300' : 'text-gov-blue-600 hover:text-gov-blue-800 hover:bg-slate-100'}`}
                                >
                                    <Menu className="w-6 h-6" />
                                </button>
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

                            <div className="hidden md:block">
                                <h2 className={`text-lg font-bold ${isDark ? 'text-panda-text' : 'text-gov-blue-900'}`}>
                                    Centralized Data Sync
                                </h2>
                                <p className={`text-xs ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                    Platform Sinkronisasi Data Terpusat
                                </p>
                            </div>

                            <h2 className={`md:hidden text-lg font-semibold truncate ${isDark ? 'text-panda-text' : 'text-gov-blue-900'}`}>
                                {breadcrumbs[breadcrumbs.length - 1]?.name}
                            </h2>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all duration-200 hover:scale-105 ${isDark ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-yellow-400' : 'bg-slate-100 hover:bg-slate-200 text-gov-blue-600 border border-slate-200'}`}>
                                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                            </button>

                            <div className="relative" ref={notifRef}>
                                <button
                                    onClick={() => {
                                        const willOpen = !isNotifOpen;
                                        setIsNotifOpen(willOpen);
                                        setIsProfileOpen(false);
                                        if (willOpen && notifications.length > 0) {
                                            lastSeenNotifIdRef.current = Math.max(...notifications.map(n => n.id));
                                            setUnreadCount(0);
                                        }
                                        if (!willOpen) setShowAllNotifs(false);
                                    }}
                                    className={`relative p-2 rounded-xl transition-all duration-200 hover:scale-105 ${isDark ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-panda-text-muted' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'} ${isNotifOpen ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                                {isNotifOpen && (
                                    <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200'}`}>
                                        <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-panda-dark-300 bg-panda-dark-200' : 'border-slate-200 bg-slate-50'}`}>
                                            <h3 className={`font-bold ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>Notifikasi</h3>
                                            {notifications.length > 0 && <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{notifications.length} total</span>}
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
                                                        className={`w-full px-4 py-3 text-left transition-all border-b ${!notif.read ? (isDark ? 'bg-blue-500/5' : 'bg-blue-50/50') : ''} ${isDark ? 'border-panda-dark-300 hover:bg-panda-dark-300' : 'border-slate-100 hover:bg-slate-50'}`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.status === 'completed' ? 'bg-emerald-500' : notif.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`font-semibold text-sm ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{notif.title}</p>
                                                                <p className={`text-xs mt-1 truncate ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>{notif.message}</p>
                                                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>{notif.time}</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        {notifications.length > 5 && (
                                            <div className={`px-4 py-3 border-t ${isDark ? 'border-panda-dark-300 bg-panda-dark-200' : 'border-slate-200 bg-slate-50'}`}>
                                                <button onClick={() => setShowAllNotifs(!showAllNotifs)} className={`text-sm font-medium w-full text-center ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>
                                                    {showAllNotifs ? 'Tampilkan Lebih Sedikit' : `Lihat Semua (${notifications.length})`}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotifOpen(false); }}
                                    className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 ${isDark ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-panda-text-muted' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'} ${isProfileOpen ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">{userInitials}</div>
                                    <div className="hidden sm:block text-left">
                                        <p className={`text-sm font-semibold leading-none ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{username}</p>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>{userRole}</p>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isProfileOpen && (
                                    <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200'}`}>
                                        <div className={`px-4 py-4 border-b ${isDark ? 'border-panda-dark-300 bg-panda-dark-200' : 'border-slate-200 bg-slate-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">{userInitials}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-bold truncate ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{username}</p>
                                                    <p className={`text-xs ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>{userRole}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`border-t ${isDark ? 'border-panda-dark-300' : 'border-slate-200'}`}>
                                            <button onClick={handleLogout} className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                                                <LogOut className="w-4 h-4" />
                                                <span className="text-sm font-semibold">Logout</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation - Moved inside header */}
                    <TabNavigation />
                </header>

                {/* Main Content Area - Renders active tabs */}
                <main className={`flex-1 overflow-auto p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-gradient-to-br from-panda-dark via-panda-dark-50 to-panda-dark' : 'bg-slate-50'}`}>

                    {/* Breadcrumbs - Moved inside Main Content */}
                    <div className="flex items-center gap-2 mb-6">
                        {breadcrumbs.map((crumb, index) => {
                            const Icon = crumb.icon;
                            const isLast = index === breadcrumbs.length - 1;
                            return (
                                <div key={crumb.path} className="flex items-center gap-2">
                                    <button
                                        onClick={() => !isLast && navigate(crumb.path)}
                                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-sm transition-colors ${isLast ? (isDark ? 'text-blue-400 font-semibold' : 'text-blue-600 font-semibold') : (isDark ? 'text-panda-text-muted hover:text-panda-text hover:bg-panda-dark-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')}`}
                                        disabled={isLast}
                                    >
                                        {Icon && <Icon className="w-4 h-4" />}
                                        {crumb.name}
                                    </button>
                                    {!isLast && <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Render ALL open tabs, but hide inactive ones (CSS) */}
                    {tabs.map(tab => {
                        const isActive = tab.path === activeTabPath;
                        const route = routes.find(r => r.path === tab.path);
                        const Component = route ? route.component : null;

                        if (!Component) return null;

                        return (
                            <div
                                key={tab.path}
                                style={{ display: isActive ? 'block' : 'none' }}
                                className="h-full"
                            >
                                <Suspense fallback={
                                    <div className="flex items-center justify-center py-20">
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                }>
                                    <Component />
                                </Suspense>
                            </div>
                        );
                    })}
                </main>
            </div>
        </div>
    );
};

// Main Export - Wraps content providing Context
function MainLayout() {
    return (
        <TabProvider>
            <MainLayoutContent />
        </TabProvider>
    );
}

export default MainLayout;