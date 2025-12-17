import { NavLink } from 'react-router-dom';
import { useState, useEffect, memo } from 'react';
import { Database, Network as NetworkIcon, Play, LayoutDashboard, X, Settings, Shield, Users, Key, Lock, AlertTriangle, Terminal } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getLicenseStatus } from '../../services/api';

function Sidebar({ isOpen, onClose }) {
    const { isDark } = useTheme();
    const [licenseActive, setLicenseActive] = useState(true); // Default true for initial load
    const [daysRemaining, setDaysRemaining] = useState(null);

    // Check license status
    useEffect(() => {
        const checkLicense = async () => {
            try {
                const response = await getLicenseStatus();
                setLicenseActive(response.data.is_active);
                setDaysRemaining(response.data.days_remaining);
                // Store in localStorage for quick access
                localStorage.setItem('license_active', response.data.is_active ? 'true' : 'false');
            } catch (error) {
                console.error('Failed to check license:', error);
                // On error, check localStorage fallback
                const cached = localStorage.getItem('license_active');
                setLicenseActive(cached === 'true');
            }
        };
        checkLicense();
    }, []);

    const fullMenuItems = [
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

    const limitedMenuItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/activation', label: 'Aktivasi License', icon: Lock, highlight: true },
    ];

    const menuItems = licenseActive ? fullMenuItems : limitedMenuItems;
    const userRole = localStorage.getItem('role') || 'viewer';

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                ${isDark
                    ? 'bg-panda-dark-100 border-r border-panda-dark-300'
                    : 'bg-gov-blue-900 border-r border-gov-blue-800 shadow-xl'
                }
            `}>
                <div className={`p-6 flex items-start justify-between ${isDark ? 'border-b border-panda-dark-300' : 'border-b border-gov-blue-800'}`}>
                    <div>
                        <h1 className={`text-2xl font-bold ${isDark ? 'text-blue-500' : 'text-white'}`}>DSP Platform</h1>
                        <p className={`text-sm mt-1 ${isDark ? 'text-panda-text-muted' : 'text-blue-200'}`}>Data Sync</p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`lg:hidden transition-colors ${isDark ? 'text-panda-text-muted hover:text-blue-500' : 'text-blue-200 hover:text-white'}`}
                        aria-label="Close sidebar"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* License Warning Banner */}
                {!licenseActive && (
                    <div className={`mx-4 mt-4 px-3 py-2 rounded-lg flex items-center gap-2 text-xs ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>License tidak aktif</span>
                    </div>
                )}

                {/* License Expiry Warning */}
                {licenseActive && daysRemaining !== null && daysRemaining <= 30 && (
                    <div className={`mx-4 mt-4 px-3 py-2 rounded-lg flex items-center gap-2 text-xs ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>License expires in {daysRemaining} days</span>
                    </div>
                )}

                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {menuItems.filter(item => !item.role || item.role === userRole).map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        end
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                                ? item.highlight
                                                    ? 'bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/30'
                                                    : 'bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/30'
                                                : item.highlight
                                                    ? isDark
                                                        ? 'text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 animate-pulse'
                                                        : 'text-amber-200 hover:bg-amber-500/20 hover:text-white animate-pulse'
                                                    : isDark
                                                        ? 'text-panda-text-muted hover:bg-panda-dark-300 hover:text-blue-500'
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
            </aside>
        </>
    );
}

export default memo(Sidebar);
