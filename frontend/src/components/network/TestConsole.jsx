import React, { useState, useEffect, useRef } from 'react';
import {
    Play, Save, Trash2, Database, Info, AlertCircle, CheckCircle2,
    X, Maximize2, Minimize2, Copy, FileJson, Table as TableIcon,
    Clock, Cpu, Settings, ChevronRight, Download, Clipboard,
    History, Bookmark, ArrowLeft, Terminal, Layout
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useExecuteQuery } from '../../hooks/useQueries';

/**
 * TestConsole Component - Refined Version
 * Matches the requested metadata display and query management features.
 */
const TestConsole = ({ network, agentName, dbConfig, onClose, addToast }) => {
    const { isDark } = useTheme();
    const [query, setQuery] = useState('SELECT 1;');
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [duration, setDuration] = useState(null);
    const [rowCount, setRowCount] = useState(0);
    const [isMaximized, setIsMaximized] = useState(false);
    const [activeTab, setActiveTab] = useState('result');
    const [dbMetadata, setDbMetadata] = useState(null);
    const [limit, setLimit] = useState(1000);

    // Saved Queries Logic
    const [savedQueries, setSavedQueries] = useState(() => {
        const saved = localStorage.getItem('dsp_saved_queries');
        return saved ? JSON.parse(saved) : [];
    });
    const [selectedSavedKey, setSelectedSavedKey] = useState('');

    const executeQueryMutation = useExecuteQuery();
    const isLoading = executeQueryMutation.isPending;

    // Run query handler
    const handleRun = async (overrideQuery) => {
        const queryToRun = overrideQuery || query;
        if (!queryToRun?.trim()) return;

        setError(null);
        setResults(null);
        setActiveTab('result');

        try {
            const response = await executeQueryMutation.mutateAsync({
                agentName: agentName || 'LOCAL',
                data: {
                    query: queryToRun,
                    db_config: dbConfig || null
                }
            });

            if (response.data.success) {
                setResults(response.data.results || []);
                setRowCount(response.data.row_count || 0);
                setDuration(response.data.duration || 0);

                // Set metadata from response if available
                if (response.data.metadata) {
                    setDbMetadata(response.data.metadata);
                }

                if (addToast) addToast(`Query executed successfully`, 'success');
            } else {
                setError(response.data.error || 'Unknown query error');
            }
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message;
            setError(errMsg);
            if (addToast) addToast(`Query failed: ${errMsg}`, 'error');
        }
    };

    const handleSaveQuery = () => {
        if (!query.trim()) return;
        const name = prompt("Enter a name for this query:");
        if (!name) return;

        const newSaved = [...savedQueries, { name, query }];
        setSavedQueries(newSaved);
        localStorage.setItem('dsp_saved_queries', JSON.stringify(newSaved));
        if (addToast) addToast('Query saved locally', 'success');
    };

    const handleDeleteSaved = () => {
        if (!selectedSavedKey) return;
        const newSaved = savedQueries.filter(q => q.name !== selectedSavedKey);
        setSavedQueries(newSaved);
        localStorage.setItem('dsp_saved_queries', JSON.stringify(newSaved));
        setSelectedSavedKey('');
        if (addToast) addToast('Saved query removed', 'info');
    };

    const handleClipboard = () => {
        navigator.clipboard.readText().then(text => {
            setQuery(text);
        });
    };

    const handlePasteAndRun = () => {
        navigator.clipboard.readText().then(text => {
            setQuery(text);
            handleRun(text);
        });
    };

    const handleCopyResults = () => {
        if (!results) return;
        navigator.clipboard.writeText(JSON.stringify(results, null, 2));
        if (addToast) addToast('Results copied to clipboard', 'info');
    };

    const handleExportCSV = () => {
        if (!results || results.length === 0) return;
        const headers = Object.keys(results[0]);
        const csvContent = [headers.join(','), ...results.map(row => headers.map(h => JSON.stringify(row[h])).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `results_${new Date().getTime()}.csv`);
        link.click();
    };

    const MetaRow = ({ label, value }) => (
        <div className="flex items-start gap-4 text-xs font-mono py-1 border-b border-slate-700/30 last:border-0">
            <span className="w-32 font-bold text-slate-500 uppercase">{label}</span>
            <span className="text-slate-400">:</span>
            <span className={`flex-1 truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value || '-'}</span>
        </div>
    );

    return (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300`}>
            <div className={`relative flex flex-col w-full ${isMaximized ? 'h-full' : 'max-w-6xl h-[92vh]'} ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} rounded-3xl shadow-2xl border flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300`}>

                {/* Refined Header per Image 2 */}
                <div className={`px-8 py-6 border-b flex flex-col gap-6 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                                <Terminal className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className={`text-xl font-black italic tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>SQL CONSOLE</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connected to {agentName || 'LOCAL'} HUB</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsMaximized(!isMaximized)} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`}>
                                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                            </button>
                            <button onClick={onClose} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-red-500/10 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-600 hover:text-red-600'}`}>
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Meta Data Panel (From Reference Image) */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 p-6 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                        <div className="space-y-1">
                            <MetaRow label="NODE" value={agentName || 'MASTER HOST'} />
                            <MetaRow label="DB" value={dbConfig ? `jdbc:${dbConfig.driver}://${dbMetadata?.host || dbConfig.host}:${dbMetadata?.port || dbConfig.port}/${dbMetadata?.db_name || dbConfig.db_name} | user:${dbMetadata?.user || dbConfig.user}` : '-'} />
                            <MetaRow label="Server Host" value={dbMetadata?.host || dbConfig?.host} />
                        </div>
                        <div className="space-y-1 text-emerald-500">
                            <MetaRow label="Server Port" value={dbMetadata?.port || dbConfig?.port} />
                            <MetaRow label="Database Name" value={dbMetadata?.db_name || dbConfig?.db_name} />
                            <MetaRow label="DB PRODUCT" value={dbMetadata?.product} />
                            <MetaRow label="DRIVER" value={dbMetadata?.driver?.toUpperCase() + " Driver " + (dbConfig?.driver === 'postgres' ? '42.2.19' : 'Native')} />
                        </div>
                    </div>
                </div>

                {/* Main Body */}
                <div className="flex-1 overflow-hidden flex flex-col p-8 gap-8">

                    {/* Editor & Saved Queries Control Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Editor Section */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                            <div className={`relative rounded-2xl border-2 transition-all overflow-hidden ${isDark ? 'bg-slate-950 border-slate-800 focus-within:border-blue-500/50' : 'bg-slate-100 border-slate-200 focus-within:border-blue-500'}`}>
                                <div className={`flex items-center justify-between px-6 py-3 border-b ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-200/50 border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <Layout className="w-4 h-4 text-blue-500" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Query Statement</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500 font-bold">Rows:</span>
                                        <input
                                            type="number"
                                            value={limit}
                                            onChange={(e) => setLimit(e.target.value)}
                                            className="w-16 bg-transparent border-b border-slate-700 text-[10px] px-1 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <textarea
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className={`w-full h-40 px-6 py-4 bg-transparent border-none focus:ring-0 font-mono text-sm resize-none ${isDark ? 'text-white' : 'text-slate-900'} placeholder-slate-700`}
                                    placeholder="SELECT * FROM table..."
                                />
                            </div>

                            {/* Buttons per Reference */}
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => handleRun()} disabled={isLoading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                                    {isLoading ? <div className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full"></div> : <Play className="w-3 h-3 fill-current" />}
                                    RUN
                                </button>
                                <button onClick={handleClipboard} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                                    CLIPBOARD
                                </button>
                                <button onClick={handlePasteAndRun} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                                    PASTE & RUN
                                </button>
                                <button onClick={handleSaveQuery} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                                    SAVE
                                </button>
                                <button onClick={handleExportCSV} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}>
                                    EXPORT
                                </button>
                                <button onClick={onClose} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100'}`}>
                                    BACK
                                </button>
                            </div>
                        </div>

                        {/* Saved Queries Section (Right Panel) */}
                        <div className={`rounded-2xl border-2 p-6 flex flex-col gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Bookmark className="w-4 h-4 text-orange-500" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Run Saved Query</span>
                            </div>

                            <select
                                value={selectedSavedKey}
                                onChange={(e) => {
                                    setSelectedSavedKey(e.target.value);
                                    const saved = savedQueries.find(q => q.name === e.target.value);
                                    if (saved) {
                                        setQuery(saved.query);
                                        handleRun(saved.query);
                                    }
                                }}
                                className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition-all text-sm ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                            >
                                <option value="">[select one]</option>
                                {savedQueries.map(q => (
                                    <option key={q.name} value={q.name}>{q.name}</option>
                                ))}
                            </select>

                            <button onClick={handleDeleteSaved} disabled={!selectedSavedKey} className={`w-full py-2.5 rounded-xl text-xs font-black transition-all border ${selectedSavedKey ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20' : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'}`}>
                                DELETE SAVED
                            </button>

                            <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center">
                                <History className="w-12 h-12 mb-2" />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Recent Activity</span>
                            </div>
                        </div>
                    </div>

                    {/* Result Table Area (Glassmorphism Table) */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className={`flex items-center justify-between px-6 py-2 border-b-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-300'} mb-4`}>
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-black tracking-widest text-blue-500">RESULT <span className="text-slate-500 font-normal">(time={duration} ms)</span></span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{rowCount} ENTRIES</span>
                        </div>

                        <div className={`flex-1 rounded-2xl border-2 overflow-hidden flex flex-col ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                            {error ? (
                                <div className="p-8 flex items-center justify-center h-full">
                                    <div className={`max-w-md w-full p-6 rounded-2xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex gap-4">
                                            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                                            <div>
                                                <h4 className="text-red-500 font-bold uppercase text-xs mb-1">Execution Error</h4>
                                                <p className={`text-xs font-mono break-all ${isDark ? 'text-red-200' : 'text-red-700'}`}>{error}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : results && results.length > 0 ? (
                                <div className="overflow-auto h-full">
                                    <table className="w-full text-left border-collapse">
                                        <thead className={`sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-slate-100'} z-10`}>
                                            <tr className="border-b-2 border-slate-800">
                                                <th className="px-4 py-2 text-[10px] font-black text-blue-500 uppercase border-r border-slate-800 bg-slate-800/20 w-12 text-center">#</th>
                                                {Object.keys(results[0]).map(col => (
                                                    <th key={col} className="px-4 py-2 text-[10px] font-black text-slate-400 border-r last:border-0 border-slate-800 uppercase tracking-tighter">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((row, i) => (
                                                <tr key={i} className={`group ${isDark ? 'hover:bg-blue-500/10' : 'hover:bg-blue-50'} border-b border-slate-800/50 last:border-0 transition-colors`}>
                                                    <td className="px-4 py-2 text-[10px] font-bold text-slate-600 border-r border-slate-800/50 text-center bg-slate-800/5">{i + 1}</td>
                                                    {Object.keys(results[0]).map(col => (
                                                        <td key={col} className={`px-4 py-2 text-xs font-mono border-r last:border-0 border-slate-800/50 whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                            {row[col] === null ? <span className="text-red-500/50 italic text-[10px]">NULL</span> : String(row[col])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-20 text-slate-500">
                                    <Database className="w-16 h-16 mb-4" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No Data Available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Bar */}
                <div className={`px-8 py-3 border-t flex items-center justify-between ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-6 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>System Ready</span>
                        </div>
                        <div className="border-l border-slate-800 pl-6">
                            <span>Isolation: Read Committed</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-blue-500 px-4 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                        V1.2.0-PRO
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestConsole;
