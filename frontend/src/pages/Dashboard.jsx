import { useEffect, useState } from 'react';
import { Activity, Database, Network as NetworkIcon, TrendingUp } from 'lucide-react';
import { getSchemas, getNetworks, getJobs } from '../services/api';

function Dashboard() {
    const [stats, setStats] = useState({
        schemas: 0,
        networks: 0,
        jobs: 0,
        activeAgents: 0,
    });

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const [schemasRes, networksRes, jobsRes] = await Promise.all([
                getSchemas(),
                getNetworks(),
                getJobs(),
            ]);

            const activeAgents = networksRes.data.filter((n) => n.status === 'online').length;

            setStats({
                schemas: schemasRes.data.length,
                networks: networksRes.data.length,
                jobs: jobsRes.data.length,
                activeAgents,
            });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const statCards = [
        {
            title: 'Total Schemas',
            value: stats.schemas,
            icon: Database,
            gradient: 'from-panda-gold to-panda-gold-light',
        },
        {
            title: 'Network Sources',
            value: stats.networks,
            icon: NetworkIcon,
            gradient: 'from-purple-500 to-purple-400',
        },
        {
            title: 'Active Jobs',
            value: stats.jobs,
            icon: TrendingUp,
            gradient: 'from-emerald-500 to-emerald-400',
        },
        {
            title: 'Active Agents',
            value: stats.activeAgents,
            icon: Activity,
            gradient: 'from-orange-500 to-orange-400',
        },
    ];

    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-panda-text mb-2">Dashboard</h1>
                <p className="text-sm sm:text-base text-panda-text-muted">Monitor your data synchronization platform</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.title}
                            className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl p-6 hover:border-panda-gold/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`bg-gradient-to-br ${card.gradient} p-3 rounded-xl shadow-lg group-hover:shadow-panda-gold/20 transition-shadow`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <h3 className="text-panda-text-muted text-sm font-medium mb-1">{card.title}</h3>
                            <p className="text-3xl font-bold text-panda-text">{card.value}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-panda-text mb-4">Quick Actions</h2>
                    <div className="space-y-3">
                        <button className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-panda-gold to-panda-gold-light hover:from-panda-gold-light hover:to-panda-gold text-panda-dark font-semibold rounded-xl transition-all shadow-lg shadow-panda-gold/20 hover:shadow-panda-gold/40 text-sm sm:text-base">
                            <Database className="w-5 h-5 flex-shrink-0" />
                            Create New Schema
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 bg-panda-dark-300 hover:bg-purple-600 text-panda-text hover:text-white rounded-xl transition-all border border-panda-dark-400 hover:border-purple-600 text-sm sm:text-base">
                            <NetworkIcon className="w-5 h-5 flex-shrink-0" />
                            Add Network Source
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 bg-panda-dark-300 hover:bg-emerald-600 text-panda-text hover:text-white rounded-xl transition-all border border-panda-dark-400 hover:border-emerald-600 text-sm sm:text-base">
                            <TrendingUp className="w-5 h-5 flex-shrink-0" />
                            Create New Job
                        </button>
                    </div>
                </div>

                <div className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-panda-text mb-4">System Status</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-panda-dark/50 rounded-xl">
                            <span className="text-sm sm:text-base text-panda-text-muted">Master Server</span>
                            <span className="flex items-center gap-2 text-sm sm:text-base text-emerald-400">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                                Online
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-panda-dark/50 rounded-xl">
                            <span className="text-sm sm:text-base text-panda-text-muted">Agent Listener</span>
                            <span className="flex items-center gap-2 text-sm sm:text-base text-emerald-400">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                                Port 447
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-panda-dark/50 rounded-xl">
                            <span className="text-sm sm:text-base text-panda-text-muted">Database</span>
                            <span className="flex items-center gap-2 text-sm sm:text-base text-emerald-400">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                                Connected
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
