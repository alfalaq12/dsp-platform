import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Share2,
    Database,
    Zap,
    Wifi,
    WifiOff,
    Edit3,
    ArrowRight,
    Search,
    RefreshCw,
    Cpu,
    Activity,
    Network as NetworkIcon,
    Terminal,
    Trash2,
    Calendar,
    Globe,
    Layers,
    Monitor
} from 'lucide-react';
import { useNetworks, useUpdateNetwork, useDeleteNetwork } from '../hooks/useQueries';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer, ConfirmModal } from '../components/Toast';

// Progress Bar Component for Metrics
const MetricBar = ({ label, value, color, icon: Icon, isDark }) => {
    const percentage = Math.min(Math.max(value, 0), 100);
    return (
        <div className="flex flex-col gap-1.5 min-w-[120px]">
            <div className={`flex justify-between items-center text-[10px] uppercase tracking-wider font-bold ${isDark ? 'opacity-60' : 'text-slate-700'}`}>
                <span className="flex items-center gap-1">
                    {Icon && <Icon className="w-3 h-3" />} {label}
                </span>
                <span>{percentage.toFixed(1)}%</span>
            </div>
            <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.2)]`}
                />
            </div>
        </div>
    );
};

const NodeRow = ({ agent, onRename, onUpdateNotes, onPromote, onDelete, isDark }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [newName, setNewName] = useState(agent.name);
    const [newNotes, setNewNotes] = useState(agent.notes || '');

    const statusColor = agent.status === 'online' ? 'text-emerald-400' : 'text-rose-400';
    const statusBg = agent.status === 'online' ? 'bg-emerald-400/10' : 'bg-rose-400/10';
    const statusBorder = agent.status === 'online' ? 'border-emerald-500/20' : 'border-rose-500/20';

    const handleNameSubmit = (e) => {
        e.preventDefault();
        onRename(agent.id, newName);
        setIsEditingName(false);
    };

    const handleNotesSubmit = (e) => {
        e.preventDefault();
        onUpdateNotes(agent.id, newNotes);
        setIsEditingNotes(false);
    };

    // Calculate memory usage percentage
    const memoryPercent = agent.memory_total > 0 ? (agent.memory_used / agent.memory_total) * 100 : 0;

    return (
        <motion.tr
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`group border-b last:border-0 transition-colors ${isDark
                ? 'border-slate-800/50 hover:bg-slate-800/30'
                : 'border-slate-100 hover:bg-blue-50/30'
                }`}
        >
            {/* ID */}
            <td className="py-4 px-4 whitespace-nowrap">
                <span className={`text-[10px] font-mono p-1 rounded font-bold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-800'}`}>
                    #{agent.id}
                </span>
            </td>

            {/* Name */}
            <td className="py-4 px-4 min-w-[200px]">
                {isEditingName ? (
                    <form onSubmit={handleNameSubmit}>
                        <input
                            autoFocus
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={() => setIsEditingName(false)}
                            className={`w-full bg-transparent font-bold border-b border-blue-500 focus:outline-none ${isDark ? 'text-white' : 'text-slate-900'}`}
                        />
                    </form>
                ) : (
                    <div className="flex items-center gap-2 group/name">
                        <span className={`font-bold transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                            {agent.name}
                        </span>
                        <button onClick={() => setIsEditingName(true)} className="opacity-0 group-hover/name:opacity-100 p-1 text-blue-500 transition-opacity">
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </td>

            {/* Notes */}
            <td className="py-4 px-4 min-w-[250px]">
                {isEditingNotes ? (
                    <form onSubmit={handleNotesSubmit}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Add notes..."
                            value={newNotes}
                            onChange={(e) => setNewNotes(e.target.value)}
                            onBlur={() => setIsEditingNotes(false)}
                            className={`w-full bg-transparent text-sm border-b border-blue-500 focus:outline-none ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                        />
                    </form>
                ) : (
                    <div className="flex items-center gap-2 group/notes max-w-[250px]">
                        <span className={`text-sm truncate ${isDark ? 'text-slate-400 opacity-70' : 'text-slate-700 font-medium'}`}>
                            {agent.notes || 'No description...'}
                        </span>
                        <button onClick={() => setIsEditingNotes(true)} className="opacity-0 group-hover/notes:opacity-100 p-1 text-blue-500 transition-opacity flex-shrink-0">
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </td>

            {/* Status */}
            <td className="py-4 px-4">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border transition-all duration-500 ${statusBg} ${statusColor} ${statusBorder} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'online' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-rose-400'}`} />
                    {agent.status?.toUpperCase() || 'OFFLINE'}
                </div>
            </td>

            {/* Metrics */}
            <td className="py-4 px-4 space-y-3">
                <MetricBar
                    label="CPU Load"
                    value={agent.cpu_usage || 0}
                    color="bg-gradient-to-r from-blue-500 to-indigo-500"
                    icon={Cpu}
                    isDark={isDark}
                />
                <MetricBar
                    label={`RAM (${agent.memory_used || 0}/${agent.memory_total || 0}MB)`}
                    value={memoryPercent}
                    color="bg-gradient-to-r from-purple-500 to-pink-500"
                    icon={Activity}
                    isDark={isDark}
                />
            </td>

            {/* Software Version */}
            <td className="py-4 px-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                    <Layers className={`w-4 h-4 ${isDark ? 'opacity-40' : 'text-slate-500'}`} />
                    <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                        v{agent.software_version || '1.0.0'}
                    </span>
                </div>
            </td>

            {/* ADDR */}
            <td className="py-4 px-4 whitespace-nowrap">
                <div className="flex flex-col gap-0.5">
                    <span className={`text-sm font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                        {agent.ip_address || '0.0.0.0'}
                    </span>
                    <span className={`text-[10px] uppercase tracking-tighter font-bold ${isDark ? 'opacity-40' : 'text-slate-500'}`}>Network Node</span>
                </div>
            </td>

            {/* Last Seen */}
            <td className="py-4 px-4 whitespace-nowrap">
                <div className={`flex items-center gap-2 ${isDark ? 'opacity-60' : 'text-slate-700 font-bold'}`}>
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs">
                        {agent.last_seen ? new Date(agent.last_seen).toLocaleTimeString() : '--:--:--'}
                    </span>
                </div>
            </td>

            {/* Actions */}
            <td className="py-4 px-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onPromote(agent)}
                        title="Promote to Network"
                        className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                            ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                            }`}
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => {/* Open Terminal */ }}
                        title="Node Terminal"
                        className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                            }`}
                    >
                        <Terminal className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(agent.id)}
                        title="Remove Node"
                        className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white'
                            : 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white'
                            }`}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </motion.tr>
    );
};

