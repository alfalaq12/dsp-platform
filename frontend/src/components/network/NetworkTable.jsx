import React, { useState } from 'react';
import {
    Database,
    Server,
    Shield,
    Globe,
    HardDrive,
    Circle,
    Eye,
    Edit,
    Copy,
    Trash2,
    Zap,
    Play,
    ArrowLeftRight,
    Loader2,
    Search,
    ChevronLeft,
    ChevronRight,
    User,
    Plus,
    Monitor
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

// Helper: Generate source connection string
function getSourceAddr(network) {
    const srcType = network.source_type || 'database';
    if (srcType === 'database') {
        const params = [];
        if (network.db_sslmode) params.push(`sslmode=${network.db_sslmode}`);
        const paramStr = params.length > 0 ? `?${params.join('&')}` : '';
        return `{{${network.db_driver || 'postgres'} '${network.db_host || '-'}' '${network.db_port || '5432'}' '${network.db_user || '-'}'${paramStr}}}`;
    }
    if (srcType === 'ftp' || srcType === 'sftp') return `{{${srcType} '${network.ftp_host || '-'}' '${network.ftp_path || '/'}'}}`;
    if (srcType === 'api') return `{{api '${network.api_url || '-'}'}}`;
    return '-';
}

function getTargetAddr(network) {
    const tgtType = network.target_source_type || 'database';
    if (tgtType === 'database') {
        if (!network.target_db_host) return '-';
        const params = [];
        if (network.target_db_sslmode) params.push(`sslmode=${network.target_db_sslmode}`);
        const paramStr = params.length > 0 ? `?${params.join('&')}` : '';
        return `{{${network.target_db_driver || 'postgres'} '${network.target_db_host}' '${network.target_db_port || '5432'}' '${network.target_db_user || '-'}'${paramStr}}}`;
    }
    if (tgtType === 'ftp' || tgtType === 'sftp') {
        if (!network.target_ftp_host) return '-';
        return `{{${tgtType} '${network.target_ftp_host}' '${network.target_ftp_path || '/'}'}}`;
    }
    if (tgtType === 'api') return `{{api '${network.target_api_url || '-'}'}}`;
    return '-';
}

export default function NetworkTable({
    networks,
    currentPage,
    itemsPerPage,
    userRole,
    testingNetwork,
    testingTargetNetwork,
    reversingNetwork,
    cloningNetwork,
    onTestSource,
    onTestTarget,
    onReverse,
    onView,
    onAdd,
    onEdit,
    onClone,
    onDelete
}) {
    const { isDark } = useTheme();
    const [search1, setSearch1] = useState('');
    const [search2, setSearch2] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    const networkList = networks || [];
    const filtered = networkList.filter(n => {
        const s1 = search1.toLowerCase();
        const s2 = search2.toLowerCase();
        const content = `${n.id} ${n.name} ${n.agent_name} ${n.ip_address} ${n.notes}`.toLowerCase();
        return content.includes(s1) && content.includes(s2);
    });

    const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const selectedNetwork = networkList.find(n => n.id === selectedId);

    return (
        <div className="space-y-4">
            {/* Search Filter Area */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 w-24">Search 1 :</label>
                        <input
                            type="text"
                            value={search1}
                            onChange={(e) => setSearch1(e.target.value)}
                            className={`flex-1 max-w-sm px-3 py-1 text-sm border rounded ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 w-24">Search 2 :</label>
                        <input
                            type="text"
                            value={search2}
                            onChange={(e) => setSearch2(e.target.value)}
                            className={`flex-1 max-w-sm px-3 py-1 text-sm border rounded ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                        />
                    </div>
                    <div className="pl-28">
                        <button className={`px-4 py-1 text-xs font-bold rounded border transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50'}`}>
                            Search
                        </button>
                    </div>
                </div>
            </div>

            {/* High Density Table */}
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className={`text-[10px] font-bold uppercase tracking-wider border-b ${isDark ? 'bg-slate-800/50 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                <th className="p-2 w-8"></th>
                                <th className="p-2 border-r border-slate-700/20">ID</th>
                                <th className="p-2 border-r border-slate-700/20">SID</th>
                                <th className="p-2 border-r border-slate-700/20">Schedule</th>
                                <th className="p-2 border-r border-slate-700/20">Schema</th>
                                <th className="p-2 border-r border-slate-700/20">Target Node</th>
                                <th className="p-2 border-r border-slate-700/20">Target Address</th>
                                <th className="p-2 border-r border-slate-700/20">Source Node</th>
                                <th className="p-2 border-r border-slate-700/20">Source Address</th>
                                <th className="p-2 border-r border-slate-700/20">Owner</th>
                                <th className="p-2">Creator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.map((n) => {
                                const job = n.jobs?.[0] || {};
                                const schema = job.schema || {};
                                return (
                                    <tr
                                        key={n.id}
                                        onClick={() => setSelectedId(n.id)}
                                        className={`group cursor-pointer border-b last:border-0 transition-colors ${selectedId === n.id
                                            ? (isDark ? 'bg-blue-500/20' : 'bg-blue-50')
                                            : (isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')
                                            } ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}
                                    >
                                        <td className="p-2 text-center">
                                            <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${selectedId === n.id
                                                ? 'border-blue-500 bg-blue-500 ring-2 ring-blue-500/20'
                                                : (isDark ? 'border-slate-700' : 'border-slate-300')
                                                }`} />
                                        </td>
                                        <td className="p-2 text-[11px] font-mono opacity-60">#{n.id}</td>
                                        <td className="p-2 text-[11px] font-bold">{job.name || 'kosong'}</td>
                                        <td className="p-2 text-[11px] opacity-80">{job.schedule || 'kosong'}</td>
                                        <td className="p-2 text-[11px] text-blue-500 font-bold">{schema.name || 'kosong'}</td>
                                        <td className="p-2 text-[11px] font-black uppercase">
                                            {n.target_db_host ? 'MASTER HOST' : 'REMOTE'}
                                        </td>
                                        <td className="p-2 text-[11px] font-mono opacity-80 max-w-[200px] truncate" title={getTargetAddr(n)}>
                                            {getTargetAddr(n)}
                                        </td>
                                        <td className="p-2 text-[11px] font-black uppercase text-blue-400">
                                            {n.agent_name || n.name}
                                        </td>
                                        <td className="p-2 text-[11px] font-mono opacity-80 max-w-[200px] truncate" title={getSourceAddr(n)}>
                                            {getSourceAddr(n)}
                                        </td>
                                        <td className="p-2 text-[11px] opacity-60">admin</td>
                                        <td className="p-2 text-[11px] opacity-60 whitespace-nowrap">administrator</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Buttons & Quick Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => selectedNetwork && onClone(selectedNetwork)}
                        disabled={!selectedId || cloningNetwork === selectedId}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${!selectedId ? 'opacity-30 cursor-not-allowed' : (isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-slate-300 hover:bg-slate-50')
                            }`}
                    >
                        {cloningNetwork === selectedId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Duplicate'}
                    </button>
                    <button
                        onClick={onAdd}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-slate-300 hover:bg-slate-50'}`}
                    >
                        Add
                    </button>
                    <button
                        onClick={() => selectedNetwork && onEdit(selectedNetwork)}
                        disabled={!selectedId}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${!selectedId ? 'opacity-30 cursor-not-allowed' : (isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-slate-300 hover:bg-slate-50')
                            }`}
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => selectedNetwork && onView(selectedNetwork)}
                        disabled={!selectedId}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${!selectedId ? 'opacity-30 cursor-not-allowed' : (isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-slate-300 hover:bg-slate-50')
                            }`}
                    >
                        View
                    </button>
                    <button
                        onClick={() => selectedNetwork && onDelete(selectedNetwork)}
                        disabled={!selectedId}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${!selectedId ? 'opacity-30 cursor-not-allowed' : (isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white')
                            }`}
                    >
                        Delete
                    </button>
                </div>

                {/* Visual Connection Linkage (Additional Premium Touch) */}
                <AnimatePresence>
                    {selectedId && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className={`flex items-center gap-4 px-6 py-2 rounded-2xl border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}
                        >
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] uppercase font-bold opacity-40">Source</span>
                                <span className={`text-xs font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{selectedNetwork?.name}</span>
                            </div>
                            <ArrowLeftRight className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'} animate-pulse`} />
                            <div className="flex flex-col">
                                <span className="text-[9px] uppercase font-bold opacity-40">Target</span>
                                <span className={`text-xs font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    {selectedNetwork?.target_db_host ? 'Master Server' : 'Remote'}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
