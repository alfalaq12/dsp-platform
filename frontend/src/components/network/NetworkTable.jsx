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
    Monitor,
    Clipboard
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
    onCopyConfig,
    onDelete
}) {
    const { isDark } = useTheme();
    const [selectedIds, setSelectedIds] = useState([]);

    const networkList = networks || [];
    const paged = networkList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const selectedId = selectedIds[0];
    const selectedNetwork = networkList.find(n => n.id === selectedId);

    const toggleSelectAll = () => {
        if (selectedIds.length === paged.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(paged.map(n => n.id));
        }
    };

    const toggleSelectRow = (id, e) => {
        e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className={`flex flex-col h-full bg-transparent`}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b`}>
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.length === paged.length && paged.length > 0}
                                    onChange={toggleSelectAll}
                                    className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${isDark ? 'bg-slate-700 border-slate-600' : ''}`} 
                                />
                            </th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>ID</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>SID</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Schedule</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Schema</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Target Node</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Target Address</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Source Node</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Source Address</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Owner</th>
                            <th className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Creator</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {paged.map((n) => {
                            const job = n.jobs?.[0] || {};
                            const schema = job.schema || {};
                            return (
                                <tr
                                    key={n.id}
                                    onClick={(e) => toggleSelectRow(n.id, e)}
                                    className={`transition-all cursor-pointer ${
                                        selectedIds.includes(n.id) 
                                            ? (isDark ? 'bg-blue-900/30' : 'bg-blue-50/50') 
                                            : (isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50')
                                    }`}
                                >
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.includes(n.id)}
                                            onChange={(e) => toggleSelectRow(n.id, e)}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${isDark ? 'bg-slate-700 border-slate-600' : ''}`} 
                                        />
                                    </td>
                                    <td className={`px-6 py-4 font-mono ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>#{n.id}</td>
                                    <td className={`px-6 py-4 font-bold whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>{job.name || 'kosong'}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{job.schedule || 'kosong'}</td>
                                    <td className="px-6 py-4 text-blue-500 font-bold whitespace-nowrap">{schema.name || 'kosong'}</td>
                                    <td className={`px-6 py-4 font-black uppercase whitespace-nowrap ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                        {n.target_db_host ? 'MASTER HOST' : 'REMOTE'}
                                    </td>
                                    <td className={`px-6 py-4 font-mono max-w-[200px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`} title={getTargetAddr(n)}>
                                        {getTargetAddr(n)}
                                    </td>
                                    <td className="px-6 py-4 font-black uppercase text-blue-500 whitespace-nowrap">
                                        {n.agent_name || n.name}
                                    </td>
                                    <td className={`px-6 py-4 font-mono max-w-[200px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`} title={getSourceAddr(n)}>
                                        {getSourceAddr(n)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>admin</td>
                                    <td className={`px-6 py-4 whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>administrator</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Action Buttons & Quick Controls */}
            <div className={`p-6 border-t flex flex-col xl:flex-row items-center justify-between gap-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => selectedNetwork && onClone(selectedNetwork)}
                        disabled={!selectedId || cloningNetwork === selectedId}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark 
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {cloningNetwork === selectedId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                        Duplicate
                    </button>
                    <button
                        onClick={() => selectedNetwork && onCopyConfig(selectedNetwork)}
                        disabled={!selectedId}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark 
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Clipboard className="w-4 h-4" />
                        Copy Config
                    </button>
                    <button
                        onClick={onAdd}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark 
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                    <button
                        onClick={() => selectedNetwork && onEdit(selectedNetwork)}
                        disabled={selectedIds.length !== 1}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark 
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Edit className="w-4 h-4" />
                        Edit
                    </button>
                    <button
                        onClick={() => selectedNetwork && onView(selectedNetwork)}
                        disabled={!selectedId}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark 
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Eye className="w-4 h-4" />
                        View
                    </button>
                    <button
                        onClick={() => selectedNetwork && onDelete(selectedNetwork)}
                        disabled={selectedIds.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark 
                                ? 'border-red-900/30 text-red-500 hover:bg-red-900/20' 
                                : 'border-red-200 text-red-600 hover:bg-red-50'
                        }`}
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete {selectedIds.length > 1 ? `(${selectedIds.length})` : ''}
                    </button>
                </div>

                {/* Visual Connection Linkage (Additional Premium Touch) */}
                <AnimatePresence>
                    {selectedId && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className={`flex items-center gap-6 px-6 py-3 rounded-2xl border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white border-blue-300 shadow-md'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className={`text-[9px] uppercase font-bold ${isDark ? 'opacity-40' : 'text-slate-400'}`}>Source Node</span>
                                    <span className={`text-xs font-black ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{selectedNetwork?.name}</span>
                                </div>
                                <button
                                    onClick={() => onTestSource(selectedNetwork)}
                                    disabled={testingNetwork === selectedId}
                                    className={`flex items-center justify-center p-2 rounded-lg transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-blue-400' : 'bg-white hover:bg-blue-50 text-blue-600 border border-blue-200'}`}
                                    title="Test Source Connectivity"
                                >
                                    {testingNetwork === selectedId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={`h-px w-8 ${isDark ? 'bg-blue-500/30' : 'bg-blue-200'}`} />
                                <ArrowLeftRight className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'} animate-pulse`} />
                                <div className={`h-px w-8 ${isDark ? 'bg-blue-500/30' : 'bg-blue-200'}`} />
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => onTestTarget(selectedNetwork)}
                                    disabled={testingTargetNetwork === selectedId}
                                    className={`flex items-center justify-center p-2 rounded-lg transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-green-400' : 'bg-white hover:bg-green-50 text-green-600 border border-green-200'}`}
                                    title="Test Target Connectivity"
                                >
                                    {testingTargetNetwork === selectedId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                </button>
                                <div className="flex flex-col">
                                    <span className={`text-[9px] uppercase font-bold ${isDark ? 'opacity-40' : 'text-slate-400'}`}>Target Node</span>
                                    <span className={`text-xs font-black ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                        {selectedNetwork?.target_db_host ? 'Master Server' : 'Remote Agent'}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
