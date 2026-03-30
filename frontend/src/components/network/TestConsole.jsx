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
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting', 'connected', 'failed'
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [columnTypes, setColumnTypes] = useState([]);

    // Saved Queries Logic
    const [savedQueries, setSavedQueries] = useState(() => {
        const saved = localStorage.getItem('dsp_saved_queries');
        return saved ? JSON.parse(saved) : [];
    });
    const [selectedSavedKey, setSelectedSavedKey] = useState('');

    const executeQueryMutation = useExecuteQuery();
    const isLoading = executeQueryMutation.isPending;

    // Run connection test on mount
    useEffect(() => {
        handleRun('SELECT 1;');
    }, []);

    // Run query handler
    const handleRun = async (overrideQuery) => {
        const queryToRun = overrideQuery || query;
        if (!queryToRun?.trim()) return;

        setError(null);
        // Don't clear results if it's the invisible connection test
        if (overrideQuery !== 'SELECT 1;' || !isInitialLoading) setResults(null);
        setActiveTab('result');

        // If it's the test query, set connecting status
        if (queryToRun === 'SELECT 1;' && isInitialLoading) {
            setConnectionStatus('connecting');
        }

        try {
            const response = await executeQueryMutation.mutateAsync({
                agentName: agentName || 'LOCAL',
                data: {
                    query: queryToRun,
                    db_config: dbConfig || null
                }
            });

            if (response.data.success) {
                if (queryToRun === 'SELECT 1;') {
                    setConnectionStatus('connected');
                }

                // Set results for real user queries or successful initial test (as initial rows)
                setResults(response.data.results || []);
                setColumnTypes(response.data.columns || []); // Extract new column types
                setRowCount(response.data.row_count || 0);
                setDuration(response.data.duration || 0);

                // Set metadata from response if available
                if (response.data.metadata) {
                    setDbMetadata(response.data.metadata);
                }

                if (!isInitialLoading && addToast) {
                    addToast(`Query executed successfully`, 'success');
                }
            } else {
                if (queryToRun === 'SELECT 1;') setConnectionStatus('failed');
                setError(response.data.error || 'Unknown query error');
            }
        } catch (err) {
            if (overrideQuery === 'SELECT 1;') setConnectionStatus('failed');
            const errMsg = err.response?.data?.error || err.message;
            setError(errMsg);
            if (!isInitialLoading && addToast) {
                addToast(`Query failed: ${errMsg}`, 'error');
            }
        } finally {
            if (isInitialLoading) setIsInitialLoading(false);
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

    const MetaBadge = ({ label, value, className = "" }) => (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono border ${isDark ? 'bg-slate-800/50 border-slate-700/50 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'} ${className}`}>
            <span className={`font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
            <span className="truncate max-w-[150px]">{value || '-'}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm transition-opacity">
            <div className={`relative w-full ${isMaximized ? 'h-full max-h-screen rounded-none' : 'max-w-6xl h-[88vh] rounded-2xl'} flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${isDark ? 'bg-[#0f172a] border border-slate-800' : 'bg-white border border-slate-200'}`}>
                
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <Terminal className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className={`text-lg font-semibold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>SQL Console</h3>
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ${
                                    connectionStatus === 'connected' ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') :
                                    connectionStatus === 'failed'   ? (isDark ? 'bg-rose-500/10 text-rose-400'     : 'bg-rose-50 text-rose-600') :
                                                                      (isDark ? 'bg-amber-500/10 text-amber-400'   : 'bg-amber-50 text-amber-600')
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                        connectionStatus === 'connected' ? 'bg-emerald-500' :
                                        connectionStatus === 'failed' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                                    }`} />
                                    {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'failed' ? 'Disconnected' : 'Connecting...'}
                                </div>
                            </div>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Network Node: <span className="font-medium text-blue-500">{agentName || 'LOCAL'}</span></p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setIsMaximized(!isMaximized)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`} title={isMaximized ? "Restore down" : "Maximize"}>
                            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-500 hover:text-red-600'}`} title="Close console">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Meta Information Bar */}
                <div className={`px-6 py-3 border-b flex flex-wrap gap-2 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                    <MetaBadge label="Host" value={dbMetadata?.host || dbConfig?.host || dbConfig?.db_host || 'localhost'} />
                    <MetaBadge label="Port" value={dbMetadata?.port || dbConfig?.port || dbConfig?.db_port} />
                    <MetaBadge label="Database" value={dbMetadata?.db_name || dbConfig?.db_name} />
                    <MetaBadge label="Engine" value={dbMetadata?.product || (dbMetadata?.driver || dbConfig?.db_driver || dbConfig?.driver)?.toUpperCase()} />
                    <MetaBadge label="User" value={dbConfig?.db_user || dbConfig?.user} />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                    
                    {/* Left Panel: Query Editor */}
                    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
                        <div className={`px-4 py-2 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
                            <div className="flex items-center gap-2">
                                <Layout className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Query Editor</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Limit:</span>
                                <input
                                    type="number"
                                    value={limit}
                                    onChange={(e) => setLimit(e.target.value)}
                                    className={`w-16 h-6 px-1.5 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
                                />
                            </div>
                        </div>
                        
                        {/* SQL Textarea */}
                        <div className={`flex-1 relative ${isDark ? 'bg-slate-900/30' : 'bg-slate-50/30'}`}>
                            <textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className={`w-full h-full p-4 bg-transparent border-none focus:ring-0 font-mono text-sm resize-none outline-none ${isDark ? 'text-blue-100' : 'text-slate-800'} placeholder-slate-400 dark:placeholder-slate-600`}
                                placeholder="Type your SQL query here... (e.g., SELECT * FROM users)"
                                spellCheck="false"
                            />
                        </div>

                        {/* Editor Action Bar */}
                        <div className={`px-4 py-3 border-t flex flex-wrap items-center justify-between gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleRun()} disabled={isLoading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2">
                                    {isLoading ? <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-200 border-t-white rounded-full" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                    Run Query
                                </button>
                                <button onClick={handleSaveQuery} disabled={!query.trim()} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                    <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Save</span>
                                </button>
                                <button onClick={handlePasteAndRun} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                    <Clipboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Paste & Run</span>
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {savedQueries.length > 0 && (
                                    <div className="flex items-center gap-2 mr-2">
                                        <History className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                        <select
                                            value={selectedSavedKey}
                                            onChange={(e) => {
                                                setSelectedSavedKey(e.target.value);
                                                const saved = savedQueries.find(q => q.name === e.target.value);
                                                if (saved) {
                                                    setQuery(saved.query);
                                                }
                                            }}
                                            className={`max-w-[140px] px-2 py-1.5 rounded-lg text-xs border outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
                                        >
                                            <option value="">Saved Queries...</option>
                                            {savedQueries.map(q => (
                                                <option key={q.name} value={q.name}>{q.name}</option>
                                            ))}
                                        </select>
                                        {selectedSavedKey && (
                                            <button onClick={handleDeleteSaved} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete selected query">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Data Results */}
                    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
                        {/* Results Header */}
                        <div className={`px-4 py-2 border-b flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-white'}`}>
                            <div className="flex items-center gap-2">
                                <TableIcon className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Results</span>
                                {duration !== null && (
                                    <span className={`text-[10px] ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>({duration}ms)</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                    {rowCount} rows
                                </span>
                                {results?.length > 0 && (
                                    <button onClick={handleExportCSV} className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                                        <Download className="w-3 h-3" /> Export CSV
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Results Table Area */}
                        <div className={`flex-1 overflow-auto ${isDark ? 'bg-[#0f172a]' : 'bg-slate-50/50'}`}>
                            {error ? (
                                <div className="h-full flex items-center justify-center p-6">
                                    <div className={`max-w-md w-full p-5 rounded-xl border flex gap-3 ${isDark ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className={`text-sm font-semibold mb-1 ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>Query Error</h4>
                                            <p className={`text-xs font-mono break-words leading-relaxed ${isDark ? 'text-rose-300/80' : 'text-rose-600/90'}`}>{error}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : results && results.length > 0 ? (
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead className={`sticky top-0 z-10 ${isDark ? 'bg-slate-900 shadow-sm' : 'bg-white shadow-sm'}`}>
                                        <tr>
                                            <th className={`px-4 py-2 text-[10px] font-semibold tracking-wider text-center border-b ${isDark ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-200'} w-12`}>#</th>
                                            {Object.keys(results[0]).map(col => (
                                                <th key={col} className={`px-4 py-2 text-xs font-medium border-b ${isDark ? 'text-slate-300 border-slate-800' : 'text-slate-700 border-slate-200'}`}>
                                                    <div className="flex flex-col">
                                                        <span>{col}</span>
                                                        {columnTypes && columnTypes.find(c => c.name === col) && (
                                                            <span className={`text-[9px] font-mono mt-0.5 ${isDark ? 'text-indigo-400/70' : 'text-indigo-500/70'}`}>
                                                                {columnTypes.find(c => c.name === col).type.toLowerCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs">
                                        {results.map((row, i) => (
                                            <tr key={i} className={`group border-b transition-colors ${isDark ? 'border-slate-800/60 hover:bg-slate-800/30' : 'border-slate-200 hover:bg-blue-50/50'}`}>
                                                <td className={`px-4 py-2 text-[10px] font-medium text-center ${isDark ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-400 group-hover:text-slate-500'}`}>{i + 1}</td>
                                                {Object.keys(results[0]).map(col => (
                                                    <td key={col} className={`px-4 py-2 font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                        {row[col] === null ? <span className={`italic text-[10px] ${isDark ? 'text-rose-400/50' : 'text-rose-500/50'}`}>NULL</span> : String(row[col])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800/50 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Database className="w-8 h-8" />
                                    </div>
                                    <h4 className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>No Data</h4>
                                    <p className={`text-xs max-w-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                        {isInitialLoading ? "Executing test connection..." : "Run a query to see the results here."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestConsole;
