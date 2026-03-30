import React, { useState, useEffect } from 'react';
import {
    Save, X, Plus, Trash2, Database, Table, Code,
    ChevronDown, ChevronUp, Info, Copy, Clipboard, ClipboardPaste,
    ArrowRight, Settings, MessageSquare, Terminal, Search
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNetworks } from '../../hooks/useQueries';

const SchemaForm = ({
    schema,
    onSave,
    onCancel,
    isNew = false
}) => {
    const { isDark } = useTheme();
    const { data: networks = [] } = useNetworks();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        source_type: 'query', // 'query' for SQL, 'javascript' for JS
        owner_id: 1000,
        db_schema: '',
        group: 'General',
        rules: []
    });

    useEffect(() => {
        if (schema) {
            setFormData({
                id: schema.id,
                name: schema.name || '',
                description: schema.description || '',
                source_type: schema.source_type || 'query',
                owner_id: schema.owner_id !== undefined ? Number(schema.owner_id) : 1000,
                db_schema: schema.db_schema || '',
                group: schema.group || 'General',
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

    const handleExportClipboard = () => {
        const json = JSON.stringify(formData, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            alert('Schema configuration copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    };

    const handleImportClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const imported = JSON.parse(text);
            
            // Basic validation
            if (!imported.name && !imported.rules) {
                throw new Error('Invalid schema format');
            }

            setFormData(prev => ({
                ...prev,
                ...imported,
                id: prev.id // Preserve current ID if editing
            }));
            alert('Schema imported from clipboard!');
        } catch (err) {
            console.error('Failed to import:', err);
            alert('Failed to import from clipboard. Please ensure you have valid JSON.');
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto no-scrollbar ${isDark ? 'bg-slate-900 text-slate-200' : 'bg-[#f0f0f0] text-[#333]'}`}>
            {/* Header */}
            <div className={`px-4 py-2 border-b shadow-sm flex items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>
                <h1 className={`text-sm font-black tracking-tighter uppercase italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>SCHEMA</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        className={`px-6 py-1 border text-xs font-bold shadow-sm transition-all hover:opacity-80 active:translate-y-px ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-100 border-slate-400 text-slate-800'}`}
                    >
                        Save
                    </button>
                    <button
                        onClick={onCancel}
                        className={`px-6 py-1 border text-xs font-bold shadow-sm transition-all hover:opacity-80 active:translate-y-px ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-100 border-slate-400 text-slate-800'}`}
                    >
                        Cancel
                    </button>
                </div>
            </div>

            {/* Main Form Area */}
            <div className="p-4 space-y-4 max-w-full overflow-x-hidden">
                {/* Top Section: Properties */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 max-w-4xl">
                    <div className="flex items-center gap-2">
                        <label className={`text-[11px] font-bold w-32 flex-shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>ID</label>
                        <span className={`text-[11px] font-bold mr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>:</span>
                        <input
                            type="text"
                            value={formData.id || '1105'}
                            disabled
                            className={`border px-2 py-0.5 text-[11px] w-24 font-mono shadow-inner ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-400 text-slate-900'}`}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Empty spacer for alignment if needed, or row 1 col 2 */}
                    </div>

                    <div className="flex items-center gap-2">
                        <label className={`text-[11px] font-bold w-32 flex-shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Schema Name</label>
                        <span className={`text-[11px] font-bold mr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>:</span>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={`border px-2 py-0.5 text-[11px] font-bold flex-1 max-w-sm focus:outline-none ${isDark ? 'bg-yellow-900/20 border-slate-700 text-yellow-100' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                        />
                    </div>

                    <div className="flex items-center gap-2 md:row-start-2 md:col-start-2">
                        <label className={`text-[11px] font-bold w-32 flex-shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Group</label>
                        <span className={`text-[11px] font-bold mr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>:</span>
                        <input
                            type="text"
                            value={formData.group}
                            onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                            placeholder="General"
                            className={`border px-2 py-0.5 text-[11px] font-bold flex-1 max-w-sm focus:outline-none ${isDark ? 'bg-yellow-900/20 border-slate-700 text-yellow-100' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                        />
                    </div>

                    <div className="flex items-center gap-2 md:row-start-3">
                        <label className={`text-[11px] font-bold w-32 flex-shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Schema Owner</label>
                        <span className={`text-[11px] font-bold mr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>:</span>
                        <select
                            value={formData.owner_id || ''}
                            onChange={(e) => setFormData({ ...formData, owner_id: Number(e.target.value) })}
                            className={`border px-2 py-0.5 text-[11px] flex-1 max-w-sm appearance-none focus:outline-none ${isDark ? 'bg-yellow-900/20 border-slate-700 text-yellow-100' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1rem' }}
                        >
                            <option value="">-- Select Owner --</option>
                            {networks.map(node => (
                                <option key={node.id} value={node.id}>
                                    {node.id} - {node.agent_name || node.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 md:row-start-4">
                        <label className={`text-[11px] font-bold w-32 flex-shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Database Schema</label>
                        <span className={`text-[11px] font-bold mr-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>:</span>
                        <input
                            type="text"
                            value={formData.db_schema || ''}
                            onChange={(e) => setFormData({ ...formData, db_schema: e.target.value })}
                            className={`border px-2 py-0.5 text-[11px] font-bold flex-1 max-w-sm focus:outline-none ${isDark ? 'bg-yellow-900/20 border-slate-700 text-yellow-100' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                        />
                    </div>

                    <div className="flex items-start gap-2 md:row-start-5 md:col-span-2">
                        <label className={`text-[11px] font-bold w-32 flex-shrink-0 mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Notes</label>
                        <span className={`text-[11px] font-bold mr-2 mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>:</span>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className={`border px-2 py-1 text-[11px] flex-1 h-16 max-w-2xl resize-y focus:outline-none ${isDark ? 'bg-yellow-900/20 border-slate-700 text-yellow-100' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                        />
                    </div>
                </div>

                {/* Clipboard Buttons */}
                <div className="flex gap-1 pt-2">
                    <div className="flex gap-1 pt-2">
                    <button 
                        onClick={handleExportClipboard}
                        className={`px-3 py-1 border text-[11px] font-medium flex items-center gap-1 shadow-sm hover:opacity-80 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-200 border-slate-400 text-slate-700'}`}
                    >
                        <Clipboard className="w-3 h-3" />
                        Clipboard Export
                    </button>
                    <button 
                        onClick={handleImportClipboard}
                        className={`px-3 py-1 border text-[11px] font-medium flex items-center gap-1 shadow-sm hover:opacity-80 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-200 border-slate-400 text-slate-700'}`}
                    >
                        <ClipboardPaste className="w-3 h-3" />
                        Clipboard Import
                    </button>
                </div>
                </div>

                {/* Rules Table */}
                <div className={`border shadow-sm overflow-x-auto ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                    <table className="w-full border-collapse text-[11px] min-w-max">
                        <thead className={`${isDark ? 'bg-slate-800 text-slate-200' : 'bg-[#003366] text-white'} font-bold`}>
                            <tr>
                                <th className={`p-1 border w-8 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>
                                    <button 
                                        onClick={addRule}
                                        className={`w-5 h-4 flex items-center justify-center rounded-sm ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-[#333] hover:bg-white'}`}
                                    >
                                        +
                                    </button>
                                </th>
                                <th className={`p-1.5 border text-left ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>Source Query</th>
                                <th className={`p-1.5 border text-left w-32 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>DTBN</th>
                                <th className={`p-1.5 border text-center w-12 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>TRUNC</th>
                                <th className={`p-1.5 border text-left w-40 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>Extract Pre Query</th>
                                <th className={`p-1.5 border text-left w-40 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>Extract Post Query</th>
                                <th className={`p-1.5 border text-left w-40 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>Upload Pre Query</th>
                                <th className={`p-1.5 border text-left w-40 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>Upload Post Query</th>
                                <th className={`p-1.5 border text-left w-40 ${isDark ? 'border-slate-700' : 'border-slate-500'}`}>Notes</th>
                            </tr>
                        </thead>
                        <tbody className={`${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                            {formData.rules.map((rule, idx) => (
                                <tr key={idx}>
                                    <td className={`p-1 border text-center ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <button 
                                            onClick={() => removeRule(idx)}
                                            className={`w-5 h-4 flex items-center justify-center rounded-sm border ${isDark ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-slate-300 border-slate-400 text-[#333] hover:bg-slate-100'}`}
                                        >
                                            -
                                        </button>
                                    </td>
                                    <td className={`p-1 border ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <div className="relative group">
                                            <textarea
                                                rows="2"
                                                value={rule.source_query}
                                                onChange={(e) => handleRuleChange(idx, 'source_query', e.target.value)}
                                                className={`w-full px-1 py-1 text-[11px] font-mono outline-none resize-y border ${isDark ? 'bg-yellow-900/10 border-slate-700 text-yellow-100 placeholder-slate-600' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                                            />
                                            <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className={`p-0.5 border rounded hover:opacity-80 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-300'}`}><ChevronUp className="w-2.5 h-2.5" /></button>
                                                <button className={`p-0.5 border rounded hover:opacity-80 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-300'}`}><ChevronDown className="w-2.5 h-2.5" /></button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`p-1 border ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <textarea
                                            rows="2"
                                            value={rule.target_table}
                                            onChange={(e) => handleRuleChange(idx, 'target_table', e.target.value)}
                                            className={`w-full px-1 py-1 text-[11px] font-mono leading-none resize-none border ${isDark ? 'bg-yellow-900/10 border-slate-700 text-yellow-100 placeholder-slate-600' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                                        />
                                    </td>
                                    <td className={`p-1 border text-center ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <input
                                            type="checkbox"
                                            checked={rule.truncate}
                                            onChange={(e) => handleRuleChange(idx, 'truncate', e.target.checked)}
                                            className="w-3.5 h-3.5 border-slate-500 rounded-sm"
                                        />
                                    </td>
                                    <td className={`p-1 border ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <textarea
                                            rows="2"
                                            value={rule.extract_pre_query}
                                            onChange={(e) => handleRuleChange(idx, 'extract_pre_query', e.target.value)}
                                            className={`w-full px-1 py-1 text-[11px] resize-none border ${isDark ? 'bg-yellow-900/10 border-slate-700 text-yellow-100 placeholder-slate-600' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                                        />
                                    </td>
                                    <td className={`p-1 border ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <textarea
                                            rows="2"
                                            value={rule.extract_post_query}
                                            onChange={(e) => handleRuleChange(idx, 'extract_post_query', e.target.value)}
                                            className={`w-full px-1 py-1 text-[11px] resize-none border ${isDark ? 'bg-yellow-900/10 border-slate-700 text-yellow-100 placeholder-slate-600' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                                        />
                                    </td>
                                    <td className={`p-1 border ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <textarea
                                            rows="2"
                                            value={rule.upload_pre_query}
                                            onChange={(e) => handleRuleChange(idx, 'upload_pre_query', e.target.value)}
                                            className={`w-full px-1 py-1 text-[11px] resize-none border ${isDark ? 'bg-yellow-900/10 border-slate-700 text-yellow-100 placeholder-slate-600' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                                        />
                                    </td>
                                    <td className={`p-1 border ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <textarea
                                            rows="2"
                                            value={rule.upload_post_query}
                                            onChange={(e) => handleRuleChange(idx, 'upload_post_query', e.target.value)}
                                            className={`w-full px-1 py-1 text-[11px] resize-none border ${isDark ? 'bg-yellow-900/10 border-slate-700 text-yellow-100 placeholder-slate-600' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                                        />
                                    </td>
                                    <td className={`p-1 border ${isDark ? 'border-slate-700' : 'border-slate-400'}`}>
                                        <textarea
                                            rows="2"
                                            value={rule.notes}
                                            onChange={(e) => handleRuleChange(idx, 'notes', e.target.value)}
                                            className={`w-full px-1 py-1 text-[11px] resize-none border ${isDark ? 'bg-yellow-900/10 border-slate-700 text-yellow-100 placeholder-slate-600' : 'bg-[#ffffcc] border-slate-600 text-slate-900'}`}
                                        />
                                    </td>
                                </tr>
                            ))}
                            {formData.rules.length === 0 && (
                                <tr>
                                    <td colSpan="9" className={`p-8 text-center italic border ${isDark ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-white text-slate-500 border-slate-300'}`}>
                                        Click [+] above to add a new sync rule.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
};

export default SchemaForm;
