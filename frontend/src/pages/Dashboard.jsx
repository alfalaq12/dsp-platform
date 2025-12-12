import { useEffect, useState } from 'react';
import { Activity, Database, Network as NetworkIcon, TrendingUp } from 'lucide-react';
import { getSchemas, getNetworks, getJobs } from '../services/api';
import { AnimatedList } from '../components/ui/AnimatedList';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

function Dashboard() {
    const [stats, setStats] = useState({
        schemas: 0,
        networks: 0,
        jobs: 0,
        activeAgents: 0,
    });
    const [loading, setLoading] = useState(true);

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
        } finally {
            setLoading(false);
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

    const systemStatus = [
        { name: 'Master Server', status: 'Online', icon: '🟢' },
        { name: 'Agent Listener', status: 'Port 447', icon: '🟢' },
        { name: 'Database', status: 'Connected', icon: '🟢' },
    ];

    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-panda-text mb-2">Dashboard</h1>
                <p className="text-sm sm:text-base text-panda-text-muted">Monitor your data synchronization platform</p>
            </div>

            {/* Animated Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnimatedList delay={150} className="contents">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <Card
                                key={card.title}
                                className="hover:border-panda-gold/50 transition-all duration-300 group cursor-pointer"
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`bg-gradient-to-br ${card.gradient} p-3 rounded-xl shadow-lg group-hover:shadow-panda-gold/20 transition-shadow`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <h3 className="text-panda-text-muted text-sm font-medium mb-1">{card.title}</h3>
                                    <p className="text-3xl font-bold text-panda-text">{loading ? '...' : card.value}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </AnimatedList>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button className="w-full justify-start gap-3 h-12">
                            <Database className="w-5 h-5 flex-shrink-0" />
                            Create New Schema
                        </Button>
                        <Button variant="secondary" className="w-full justify-start gap-3 h-12">
                            <NetworkIcon className="w-5 h-5 flex-shrink-0" />
                            Add Network Source
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-3 h-12">
                            <TrendingUp className="w-5 h-5 flex-shrink-0" />
                            Create New Job
                        </Button>
                    </CardContent>
                </Card>

                {/* System Status with Animation */}
                <Card>
                    <CardHeader>
                        <CardTitle>System Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AnimatedList delay={300}>
                            {systemStatus.map((item) => (
                                <div
                                    key={item.name}
                                    className="flex items-center justify-between p-3 bg-panda-dark/50 rounded-xl"
                                >
                                    <span className="text-sm sm:text-base text-panda-text-muted">{item.name}</span>
                                    <span className="flex items-center gap-2 text-sm sm:text-base text-emerald-400">
                                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </AnimatedList>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default Dashboard;

