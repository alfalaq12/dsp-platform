import { lazy } from 'react';
import {
    LayoutDashboard, Database, Network as NetworkIcon, Play,
    Users, Shield, Key, Lock, Terminal, Settings
} from 'lucide-react';

// Lazy load components
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Schema = lazy(() => import('../pages/Schema'));
const Network = lazy(() => import('../pages/Network'));
const Jobs = lazy(() => import('../pages/Jobs'));
const UsersPage = lazy(() => import('../pages/Users'));
const AuditLogs = lazy(() => import('../pages/AuditLogs'));
const TokenManagement = lazy(() => import('../pages/TokenManagement'));
const Activation = lazy(() => import('../pages/Activation'));
const TerminalPage = lazy(() => import('../pages/Terminal'));
const SettingsPage = lazy(() => import('../pages/Settings'));
const NotFound = lazy(() => import('../pages/NotFound'));

export const routes = [
    {
        path: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        component: Dashboard,
        exact: true,
        pinned: true // Dashboard is always pinned/cant be closed? or just default
    },
    {
        path: '/schema',
        label: 'Schema',
        icon: Database,
        component: Schema
    },
    {
        path: '/network',
        label: 'Network',
        icon: NetworkIcon,
        component: Network
    },
    {
        path: '/jobs',
        label: 'Jobs',
        icon: Play,
        component: Jobs
    },
    {
        path: '/tokens',
        label: 'Agent Tokens',
        icon: Key,
        component: TokenManagement
    },
    {
        path: '/terminal',
        label: 'Terminal',
        icon: Terminal,
        component: TerminalPage,
        role: 'admin'
    },
    {
        path: '/users',
        label: 'Users',
        icon: Users,
        component: UsersPage,
        role: 'admin'
    },
    {
        path: '/audit-logs',
        label: 'Audit Logs',
        icon: Shield,
        component: AuditLogs,
        role: 'admin'
    },
    {
        path: '/activation',
        label: 'Activation',
        icon: Lock,
        component: Activation
    },
    {
        path: '/settings',
        label: 'Settings',
        icon: Settings,
        component: SettingsPage
    },
    {
        path: '*',
        component: NotFound,
        hidden: true
    }
];

export const getRouteByPath = (path) => {
    return routes.find(r => r.path === path) || routes.find(r => r.path === '*');
};
