import { useEffect, useState } from 'react';
import {
    Activity, Database, Network as NetworkIcon, TrendingUp, Clock, Calendar,
    CheckCircle, AlertTriangle, Play, FileText, Zap, Shield, Server,
    ArrowUpRight, ArrowDownRight, RefreshCw, Sparkles
} from 'lucide-react';
import { getSchemas, getNetworks, getJobs, getAuditLogs } from '../services/api';
import { AnimatedList } from '../components/ui/AnimatedList';
import { useTheme } from '../contexts/ThemeContext';

function Dashboard() {
    const { isDark } = useTheme();
    const [stats, setStats] = useState({
        schemas: 0,
        networks: 0,
        jobs: 0,
        activeAgents: 0,
    });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [recentActivity, setRecentActivity] = useState([]);
    const username = localStorage.getItem('username') || 'User';

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000); // Poll every 30s instead of 10s for better INP
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const userRole = localStorage.getItem('role') || 'viewer';

            const [schemasRes, networksRes, jobsRes, auditLogsRes] = await Promise.all([
                getSchemas().catch(err => { console.error('Schemas failed', err); return { data: [] }; }),
                getNetworks().catch(err => { console.error('Networks failed', err); return { data: [] }; }),
                getJobs().catch(err => { console.error('Jobs failed', err); return { data: { data: [], meta: {} } }; }),
                // Only fetch audit logs if user is admin
                userRole === 'admin'
                    ? getAuditLogs({ limit: 10 }).catch(err => { console.error('AuditLogs failed', err); return { data: { data: [] } }; })
                    : Promise.resolve({ data: { data: [] } })
            ]);

            const activeAgents = networksRes.data.filter((n) => n.status === 'online').length;

            // Jobs API returns { data: { data: [...], meta: {...} } }
            const jobsData = Array.isArray(jobsRes.data) ? jobsRes.data : (jobsRes.data?.data || []);

            setStats({
                schemas: schemasRes.data.length,
                networks: networksRes.data.length,
                jobs: jobsData.length,
                activeAgents,
            });

            // Create job activities from jobs that have been run
            const jobActivities = jobsData
                .filter(job => job.last_run && new Date(job.last_run).getFullYear() > 2000)
                .map((job, idx) => {
                    let actionText = 'Job terjadwal';
                    let statusType = 'pending';
                    if (job.status === 'completed') {
                        actionText = 'Sinkronisasi selesai';
                        statusType = 'success';
                    } else if (job.status === 'running') {
                        actionText = 'Sinkronisasi berjalan';
                        statusType = 'running';
                    } else if (job.status === 'failed') {
                        actionText = 'Sinkronisasi gagal';
                        statusType = 'error';
                    }

                    return {
                        id: `job-${job.id || idx}`,
                        action: actionText,
                        target: job.name,
                        rawTime: new Date(job.last_run),
                        time: new Date(job.last_run).toLocaleTimeString('id-ID'),
                        status: job.status || 'pending',
                        statusType,
                        type: 'job'
                    };
                });

            // Parse audit logs - response is { data: { data: [...], total: ... } }
            const auditLogsData = auditLogsRes.data?.data || [];
            const logActivities = auditLogsData.map((log, idx) => {
                // Determine status type based on action
                let statusType = 'info';
                if (log.action === 'LOGIN') statusType = 'success';
                else if (log.action === 'DELETE') statusType = 'error';
                else if (log.action === 'CREATE') statusType = 'success';
                else if (log.action === 'UPDATE') statusType = 'pending';

                return {
                    id: `log-${log.id || idx}`,
                    action: `${log.action} ${log.entity || ''}`.trim(),
                    target: log.details || log.username || 'System Action',
                    rawTime: new Date(log.created_at),
                    time: new Date(log.created_at).toLocaleTimeString('id-ID'),
                    status: 'completed',
                    statusType,
                    type: 'log'
                };
            });

            const allActivities = [...jobActivities, ...logActivities]
                .sort((a, b) => b.rawTime - a.rawTime)
                .slice(0, 6);

            setRecentActivity(allActivities);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour >= 5 && hour < 11) return 'Selamat Pagi';
        if (hour >= 11 && hour < 15) return 'Selamat Siang';
        if (hour >= 15 && hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    const getIndonesianDate = () => {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${days[currentTime.getDay()]}, ${currentTime.getDate()} ${months[currentTime.getMonth()]} ${currentTime.getFullYear()}`;
    };

    const statCards = [
        {
            title: 'Total Schema',
            value: stats.schemas,
            icon: Database,
            gradient: 'from-blue-500 to-cyan-400',
            glowClass: 'glow-blue',
            trend: '+2',
            trendUp: true,
            description: 'Struktur data aktif'
        },
        {
            title: 'Sumber Data',
            value: stats.networks,
            icon: NetworkIcon,
            gradient: 'from-violet-500 to-purple-400',
            glowClass: 'glow-purple',
            trend: '+1',
            trendUp: true,
            description: 'Koneksi terdaftar'
        },
        {
            title: 'Total Job',
            value: stats.jobs,
            icon: TrendingUp,
            gradient: 'from-orange-500 to-amber-400',
            glowClass: 'glow-orange',
            trend: '0',
            trendUp: null,
            description: 'Tugas sinkronisasi'
        },
        {
            title: 'Agent Online',
            value: stats.activeAgents,
            icon: Activity,
            gradient: 'from-emerald-500 to-teal-400',
            glowClass: 'glow-emerald',
            trend: stats.activeAgents > 0 ? '100%' : '0%',
            trendUp: stats.activeAgents > 0,
            description: 'Status koneksi'
        },
    ];

    const systemStatus = [
        { name: 'Server Master', status: 'Aktif', ok: true, icon: Server, health: 100 },
        { name: 'Agent Listener', status: 'Port 447', ok: true, icon: NetworkIcon, health: 100 },
        { name: 'Database', status: 'Terhubung', ok: true, icon: Shield, health: 100 },
    ];

    const getStatusBadge = (statusType) => {
        const badges = {
            success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Selesai' },
            running: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Berjalan' },
            error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Gagal' },
            pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
            info: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Info' },
        };
        return badges[statusType] || badges.info;
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Hero Header with Gradient Mesh */}
            <div className={`relative overflow-hidden rounded-3xl ${isDark ? 'glass-dark' : 'glass'} gradient-mesh`}>
                {/* Floating Orbs */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl floating-orb"></div>
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-cyan-500/15 to-pink-500/15 rounded-full blur-3xl floating-orb-delayed"></div>
                <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-2xl floating-orb-slow"></div>

                <div className="relative p-8 lg:p-10">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex-1">
                            {/* Version Badge */}
                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4 ${isDark ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-500/20' : 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 border border-blue-200'}`}>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Platform Sinkronisasi Data v1.0.0</span>
                            </div>

                            {/* Greeting */}
                            <h1 className={`text-4xl lg:text-5xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {getGreeting()},<br />
                                <span className="text-gradient-mixed">{username}</span>
                            </h1>

                            <p className={`text-base mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Selamat datang di dashboard kontrol sinkronisasi data terpusat.
                            </p>

                            {/* Date & Time Pills */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${isDark ? 'glass border-slate-700/50' : 'bg-white/80 border border-slate-200 shadow-sm'}`}>
                                    <Calendar className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                    <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {getIndonesianDate()}
                                    </span>
                                </div>
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${isDark ? 'glass border-slate-700/50' : 'bg-white/80 border border-slate-200 shadow-sm'}`}>
                                    <Clock className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                    <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                    </span>
                                </div>
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                    <span className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                        Sistem Aktif
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards with Glassmorphism */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <AnimatedList delay={80} className="contents">
                    {statCards.map((card, index) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className={`group relative overflow-hidden rounded-2xl p-6 hover-lift card-shine ${isDark ? 'glass-dark' : 'glass shadow-lg'}`}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                {/* Gradient Border Glow on Hover */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl`}></div>

                                <div className="relative">
                                    {/* Header with Icon */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        {card.trendUp !== null && (
                                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${card.trendUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                                {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                {card.trend}
                                            </div>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {card.title}
                                    </p>

                                    {/* Value with Animation */}
                                    <div className="flex items-baseline gap-2">
                                        <p className={`text-4xl font-bold animate-count ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                            {loading ? (
                                                <span className="inline-block w-14 h-10 skeleton rounded-lg"></span>
                                            ) : (
                                                card.value
                                            )}
                                        </p>
                                    </div>

                                    {/* Description */}
                                    <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                        {card.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </AnimatedList>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity - Timeline Style */}
                <div className={`lg:col-span-2 rounded-2xl overflow-hidden ${isDark ? 'glass-dark' : 'glass shadow-lg'}`}>
                    {/* Header */}
                    <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                                    <Activity className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                </div>
                                <div>
                                    <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        Aktivitas Terakhir
                                    </h2>
                                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                        Monitor sinkronisasi real-time
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    Live
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Timeline */}
                    <div className="p-6">
                        <AnimatedList delay={150}>
                            {recentActivity.length > 0 ? recentActivity.map((item, index) => {
                                const badge = getStatusBadge(item.statusType);
                                return (
                                    <div
                                        key={item.id}
                                        className={`timeline-item group flex items-start gap-4 p-4 rounded-xl transition-all duration-200 hover:scale-[1.01] mb-3 ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                                    >
                                        {/* Timeline Dot */}
                                        <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${item.statusType === 'success' ? 'bg-emerald-500/20' : item.statusType === 'error' ? 'bg-red-500/20' : item.statusType === 'running' ? 'bg-blue-500/20' : 'bg-slate-500/20'}`}>
                                            {item.type === 'job' ? (
                                                item.statusType === 'success' ? (
                                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                                ) : item.statusType === 'error' ? (
                                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                                ) : item.statusType === 'running' ? (
                                                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                                                ) : (
                                                    <Play className="w-5 h-5 text-yellow-400" />
                                                )
                                            ) : (
                                                <FileText className="w-5 h-5 text-slate-400" />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                    {item.action}
                                                </p>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            <p className={`text-sm truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                {item.target}
                                            </p>
                                        </div>

                                        {/* Time */}
                                        <span className={`text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                            {item.time}
                                        </span>
                                    </div>
                                );
                            }) : (
                                <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    <div className={`inline-flex p-4 rounded-2xl mb-3 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                                        <FileText className="w-8 h-8 opacity-50" />
                                    </div>
                                    <p className="text-sm font-medium">Belum ada aktivitas</p>
                                    <p className="text-xs mt-1 opacity-70">Aktivitas sinkronisasi akan muncul di sini</p>
                                </div>
                            )}
                        </AnimatedList>
                    </div>
                </div>

                {/* System Status - Health Bars */}
                <div className={`rounded-2xl overflow-hidden ${isDark ? 'glass-dark' : 'glass shadow-lg'}`}>
                    {/* Header */}
                    <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                <Zap className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                            </div>
                            <div>
                                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Status Sistem
                                </h2>
                                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                    Kesehatan infrastruktur
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Status Items */}
                    <div className="p-6 space-y-4">
                        <AnimatedList delay={200}>
                            {systemStatus.map((item) => {
                                const StatusIcon = item.icon;
                                return (
                                    <div
                                        key={item.name}
                                        className={`group p-4 rounded-xl transition-all duration-200 ${isDark ? 'bg-slate-800/30 hover:bg-slate-800/50' : 'bg-slate-50/80 hover:bg-slate-100'}`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.ok ? isDark ? 'bg-emerald-500/20' : 'bg-emerald-100' : isDark ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
                                                    <StatusIcon className={`w-4 h-4 ${item.ok ? isDark ? 'text-emerald-400' : 'text-emerald-600' : isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                        {item.name}
                                                    </p>
                                                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                                        {item.status}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`relative w-3 h-3 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-yellow-500'}`}>
                                                <div className={`absolute inset-0 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-yellow-500'} animate-ping opacity-75`}></div>
                                            </div>
                                        </div>

                                        {/* Health Bar */}
                                        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                            <div
                                                className={`h-full rounded-full progress-animated ${item.ok ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-yellow-500 to-orange-400'}`}
                                                style={{ width: `${item.health}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </AnimatedList>

                        {/* Last Updated */}
                        <div className={`flex items-center justify-center gap-2 pt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            <RefreshCw className="w-3 h-3" />
                            <span className="text-xs">Update setiap 10 detik</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;