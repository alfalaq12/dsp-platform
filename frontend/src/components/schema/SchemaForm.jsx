import React, { useState, useEffect } from 'react';
import {
    Save, X, Plus, Trash2, Database, Table, Code,
    ChevronDown, ChevronUp, Info, Copy, Clipboard,
    ArrowRight, Settings, MessageSquare, Terminal, Search
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const SchemaForm = ({
    schema,
    onSave,
    onCancel,
    isNew = false
}) => {
    const { isDark } = useTheme();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        source_type: 'query', // 'query' for SQL, 'javascript' for JS
        rules: []
    });

    useEffect(() => {
        if (schema) {
            setFormData({
                id: schema.id,
                name: schema.name || '',
                description: schema.description || '',
                source_type: schema.source_type || 'query',
                rules: schema.rules || []
            });
        }
    }, [schema]);

    const addRule = () => {
        setFormData(prev => ({
            ...prev,
            rules: [
                ...prev.rules,
                {
                    source_query: '',
                    target_table: '',
                    truncate: false,
                    extract_pre_query: '',
                    extract_post_query: '',
                    upload_pre_query: '',
                    upload_post_query: '',
                    notes: ''
                }
            ]
        }));
    };

    const removeRule = (idx) => {
        setFormData(prev => ({
            ...prev,
            rules: prev.rules.filter((_, i) => i !== idx)
        }));
    };

    const handleRuleChange = (idx, field, value) => {
        setFormData(prev => {
            const newRules = [...prev.rules];
            newRules[idx] = { ...newRules[idx], [field]: value };
            return { ...prev, rules: newRules };
        });
    };

    const handleSave = () => {
        if (!formData.name) {
            alert('Schema name is required');
            return;
        }
        onSave(formData);
    };

    return (
        <div className={`flex flex-col h-full bg-transparent overflow-hidden ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {/* Header / Toolbar */}
            <div className={`p-4 flex items-center justify-between border-b ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-300 shadow-sm'}`}>
                <div className="flex items-center gap-4">
                    <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                        <Settings className="w-4 h-4 text-blue-500" />
                        {isNew ? 'Create New Schema' : `Edit Schema: ${formData.name}`}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-all shadow-lg active:scale-95"
                    >
                        <Save className="w-4 h-4" />
                        SAVE
                    </button>
                    <button
                        onClick={onCancel}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 border' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 border text-slate-700 shadow-sm'}`}
                    >
                        <X className="w-4 h-4" />
                        CANCEL
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto p-4 lg:p-6 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">

                    {/* Left 3 Columns: Configuration and Rules */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Summary Section (High Density) */}
                        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-300 shadow-sm'}`}>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">ID No.</label>
                                    <input
                                        type="text"
                                        value={formData.id || '- AUTO -'}
                                        disabled
                                        className={`w-full px-3 py-1.5 rounded border text-sm font-mono ${isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-500'}`}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Schema Name</label>
                                    <input
                                        type="text"
                                        placeholder="E.g., CORE_SYNC_PRODUCTION"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full px-3 py-1.5 rounded border text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-400 text-slate-900 focus:bg-white'}`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Schema Type</label>
                                    <div className={`flex p-1 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                                        <button
                                            onClick={() => setFormData({ ...formData, source_type: 'query' })}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[10px] font-bold transition-all ${formData.source_type === 'query' ? (isDark ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-900 shadow-sm border border-slate-200') : 'text-slate-500 hover:text-slate-400'}`}
                                        >
                                            <Database className="w-3 h-3" />
                                            SQL
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, source_type: 'javascript' })}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[10px] font-bold transition-all ${formData.source_type === 'javascript' ? 'bg-yellow-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                                        >
                                            <Code className="w-3 h-3" />
                                            JavaScript
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {formData.source_type === 'javascript' ? (
                            /* JavaScript Script List View */
                            <div className="space-y-4">
                                <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-300 shadow-sm'}`}>
                                    <div className="flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-blue-500" />
                                        <span className="text-sm font-bold uppercase tracking-wider">Scripts</span>
                                    </div>
                                    <button
                                        onClick={addRule}
                                        className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${isDark ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                    >
                                        Add Script
                                    </button>
                                </div>

                                {formData.rules.map((rule, idx) => (
                                    <div key={idx} className={`rounded-xl border border-2 overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-400 shadow-md'}`}>
                                        <div className={`px-4 py-2 border-b-2 flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-white'}`}>
                                                    {idx + 1}
                                                </div>
                                                <span className={`text-xs font-bold uppercase ${isDark ? 'text-slate-500' : 'text-slate-800'}`}>Script {idx + 1}</span>
                                            </div>
                                            <button
                                                onClick={() => removeRule(idx)}
                                                className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-0">
                                            <div className="relative font-mono text-sm">
                                                <div className={`absolute left-0 top-0 bottom-0 w-10 flex flex-col items-center pt-4 text-[10px] font-bold ${isDark ? 'bg-slate-800/50 text-slate-600' : 'bg-slate-200/50 text-slate-500'}`}>
                                                    {[...Array(10)].map((_, i) => <span key={i} className="leading-[20px]">{i + 1}</span>)}
                                                </div>
                                                <textarea
                                                    rows="10"
                                                    value={rule.source_query}
                                                    onChange={(e) => handleRuleChange(idx, 'source_query', e.target.value)}
                                                    className={`w-full pl-12 pr-4 pt-4 bg-[#1a1b26] text-[#a9b1d6] outline-none font-mono resize-y min-h-[200px] leading-[20px] transition-all selection:bg-blue-500/30`}
                                                    placeholder="// Type your JavaScript code here...
let rows = $GT.query('SELECT * FROM users');
$GT.response(rows);"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {formData.rules.length === 0 && (
                                    <div className={`py-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-slate-800/20 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                        <Code className="w-8 h-8 opacity-20" />
                                        <p className="text-sm italic">No scripts added. Click "Add Script" to begin.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* SQL Rules Table Section */
                            <div className={`rounded-xl border flex flex-col h-[500px] ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-300 shadow-sm'}`}>
                                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={addRule}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Extract Command
                                        </button>
                                        <button className={`flex items-center gap-1.5 px-3 py-1 rounded border text-[10px] font-bold uppercase transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'}`}>
                                            <Search className="w-3 h-3" />
                                            Search Table
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-1 hover:text-blue-500 transition-colors"><Copy className="w-4 h-4" /></button>
                                        <button className="p-1 hover:text-blue-500 transition-colors"><Clipboard className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-[11px] font-medium border-collapse min-w-[1200px]">
                                        <thead className={`sticky top-0 z-10 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                                            <tr>
                                                <th className="px-3 py-2 text-left border-r border-slate-700/50 w-8">#</th>
                                                <th className="px-3 py-2 text-left border-r border-slate-700/50">Source SQL Extraction</th>
                                                <th className="px-3 py-2 text-left border-r border-slate-700/50 w-40">DTBN (Target Table)</th>
                                                <th className="px-3 py-2 text-center border-r border-slate-700/50 w-16">Trunc</th>
                                                <th className="px-3 py-2 text-left border-r border-slate-700/50 w-24">Ext Pre</th>
                                                <th className="px-3 py-2 text-left border-r border-slate-700/50 w-24">Ext Post</th>
                                                <th className="px-3 py-2 text-left border-r border-slate-700/50 w-24">Upld Pre</th>
                                                <th className="px-3 py-2 text-left border-r border-slate-700/50 w-24">Upld Post</th>
                                                <th className="px-3 py-2 text-center w-16">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-200'}`}>
                                            {(formData.rules || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="py-20 text-center text-slate-500 italic">
                                                        No extraction rules added. Click "Add Extract Command" to begin.
                                                    </td>
                                                </tr>
                                            ) : (
                                                (formData.rules || []).map((rule, idx) => (
                                                    <tr key={idx} className={isDark ? 'hover:bg-slate-700/20' : 'hover:bg-blue-50'}>
                                                        <td className="px-3 py-1 border-r border-slate-200 dark:border-slate-800 text-center text-slate-500">{idx + 1}</td>
                                                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-800">
                                                            <textarea
                                                                rows="1"
                                                                value={rule.source_query}
                                                                onChange={(e) => handleRuleChange(idx, 'source_query', e.target.value)}
                                                                className={`w-full px-2 py-1 rounded bg-transparent outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-none transition-all ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                                                                placeholder="SELECT * FROM my_table ..."
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-800">
                                                            <input
                                                                type="text"
                                                                value={rule.target_table}
                                                                onChange={(e) => handleRuleChange(idx, 'target_table', e.target.value)}
                                                                className={`w-full px-2 py-1 rounded bg-transparent outline-none focus:ring-1 focus:ring-blue-500 transition-all ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-800 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={rule.truncate}
                                                                onChange={(e) => handleRuleChange(idx, 'truncate', e.target.checked)}
                                                                className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                                                            />
                                                        </td>
                                                        {['extract_pre_query', 'extract_post_query', 'upload_pre_query', 'upload_post_query'].map(field => (
                                                            <td key={field} className="px-2 py-1 border-r border-slate-200 dark:border-slate-800">
                                                                <input
                                                                    type="text"
                                                                    value={rule[field]}
                                                                    onChange={(e) => handleRuleChange(idx, field, e.target.value)}
                                                                    className={`w-full px-2 py-1 rounded bg-transparent outline-none focus:ring-1 focus:ring-blue-500 transition-all ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-2 py-1 text-center">
                                                            <button
                                                                onClick={() => removeRule(idx)}
                                                                className="p-1 px-2.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Notes & Sidebar */}
                    <div className="space-y-6">
                        <div className={`p-4 rounded-xl border flex flex-col h-full ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-300 shadow-sm'}`}>
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                                <MessageSquare className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs font-bold uppercase tracking-wider">Instructions / Notes</span>
                            </div>
                            <textarea
                                className={`flex-1 w-full bg-transparent outline-none text-[11px] leading-relaxed resize-none transition-all ${isDark ? 'text-slate-400' : 'text-slate-900 font-medium'}`}
                                placeholder="Write additional synchronization logic, schema dependencies, or operational notes here..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                    <span>RULES COUNT:</span>
                                    <span className="text-blue-500">{formData.rules.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                    <span>SOURCE TYPE:</span>
                                    <select
                                        className="bg-transparent text-blue-500 outline-none cursor-pointer"
                                        value={formData.source_type}
                                        onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                                    >
                                        <option value="query">Database</option>
                                        <option value="api">API Endpoint</option>
                                        <option value="file">Local File</option>
                                        <option value="javascript">Script (JS)</option>
                                    </select>
                                </div>
                                <button
                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold uppercase transition-all ${isDark ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}
                                >
                                    <Terminal className="w-3.5 h-3.5" />
                                    Test Extraction
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Legend / Status Footer */}
            <div className={`px-4 py-2 border-t text-[10px] flex items-center justify-between ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-800 font-bold'}`}>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> DTBN: Direct Table Backend Name</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Ext: Extraction Phase</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Upld: Upload Phase</span>
                </div>
                <div>Status: Editing Schema and Sync Rules</div>
            </div>
        </div>
    );
};

export default SchemaForm;
