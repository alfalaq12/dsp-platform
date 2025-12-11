
import { useState, useEffect } from 'react';
import { Shield, Search, Filter, AlertCircle } from 'lucide-react';
import { getAuditLogs } from '../services/api';

function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ action: '', entity: '' });

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
                <h1 className="text-3xl font-bold text-panda-text mb-2">Audit Logs</h1>
                <p className="text-panda-text-muted">Track all system activities for accountability</p>
            </div>

            {/* Filters */}
            <div className="bg-panda-dark-100 p-4 rounded-xl border border-panda-dark-300 flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-panda-text-muted" />
                    <input
                        type="text"
                        placeholder="Filter by Action (LOGIN, CREATE...)"
                        className="w-full pl-10 pr-4 py-2 bg-panda-dark-200 border border-panda-dark-400 rounded-lg text-panda-text focus:border-panda-gold focus:outline-none"
                        onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                    />
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-panda-text-muted" />
                    <input
                        type="text"
                        placeholder="Filter by Entity (JOB, AUTH...)"
                        className="w-full pl-10 pr-4 py-2 bg-panda-dark-200 border border-panda-dark-400 rounded-lg text-panda-text focus:border-panda-gold focus:outline-none"
                        onChange={(e) => setFilter({ ...filter, entity: e.target.value })}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-panda-dark-200 border-b border-panda-dark-300">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-panda-text-muted uppercase tracking-wider">Time</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-panda-text-muted uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-panda-text-muted uppercase tracking-wider">Action</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-panda-text-muted uppercase tracking-wider">Entity</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-panda-text-muted uppercase tracking-wider">IP Address</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-panda-text-muted uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-panda-dark-300">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-panda-text-muted">Loading logs...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-panda-text-muted">
                                        <div className="flex flex-col items-center">
                                            <Shield className="w-12 h-12 text-panda-dark-400 mb-2" />
                                            <p>No audit records found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-panda-dark-200/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-panda-text-muted whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-panda-text">
                                            {log.username}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold
                                                ${log.action === 'DELETE' ? 'bg-red-900/30 text-red-400 border border-red-900/50' :
                                                    log.action === 'CREATE' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' :
                                                        log.action === 'LOGIN' ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50' :
                                                            'bg-panda-dark-300 text-panda-text-muted'}
                                            `}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-panda-text-muted">
                                            {log.entity} {log.entity_id ? `#${log.entity_id}` : ''}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-panda-text-muted font-mono">
                                            {log.ip_address}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-panda-text-muted max-w-xs truncate" title={log.details}>
                                            {log.details || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default AuditLogs;
