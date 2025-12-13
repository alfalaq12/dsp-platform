
import { useState, useEffect } from 'react';
import { Shield, Search, Filter, AlertCircle } from 'lucide-react';
import { getAuditLogs } from '../services/api';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';

function AuditLogs() {
    const { isDark } = useTheme();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ action: '', entity: '' });

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    useEffect(() => {
        fetchLogs();
    }, [filter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filter.action) params.action = filter.action.toUpperCase();
            if (filter.entity) params.entity = filter.entity.toUpperCase();

            const response = await getAuditLogs(params);
            setLogs(response.data.data || []);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Premium Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 border-slate-200/60 shadow-lg'}`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-3xl"></div>

                <div className="relative">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>
                        <Shield className="w-3 h-3" />
                        Security & Compliance
                    </div>
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Audit Logs</h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Track all system activities and security events</p>
                </div>
            </div>

            {/* Filters */}
            <div className={`p-4 rounded-2xl border flex flex-wrap gap-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                        type="text"
                        placeholder="Filter by Action (LOGIN, CREATE...)"
                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                        onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                    />
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Filter className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                        type="text"
                        placeholder="Filter by Entity (JOB, AUTH...)"
                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                        onChange={(e) => setFilter({ ...filter, entity: e.target.value })}
                    />
                </div>
            </div>

            {/* Table */}
            <div className={`rounded-2xl overflow-hidden border shadow-xl ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700/50 bg-slate-800/80' : 'border-slate-50/50 border-slate-200'}`}>
                    <h3 className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Recent Activity</h3>
                    <div className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        {logs.length} Events
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className={isDark ? 'bg-slate-900/50 border-b border-slate-700' : 'bg-slate-50/80 border-b border-slate-200'}>
                            <tr>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Time</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>User</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Action</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Entity</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>IP Address</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Details</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Loading logs...</p>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className={`px-6 py-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <div className="flex flex-col items-center">
                                            <Shield className="w-12 h-12 mb-3 opacity-20" />
                                            <p>No audit records found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((log) => (
                                        <tr key={log.id} className={`transition-all duration-200 ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-6 py-4 text-sm whitespace-nowrap font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                                                {log.username}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold border uppercase tracking-wide
                                                ${log.action === 'DELETE' ? (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100') :
                                                        log.action === 'CREATE' ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100') :
                                                            log.action === 'LOGIN' ? (isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100') :
                                                                (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200')}
                                            `}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                {log.entity} <span className="text-xs opacity-70">{log.entity_id ? `#${log.entity_id}` : ''}</span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {log.ip_address}
                                            </td>
                                            <td className={`px-6 py-4 text-sm max-w-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={log.details}>
                                                {log.details || '-'}
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {logs.length > 0 && (
                    <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={logs.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default AuditLogs;
