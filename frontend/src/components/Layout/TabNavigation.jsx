import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, LayoutDashboard, Database, Network as NetworkIcon, Play, Users, Shield, Key, Lock, Terminal, Settings } from 'lucide-react';
import { useTabs } from '../../contexts/TabContext';
import { useTheme } from '../../contexts/ThemeContext';
import { routes } from '../../config/routes';

const TabNavigation = () => {
    const { tabs, activeTabPath, openTab, closeTab } = useTabs();
    const { isDark } = useTheme();
    const scrollRef = useRef(null);

    // Auto-scroll to active tab
    useEffect(() => {
        if (scrollRef.current) {
            const activeElement = scrollRef.current.querySelector('[data-active="true"]');
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeTabPath, tabs]);

    // Helper to get icon component
    const getIcon = (path) => {
        const route = routes.find(r => r.path === path);
        return route ? route.icon : null;
    };

    return (
        <div className={`w-full overflow-x-auto no-scrollbar ${isDark ? 'bg-panda-dark-100/50' : 'bg-slate-50/50'}`}>
            <div ref={scrollRef} className="flex items-end px-2 pt-2 gap-1 min-w-max">
                {tabs.map((tab) => {
                    const isActive = tab.path === activeTabPath;
                    const Icon = getIcon(tab.path) || LayoutDashboard;

                    return (
                        <div
                            key={tab.path}
                            data-active={isActive}
                            onClick={() => openTab(tab.path)}
                            className={`
                                group relative flex items-center gap-2 px-4 py-2.5 rounded-t-xl cursor-pointer transition-all duration-200
                                border-t border-x mb-[-1px] max-w-[200px] min-w-[120px] select-none
                                ${isActive
                                    ? isDark
                                        ? 'bg-panda-dark border-panda-dark-300 text-blue-400 z-10'
                                        : 'bg-white border-slate-200 text-blue-600 z-10'
                                    : isDark
                                        ? 'bg-panda-dark-300 border-transparent text-panda-text-muted hover:bg-panda-dark-100'
                                        : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-100'
                                }
                            `}
                        >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-500' : 'opacity-70'}`} />

                            <span className="text-sm font-medium truncate flex-1">
                                {tab.title}
                            </span>

                            {/* Close Button - Hidden for pinned tabs */}
                            {!tab.pinned && (
                                <button
                                    onClick={(e) => closeTab(tab.path, e)}
                                    className={`
                                        p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
                                        ${isDark ? 'hover:bg-panda-dark-400 text-slate-400 hover:text-red-400' : 'hover:bg-slate-300 text-slate-400 hover:text-red-500'}
                                    `}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* Active Indicator Line with Animation */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TabNavigation;
