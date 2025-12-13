
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
    const [itemsPerPage, setItemsPerPage] = useState(10);

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
            <div>
                <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-panda-text' : 'text-slate-800'}`}>Audit Logs</h1>
                <p className={isDark ? 'text-panda-text-muted' : 'text-slate-600'}>Track all system activities for accountability</p>
            </div>

            {/* Filters */}
            <div className={`p-4 rounded-xl border flex flex-wrap gap-4 ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-panda-text-muted' : 'text-slate-400'}`} />
                    <input
                        type="text"
                        placeholder="Filter by Action (LOGIN, CREATE...)"
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:border-blue-500 focus:outline-none transition ${isDark ? 'bg-panda-dark-200 border-panda-dark-400 text-panda-text' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                        onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                    />
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Filter className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-panda-text-muted' : 'text-slate-400'}`} />
                    <input
                        type="text"
                        placeholder="Filter by Entity (JOB, AUTH...)"
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:border-blue-500 focus:outline-none transition ${isDark ? 'bg-panda-dark-200 border-panda-dark-400 text-panda-text' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`}
                        onChange={(e) => setFilter({ ...filter, entity: e.target.value })}
                    />
                </div>
            </div>

            {/* Table */}
            <div className={`rounded-2xl overflow-hidden border shadow-xl ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className={`border-b ${isDark ? 'bg-panda-dark-200 border-panda-dark-300' : 'bg-slate-50 border-slate-100'}`}>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Time</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>User</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Action</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Entity</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>IP Address</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Details</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-panda-dark-300' : 'divide-slate-100'}`}>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className={`px-6 py-8 text-center ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Loading logs...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className={`px-6 py-8 text-center ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                        <div className="flex flex-col items-center">
                                            <Shield className={`w-12 h-12 mb-2 ${isDark ? 'text-panda-dark-400' : 'text-slate-300'}`} />
                                            <p>No audit records found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((log) => (
                                        <tr key={log.id} className={`transition-colors ${isDark ? 'hover:bg-panda-dark-200/50' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-6 py-4 text-sm whitespace-nowrap ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-medium ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>
                                                {log.username}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold
                                                ${log.action === 'DELETE' ? (isDark ? 'bg-red-900/30 text-red-400 border border-red-900/50' : 'bg-red-50 text-red-700 border border-red-100') :
                                                        log.action === 'CREATE' ? (isDark ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-100') :
                                                            log.action === 'LOGIN' ? (isDark ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' : 'bg-blue-50 text-blue-700 border border-blue-100') :
                                                                (isDark ? 'bg-panda-dark-300 text-panda-text-muted' : 'bg-slate-100 text-slate-600 border border-slate-200')}
                                            `}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>
                                                {log.entity} {log.entity_id ? `#${log.entity_id}` : ''}
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-mono ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                                {log.ip_address}
                                            </td>
                                            <td className={`px-6 py-4 text-sm max-w-xs truncate ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`} title={log.details}>
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
                    <Pagination
                        currentPage={currentPage}
                        totalItems={logs.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                )}
            </div>
        </div>
    );
}

export default AuditLogs;