export default function Nodes() {
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const { toasts, addToast, removeToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Fetch networks (which represent connected agents)
    const { data: networks = [], isLoading: isFetching, refetch } = useNetworks();
    const updateNetworkMutation = useUpdateNetwork();
    const deleteNetworkMutation = useDeleteNetwork();

    const handleRename = async (id, newName) => {
        try {
            const networkList = networks || [];
            const network = networkList.find(n => n.id === id);
            await updateNetworkMutation.mutateAsync({
                id,
                data: { ...network, name: newName }
            });
            addToast('Node renamed successfully!', 'success');
        } catch (error) {
            addToast('Failed to rename node', 'error');
        }
    };

    const handleUpdateNotes = async (id, notes) => {
        try {
            const networkList = networks || [];
            const network = networkList.find(n => n.id === id);
            await updateNetworkMutation.mutateAsync({
                id,
                data: { ...network, notes }
            });
            addToast('Notes updated!', 'success');
        } catch (error) {
            addToast('Failed to update notes', 'error');
        }
    };

    const handlePromote = (agent) => {
        navigate('/network', { state: { promoteId: agent.id } });
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            await deleteNetworkMutation.mutateAsync(deletingId);
            addToast('Node removed from cluster', 'success');
            setDeletingId(null);
        } catch (error) {
            addToast('Failed to remove node', 'error');
        }
    };

    const filteredNetworks = (networks || []).filter(n =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.ip_address.includes(searchQuery) ||
        (n.notes && n.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen space-y-6 pb-20">
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <ConfirmModal
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleDelete}
                title="Remove Node"
                message="Are you sure you want to disconnect this node from the cluster? This action is permanent."
                isDark={isDark}
            />

            {/* Modern Header / Breadcrumb Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-2">
                <div>
                    <h1 className={`text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Cluster <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Nodes</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-2 opacity-50 text-sm">
                        <Monitor className="w-4 h-4" />
                        <span>System Infrastructure</span>
                        <span>/</span>
                        <Globe className="w-4 h-4" />
                        <span>Global Agent Registry</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                        <input
                            type="text"
                            placeholder="Filter cluster nodes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-11 pr-4 py-3 text-sm rounded-2xl border transition-all ${isDark
                                ? 'bg-slate-900/60 border-slate-800 text-white focus:border-blue-500 focus:bg-slate-900'
                                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-400 focus:bg-white shadow-sm'
                                }`}
                        />
                    </div>
                    <button
                        onClick={() => refetch()}
                        className={`p-3 rounded-2xl border transition-all ${isDark
                            ? 'bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-blue-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-blue-600 shadow-sm'
                            }`}
                    >
                        <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Nodes', val: (networks || []).length, icon: Share2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Active', val: (networks || []).filter(n => n.status === 'online').length, icon: Wifi, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Avg CPU', val: `${((networks || []).reduce((acc, n) => acc + (n.cpu_usage || 0), 0) / ((networks || []).length || 1)).toFixed(1)}%`, icon: Cpu, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Network Load', val: 'Low', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                ].map((s, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className={`p-6 rounded-[2rem] border overflow-hidden relative group ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/40'
                            }`}
                    >
                        <div className={`absolute top-0 right-0 w-24 h-24 ${s.bg} rounded-full blur-3xl -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700`} />
                        <div className="relative flex justify-between items-center">
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'opacity-40' : 'text-slate-700'}`}>{s.label}</p>
                                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.val}</p>
                            </div>
                            <div className={`p-4 rounded-2xl ${s.bg} ${s.color}`}>
                                <s.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Futuristic Table Container */}
            <div className={`rounded-[2.5rem] border overflow-hidden transition-all ${isDark
                ? 'bg-slate-900/40 border-slate-800 shadow-2xl'
                : 'bg-white border-slate-300 shadow-2xl shadow-blue-900/5'
                }`}>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className={`${isDark ? 'bg-slate-800/40 text-slate-400' : 'bg-slate-100 text-slate-700 font-bold'}`}>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em] w-16">ID</th>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Node / Identity</th>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Notes / Description</th>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Status</th>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Resources</th>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Software</th>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Address</th>
                                <th className="py-5 px-4 text-left text-[10px] font-black uppercase tracking-[0.2em]">Presence</th>
                                <th className="py-5 px-4 text-center text-[10px] font-black uppercase tracking-[0.2em] w-32">Control</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {isFetching ? (
                                    [1, 2, 3].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="9" className="p-8">
                                                <div className={`h-12 w-full rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} />
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredNetworks.length > 0 ? (
                                    filteredNetworks.map(agent => (
                                        <NodeRow
                                            key={agent.id}
                                            agent={agent}
                                            isDark={isDark}
                                            onRename={handleRename}
                                            onUpdateNotes={handleUpdateNotes}
                                            onPromote={handlePromote}
                                            onDelete={(id) => setDeletingId(id)}
                                        />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-20">
                                                <NetworkIcon className="w-20 h-20" />
                                                <p className="text-xl font-bold tracking-tight">Cores Unresponsive or Filter Mismatch</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                {/* Footer / Pagination Area (Placeholder for consistency with image) */}
                <div className={`p-6 border-t flex justify-between items-center text-[10px] font-black tracking-widest uppercase ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-300 bg-slate-100'
                    }`}>
                    <div className="flex items-center gap-4">
                        <span className={`tracking-[0.3em] ${isDark ? 'opacity-40' : 'text-slate-600'}`}>Sector 7G-Alpha</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-blue-500">Sync Pipeline Active</span>
                    </div>
                    <div className={`flex gap-6 ${isDark ? 'opacity-40' : 'text-slate-600'}`}>
                        <span>Page 1 of 1</span>
                        <span>{(filteredNetworks || []).length} Nodes Identified</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
