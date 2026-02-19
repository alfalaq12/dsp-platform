import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { Activity, TrendingUp, AlertCircle, Calendar } from 'lucide-react';

const AnalyticsCharts = ({ data, isLoading, timeRange, onRangeChange }) => {
    const { isDark } = useTheme();

    const ranges = [
        { label: '5 Menit', value: '5m' },
        { label: '1 Jam', value: '1h' },
        { label: '24 Jam', value: '24h' },
        { label: '7 Hari', value: '7d' },
        { label: '30 Hari', value: '30d' },
        { label: '3 Bulan', value: '3m' },
    ];

    if (isLoading) {
        return (
            <div className={`rounded-2xl border p-6 h-96 flex items-center justify-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className={`rounded-2xl border p-6 h-96 flex items-center justify-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="text-center">
                    <Activity className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>No analytics data available for this range</p>
                    {onRangeChange && (
                        <div className="mt-4 flex gap-2 justify-center">
                            {ranges.map((range) => (
                                <button
                                    key={range.value}
                                    onClick={() => onRangeChange(range.value)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${timeRange === range.value
                                        ? 'bg-blue-500 text-white'
                                        : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? 'border-slate-700 bg-slate-900/30' : 'border-slate-100 bg-slate-50/50'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Performa Job</h3>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tren Eksekusi Sinkronisasi</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <div className={`p-1 rounded-xl flex gap-1 ${isDark ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-100/50 border border-slate-200'}`}>
                        {ranges.map((range) => (
                            <button
                                key={range.value}
                                onClick={() => onRangeChange && onRangeChange(range.value)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${timeRange === range.value
                                    ? 'bg-blue-500 text-white shadow-sm'
                                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-80 w-full p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke={isDark ? '#94a3b8' : '#64748b'}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                            tickFormatter={(value) => {
                                if (timeRange === '5m' || timeRange === '1h') {
                                    return value; // Already HH:MM
                                } else if (timeRange === '24h') {
                                    const date = new Date(value);
                                    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                                } else {
                                    const date = new Date(value);
                                    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                                }
                            }}
                        />
                        <YAxis
                            stroke={isDark ? '#94a3b8' : '#64748b'}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                borderColor: isDark ? '#334155' : '#e2e8f0',
                                borderRadius: '0.75rem',
                                color: isDark ? '#f8fafc' : '#0f172a',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            itemStyle={{ fontSize: '13px' }}
                            labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: '0.25rem', fontSize: '12px' }}
                            labelFormatter={(value) => {
                                if (timeRange === '5m' || timeRange === '1h') {
                                    return `Jam ${value}`;
                                } else if (timeRange === '24h') {
                                    return new Date(value).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
                                } else {
                                    return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                                }
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="success"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorSuccess)"
                            name="Sukses"
                            stackId="1"
                        />
                        <Area
                            type="monotone"
                            dataKey="failed"
                            stroke="#ef4444"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorFailed)"
                            name="Gagal"
                            stackId="1"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AnalyticsCharts;
