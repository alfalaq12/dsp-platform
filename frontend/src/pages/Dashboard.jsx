import { useEffect, useState } from 'react';
import { Activity, Database, Network as NetworkIcon, TrendingUp, Clock, Calendar, CheckCircle, AlertTriangle, Play, FileText } from 'lucide-react';
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
    }, []);

    const loadStats = async () => {
        try {
            const [schemasRes, networksRes, jobsRes, auditLogsRes] = await Promise.all([
                getSchemas(),
                getNetworks(),
                getJobs(),
                getAuditLogs({ limit: 5 }) // Fetch recent logs
            ]);

            const activeAgents = networksRes.data.filter((n) => n.status === 'online').length;

            setStats({
                schemas: schemasRes.data.length,
                networks: networksRes.data.length,
                jobs: jobsRes.data.length,
                activeAgents,
            });

            // Process Jobs Activity
            // Process Jobs Activity
            const jobActivities = jobsRes.data.map((job, idx) => {
                let actionText = 'Job terjadwal';
                if (job.status === 'completed') actionText = 'Sinkronisasi selesai';
                else if (job.status === 'running') actionText = 'Sinkronisasi berjalan';
                else if (job.status === 'failed') actionText = 'Sinkronisasi gagal';

                return {
                    id: `job-${idx}`,
                    action: actionText,
                    target: job.name,
                    rawTime: job.last_run ? new Date(job.last_run) : new Date(0), // For sorting
                    time: job.last_run && new Date(job.last_run).getFullYear() > 2000 ? new Date(job.last_run).toLocaleTimeString('id-ID') : '-',
                    status: job.status || 'pending',
                    type: 'job'
                };
            });

            // Process Audit Logs Activity
            const logActivities = (auditLogsRes.data || []).map((log, idx) => ({
                id: `log-${idx}`,
                action: log.action,
                target: log.details || 'System Action',
                rawTime: new Date(log.created_at),
                time: new Date(log.created_at).toLocaleTimeString('id-ID'),
                status: 'completed', // Audit logs are past events
                type: 'log'
            }));

            // Merge and Sort by Time (Newest First)
            const allActivities = [...jobActivities, ...logActivities]
                .sort((a, b) => b.rawTime - a.rawTime)
                .slice(0, 5); // Take top 5

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
        { title: 'Total Schema', value: stats.schemas, icon: Database, color: 'bg-blue-600', lightBg: 'bg-blue-100', darkBg: 'bg-blue-900/30' },
        { title: 'Sumber Data', value: stats.networks, icon: NetworkIcon, color: 'bg-indigo-600', lightBg: 'bg-indigo-100', darkBg: 'bg-indigo-900/30' },
        { title: 'Total Job', value: stats.jobs, icon: TrendingUp, color: 'bg-slate-700', lightBg: 'bg-slate-200', darkBg: 'bg-slate-700/50' },
        { title: 'Agent Online', value: stats.activeAgents, icon: Activity, color: 'bg-emerald-600', lightBg: 'bg-emerald-100', darkBg: 'bg-emerald-900/30' },
    ];

    const systemStatus = [
        { name: 'Server Master', status: 'Aktif', ok: true },
        { name: 'Agent Listener', status: 'Port 447', ok: true },
        { name: 'Database', status: 'Terhubung', ok: true },
    ];

    return (
        <div className="space-y-6">
            {/* Header - Professional Government Style */}
            <div className={`rounded-xl p-6 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {getGreeting()}, <span className="text-blue-600 font-bold">{username}</span>
                        </h1>
                        <div className="flex items-center gap-4 mt-2">
                            <span className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                                <Calendar className="w-4 h-4" />
                                {getIndonesianDate()}
                            </span>
                            <span className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                                <Clock className="w-4 h-4" />
                                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Platform Sinkronisasi Data</p>
                        <p className="text-sm font-medium text-blue-600">v1.0.0</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Professional Design */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <AnimatedList delay={80} className="contents">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className={`rounded-xl p-5 border transition-all ${isDark
                                    ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                    : 'bg-white border-slate-200 hover:border-blue-200 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${isDark ? card.darkBg : card.lightBg}`}>
                                        <Icon className={`w-5 h-5 ${card.color.replace('bg-', 'text-')}`} />
                                    </div>
                                </div>
                                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>{card.title}</p>
                                <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {loading ? '...' : card.value}
                                </p>
                            </div>
                        );
                    })}
                </AnimatedList>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity - Takes 2 columns */}
                <div className={`lg:col-span-2 rounded-xl p-6 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Aktivitas Terakhir
                        </h2>
                        <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-700 font-medium'}`}>
                            Live
                        </span>
                    </div>
                    <div className="space-y-3">
                        <AnimatedList delay={150}>
                            {recentActivity.length > 0 ? recentActivity.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-slate-50 border border-slate-100'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${item.type === 'job'
                                            ? item.status === 'completed'
                                                ? isDark ? 'bg-emerald-900/30' : 'bg-emerald-100'
                                                : isDark ? 'bg-slate-700' : 'bg-slate-200'
                                            : isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                                            }`}>
                                            {item.type === 'job' ? (
                                                item.status === 'completed' ? (
                                                    <CheckCircle className={`w-4 h-4 ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`} />
                                                ) : (
                                                    <Play className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-600'}`} />
                                                )
                                            ) : (
                                                <FileText className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.action}</p>
                                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{item.target}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500 font-medium'}`}>{item.time}</span>
                                </div>
                            )) : (
                                <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Belum ada aktivitas</p>
                                </div>
                            )}
                        </AnimatedList>
                    </div>
                </div>

                {/* System Status */}
                <div className={`rounded-xl p-6 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        Status Sistem
                    </h2>
                    <AnimatedList delay={200}>
                        {systemStatus.map((item) => (
                            <div
                                key={item.name}
                                className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.name}</span>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${item.ok
                                    ? isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                                    : isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-600'
                                    }`}>
                                    {item.status}
                                </span>
                            </div>
                        ))}
                    </AnimatedList>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
