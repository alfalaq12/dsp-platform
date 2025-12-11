import { NavLink } from 'react-router-dom';
import { Database, Network as NetworkIcon, Play, LayoutDashboard, X, Settings, Shield, Users } from 'lucide-react';

function Sidebar({ isOpen, onClose }) {
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
                w-64 bg-panda-dark-100 border-r border-panda-dark-300 flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6 border-b border-panda-dark-300 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-panda-gold">DSP Platform</h1>
                        <p className="text-sm text-panda-text-muted mt-1">Data Sync</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden text-panda-text-muted hover:text-panda-gold transition-colors"
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
                                                ? 'bg-panda-gold text-panda-dark font-semibold shadow-lg shadow-panda-gold/30'
                                                : 'text-panda-text-muted hover:bg-panda-dark-300 hover:text-panda-gold'
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

                <div className="p-4 border-t border-panda-dark-300">
                    <div className="flex items-center gap-3 px-4 py-3 bg-panda-dark/50 rounded-xl border border-panda-dark-300">
                        <div className="w-10 h-10 bg-gradient-to-br from-panda-gold to-panda-gold-light rounded-full flex items-center justify-center shadow-lg shadow-panda-gold/20">
                            <span className="text-panda-dark font-bold">
                                {localStorage.getItem('username')?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-panda-text">
                                {localStorage.getItem('username') || 'User'}
                            </p>
                            <p className="text-xs text-panda-text-muted">
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
