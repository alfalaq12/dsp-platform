import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../config/routes';

const TabContext = createContext();

export const useTabs = () => useContext(TabContext);

export const TabProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Initialize tabs from localStorage or default to Dashboard
    const [tabs, setTabs] = useState(() => {
        try {
            const savedTabs = localStorage.getItem('dsp_tabs');
            if (savedTabs) {
                return JSON.parse(savedTabs);
            }
        } catch (e) {
            console.error('Failed to parse saved tabs', e);
        }

        // Default tab
        return [{
            path: '/',
            title: 'Dashboard',
            pinned: true,
            isClosable: false
        }];
    });

    const [activeTabPath, setActiveTabPath] = useState(location.pathname);

    // Sync active tab with URL location
    useEffect(() => {
        setActiveTabPath(location.pathname);

        // Auto-add tab if it doesn't exist when navigating (deep linking)
        const existingTab = tabs.find(t => t.path === location.pathname);
        if (!existingTab) {
            const route = routes.find(r => r.path === location.pathname);
            if (route) {
                setTabs(prev => [...prev, {
                    path: route.path,
                    title: route.label,
                    icon: route.icon ? route.icon.name : null, // Store icon name or just rely on route config lookup
                    pinned: route.pinned
                }]);
            }
        }
    }, [location.pathname]);

    // Persist tabs to localStorage
    useEffect(() => {
        localStorage.setItem('dsp_tabs', JSON.stringify(tabs));
    }, [tabs]);

    const openTab = useCallback((path) => {
        navigate(path);
    }, [navigate]);

    const closeTab = useCallback((path, e) => {
        if (e) e.stopPropagation();

        setTabs(prev => {
            const newTabs = prev.filter(t => t.path !== path);

            // If we closed the active tab, navigate to the last remaining tab
            if (path === activeTabPath && newTabs.length > 0) {
                const lastTab = newTabs[newTabs.length - 1];
                navigate(lastTab.path);
            } else if (newTabs.length === 0) {
                navigate('/'); // Fallback to root
            }

            return newTabs;
        });
    }, [activeTabPath, navigate]);

    const closeOtherTabs = useCallback(() => {
        setTabs(prev => prev.filter(t => t.path === activeTabPath || t.pinned));
    }, [activeTabPath]);

    const closeAllTabs = useCallback(() => {
        setTabs(prev => prev.filter(t => t.pinned));
        navigate('/');
    }, [navigate]);

    const value = {
        tabs,
        activeTabPath,
        openTab,
        closeTab,
        closeOtherTabs,
        closeAllTabs
    };

    return (
        <TabContext.Provider value={value}>
            {children}
        </TabContext.Provider>
    );
};
