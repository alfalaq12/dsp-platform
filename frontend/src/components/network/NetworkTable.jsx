import { Database, Server, Shield, Globe, HardDrive, Circle, Eye, Edit, Copy, Trash2, Zap, Play, ArrowLeftRight, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Helper: Generate source connection string
function getSourceAddr(network) {
    const srcType = network.source_type || 'database';
    if (srcType === 'database') return `${network.db_driver || 'postgres'}://${network.db_host || '-'}:${network.db_port || '5432'}/${network.db_name || '-'}`;
    if (srcType === 'ftp' || srcType === 'sftp') return `${srcType}://${network.ftp_host || '-'}:${network.ftp_port || '21'}${network.ftp_path || '/'}`;
    if (srcType === 'api') return network.api_url || '-';
    if (srcType === 'mongodb') return `mongodb://${network.mongo_host || '-'}:${network.mongo_port || '27017'}/${network.mongo_database || '-'}`;
    if (srcType === 'redis') return `redis://${network.redis_host || '-'}:${network.redis_port || '6379'}/${network.redis_db || 0}`;
    return '-';
}

function getSourceAddrShort(network) {
    const srcType = network.source_type || 'database';
    if (srcType === 'database') return `${network.db_driver || 'postgres'}://${network.db_host || '-'}:${network.db_port || '5432'}`;
    if (srcType === 'ftp' || srcType === 'sftp') return `${srcType}://${network.ftp_host || '-'}:${network.ftp_port || '21'}`;
    if (srcType === 'api') return network.api_url || '-';
    return '-';
}

function getTargetAddr(network, short = false) {
    const tgtType = network.target_source_type || 'database';
    if (tgtType === 'database') {
        if (!network.target_db_host) return '-';
        return short
            ? `${network.target_db_driver || 'postgres'}://${network.target_db_host}:${network.target_db_port || '5432'}`
            : `${network.target_db_driver || 'postgres'}://${network.target_db_host}:${network.target_db_port || '5432'}/${network.target_db_name || '-'}`;
    }
    if (tgtType === 'ftp' || tgtType === 'sftp') {
        if (!network.target_ftp_host) return '-';
        return short
            ? `${tgtType}://${network.target_ftp_host}:${network.target_ftp_port || '21'}`
            : `${tgtType}://${network.target_ftp_host}:${network.target_ftp_port || '21'}${network.target_ftp_path || '/'}`;
    }
    if (tgtType === 'api') return network.target_api_url || '-';
    return '-';
}

// Desktop table row
function NetworkRow({ network, userRole, testingNetwork, testingTargetNetwork, reversingNetwork, cloningNetwork, onTestSource, onTestTarget, onReverse, onView, onEdit, onClone, onDelete, isDark }) {
    const srcType = network.source_type || 'database';
    const tgtType = network.target_source_type || 'database';
    return (
        <tr className={`transition-colors ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
            <td className={`px-4 py-3 text-sm font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{network.id}</td>
            <td className="px-4 py-3">
                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{network.name}</div>
                <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{network.ip_address}</div>
            </td>
            <td className="px-4 py-3">
                <div className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{srcType.toUpperCase()}</div>
                <div className={`text-xs font-mono break-all max-w-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{getSourceAddr(network)}</div>
            </td>
            <td className="px-4 py-3">
                <div className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{tgtType.toUpperCase()}</div>
                <div className={`text-xs font-mono break-all max-w-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{getTargetAddr(network)}</div>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-1">
                    {userRole === 'admin' && (
                        <>
                            <button onClick={() => onTestSource(network)} disabled={testingNetwork === network.id} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-purple-400' : 'hover:bg-purple-50 text-purple-600'}`} title="Test Source">
                                {testingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => onTestTarget(network)} disabled={testingTargetNetwork === network.id} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'}`} title="Test Target">
                                {testingTargetNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => onReverse(network)} disabled={reversingNetwork === network.id} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-orange-400' : 'hover:bg-orange-50 text-orange-600'}`} title="Swap ↔">
                                {reversingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                            </button>
                        </>
                    )}
                    <button onClick={() => onView(network)} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-blue-400' : 'hover:bg-blue-50 text-blue-600'}`} title="View">
                        <Eye className="w-3.5 h-3.5" />
                    </button>
                    {userRole === 'admin' && (
                        <>
                            <button onClick={() => onEdit(network)} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="Edit">
                                <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onClone(network)} disabled={cloningNetwork === network.id} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="Clone">
                                {cloningNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => onDelete(network)} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}`} title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

// Mobile card
function NetworkCard({ network, userRole, testingNetwork, testingTargetNetwork, reversingNetwork, cloningNetwork, onTestSource, onTestTarget, onReverse, onView, onEdit, onClone, onDelete, isDark }) {
    const srcType = network.source_type || 'database';
    const tgtType = network.target_source_type || 'database';
    return (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-md'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{network.name}</div>
                        <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ID: {network.id}</div>
                    </div>
                </div>
                <Circle className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'} fill-current`} />
            </div>

            {/* Source & Target Info */}
            <div className="space-y-2 mb-4">
                <div className={`p-2 rounded-lg text-xs ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-100'}`}>
                    <span className={`font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>SOURCE:</span>
                    <span className={`ml-2 font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{srcType.toUpperCase()} - {getSourceAddrShort(network)}</span>
                </div>
                <div className={`p-2 rounded-lg text-xs ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'}`}>
                    <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>TARGET:</span>
                    <span className={`ml-2 font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{tgtType.toUpperCase()} - {getTargetAddr(network, true)}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className={`flex flex-wrap gap-2 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <button onClick={() => onView(network)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                    <Eye className="w-3.5 h-3.5" /> Detail
                </button>
                {userRole === 'admin' && (
                    <>
                        <button onClick={() => onTestSource(network)} disabled={testingNetwork === network.id} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
                            {testingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Test Src
                        </button>
                        <button onClick={() => onTestTarget(network)} disabled={testingTargetNetwork === network.id} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                            {testingTargetNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Test Target
                        </button>
                        <button onClick={() => onReverse(network)} disabled={reversingNetwork === network.id} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>
                            {reversingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />} Swap
                        </button>
                        <button onClick={() => onEdit(network)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                            <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => onClone(network)} disabled={cloningNetwork === network.id} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                            {cloningNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Clone
                        </button>
                        <button onClick={() => onDelete(network)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// Main component: renders both desktop table and mobile cards
export default function NetworkTable({ networks, currentPage, itemsPerPage, userRole, testingNetwork, testingTargetNetwork, reversingNetwork, cloningNetwork, onTestSource, onTestTarget, onReverse, onView, onEdit, onClone, onDelete }) {
    const { isDark } = useTheme();
    const paged = networks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const actionProps = { userRole, testingNetwork, testingTargetNetwork, reversingNetwork, cloningNetwork, onTestSource, onTestTarget, onReverse, onView, onEdit, onClone, onDelete, isDark };

    return (
        <>
            {/* Desktop Table */}
            <div className={`hidden lg:block rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className={isDark ? 'bg-slate-900/50' : 'bg-slate-50'}>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID</th>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Name</th>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                    <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Source</span>
                                </th>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    <span className="flex items-center gap-1"><Server className="w-3 h-3" /> Target</span>
                                </th>
                                <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                            {paged.map((network) => (
                                <NetworkRow key={network.id} network={network} {...actionProps} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
                {paged.map((network) => (
                    <NetworkCard key={network.id} network={network} {...actionProps} />
                ))}
            </div>
        </>
    );
}
