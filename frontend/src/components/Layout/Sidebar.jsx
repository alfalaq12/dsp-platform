import { NavLink } from 'react-router-dom';
import { Database, Network as NetworkIcon, Play, LayoutDashboard, X } from 'lucide-react';

function Sidebar({ isOpen, onClose }) {
    const menuItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/schema', label: 'Schema', icon: Database },
        { path: '/network', label: 'Network', icon: NetworkIcon },
        { path: '/jobs', label: 'Jobs', icon: Play },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-64 bg-slate-800 border-r border-slate-700 flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6 border-b border-slate-700 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">DSP Platform</h1>
                        <p className="text-sm text-slate-400 mt-1">Data Sync</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden text-slate-400 hover:text-white transition-colors"
                        aria-label="Close sidebar"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        end
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
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

                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 rounded-lg">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                                {localStorage.getItem('username')?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-white">
                                {localStorage.getItem('username') || 'User'}
                            </p>
                            <p className="text-xs text-slate-400">Administrator</p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
