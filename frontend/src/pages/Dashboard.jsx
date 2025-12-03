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
            color: 'bg-blue-600',
            bgColor: 'bg-blue-600/10',
            borderColor: 'border-blue-600/50',
        },
        {
            title: 'Network Sources',
            value: stats.networks,
            icon: NetworkIcon,
            color: 'bg-purple-600',
            bgColor: 'bg-purple-600/10',
            borderColor: 'border-purple-600/50',
        },
        {
            title: 'Active Jobs',
            value: stats.jobs,
            icon: TrendingUp,
            color: 'bg-green-600',
            bgColor: 'bg-green-600/10',
            borderColor: 'border-green-600/50',
        },
        {
            title: 'Active Agents',
            value: stats.activeAgents,
            icon: Activity,
            color: 'bg-orange-600',
            bgColor: 'bg-orange-600/10',
            borderColor: 'border-orange-600/50',
        },
    ];

    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Dashboard</h1>
                <p className="text-sm sm:text-base text-slate-400">Monitor your data synchronization platform</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.title}
                            className={`${card.bgColor} border ${card.borderColor} rounded-xl p-6 backdrop-blur-sm`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`${card.color} p-3 rounded-lg`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <h3 className="text-slate-400 text-sm font-medium mb-1">{card.title}</h3>
                            <p className="text-3xl font-bold text-white">{card.value}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">Quick Actions</h2>
                    <div className="space-y-3">
                        <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm sm:text-base">
                            <Database className="w-5 h-5 flex-shrink-0" />
                            Create New Schema
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm sm:text-base">
                            <NetworkIcon className="w-5 h-5 flex-shrink-0" />
                            Add Network Source
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm sm:text-base">
                            <TrendingUp className="w-5 h-5 flex-shrink-0" />
                            Create New Job
                        </button>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">System Status</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm sm:text-base text-slate-400">Master Server</span>
                            <span className="flex items-center gap-2 text-sm sm:text-base text-green-400">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Online
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm sm:text-base text-slate-400">Agent Listener</span>
                            <span className="flex items-center gap-2 text-sm sm:text-base text-green-400">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Port 447
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm sm:text-base text-slate-400">Database</span>
                            <span className="flex items-center gap-2 text-sm sm:text-base text-green-400">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
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
