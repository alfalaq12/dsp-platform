import { NavLink } from 'react-router-dom';
import { Database, Network as NetworkIcon, Play, LayoutDashboard, X, Settings, Shield, Users } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

function Sidebar({ isOpen, onClose }) {
    const { isDark } = useTheme();

    const menuItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/schema', label: 'Schema', icon: Database },
        { path: '/network', label: 'Network', icon: NetworkIcon },
        { path: '/jobs', label: 'Jobs', icon: Play },
        { path: '/users', label: 'Users', icon: Users, role: 'admin' }, // Only admin
        { path: '/audit-logs', label: 'Audit Logs', icon: Shield, role: 'admin' }, // Only admin
        { path: '/settings', label: 'Settings', icon: Settings },
    ];

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
                    : 'bg-gov-blue-900 border-r border-gov-blue-800 shadow-xl' // Government Blue Sidebar
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
                                                ? 'bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/30'
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

                <div className={`p-4 ${isDark ? 'border-t border-panda-dark-300' : 'border-t border-gov-blue-800'}`}>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isDark
                        ? 'bg-panda-dark/50 border-panda-dark-300'
                        : 'bg-gov-blue-800 border-gov-blue-700'
                        }`}>
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-400 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span className="text-white font-bold">
                                {localStorage.getItem('username')?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${isDark ? 'text-panda-text' : 'text-white'}`}>
                                {localStorage.getItem('username') || 'User'}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-panda-text-muted' : 'text-blue-200'}`}>
                                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;

