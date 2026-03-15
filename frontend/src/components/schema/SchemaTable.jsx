import React, { useState } from 'react';
import {
    Search, Filter, Plus, Edit, Trash2, Copy, Eye,
    MoreVertical, ChevronLeft, ChevronRight, Database,
    FileSpreadsheet, Code, Terminal, ArrowRight
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const SchemaTable = ({
    schemas,
    onEdit,
    onDelete,
    onDuplicate,
    onView,
    onNew,
    onImport,
    userRole
}) => {
    const { isDark } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchTerm2, setSearchTerm2] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState([]);
    const itemsPerPage = 16; 

    const safeSchemas = Array.isArray(schemas) ? schemas : [];
    const filteredSchemas = safeSchemas.filter(s =>
        (s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.target_table?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (searchTerm2 === '' || s.description?.toLowerCase().includes(searchTerm2.toLowerCase()))
    );

    const totalPages = Math.ceil(filteredSchemas.length / itemsPerPage);
    const paginatedSchemas = filteredSchemas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getSourceIcon = (type) => {
        switch (type) {
            case 'javascript': return <Code className="w-4 h-4 text-yellow-500" />;
            case 'file': return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
            case 'api': return <Terminal className="w-4 h-4 text-cyan-500" />;
            default: return <Database className="w-4 h-4 text-blue-500" />;
        }
    };

    // Dummy data for visual demonstration as requested
    const dummyData = [
        { id: 1, name: 'User Transactions', group: 'Finance', creator: 'John Doe', source_type: 'database' },
        { id: 2, name: 'Inventory Logs', group: 'Logistics', creator: 'Jane Smith', source_type: 'database' },
        { id: 3, name: 'Customer Profiles', group: 'CRM', creator: 'Admin', source_type: 'database' }
    ];

    const displaySchemas = safeSchemas.length > 0 ? paginatedSchemas : dummyData;

    const toggleSelectAll = () => {
        if (selectedIds.length === displaySchemas.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(displaySchemas.map(s => s.id));
        }
    };

    const toggleSelectRow = (id, e) => {
        e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getSelectedSchema = () => displaySchemas.find(s => s.id === selectedIds[0]);
    const getSelectedSchemas = () => displaySchemas.filter(s => selectedIds.includes(s.id));

    return (
        <div className={`flex flex-col h-full ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b`}>
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.length === displaySchemas.length && displaySchemas.length > 0}
                                    onChange={toggleSelectAll}
                                    className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${isDark ? 'bg-slate-700 border-slate-600' : ''}`} 
                                />
                            </th>
                            <th className={`px-6 py-4 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>ID</th>
                            <th className={`px-6 py-4 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Name</th>
                            <th className={`px-6 py-4 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Group</th>
                            <th className={`px-6 py-4 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Creator</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {displaySchemas.map((schema, idx) => (
                            <tr 
                                key={schema.id} 
                                className={`transition-all cursor-pointer ${
                                    selectedIds.includes(schema.id) 
                                        ? (isDark ? 'bg-blue-900/30' : 'bg-blue-50/50') 
                                        : (isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50')
                                }`}
                                onClick={(e) => toggleSelectRow(schema.id, e)}
                            >
                                <td className="px-6 py-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(schema.id)}
                                        onChange={(e) => toggleSelectRow(schema.id, e)}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${isDark ? 'bg-slate-700 border-slate-600' : ''}`} 
                                    />
                                </td>
                                <td className={`px-6 py-4 font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>#{schema.id}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                            <Database className="w-4 h-4" />
                                        </div>
                                        <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{schema.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                        {schema.group || 'General'}
                                    </span>
                                </td>
                                <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {schema.creator || 'System'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Bottom Action Bar */}
            <div className={`p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => onDuplicate(getSelectedSchema())}
                        disabled={selectedIds.length !== 1}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDark 
                                ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Copy className="w-4 h-4" />
                        Duplicate
                    </button>
                    <button
                        onClick={() => onEdit(getSelectedSchema())}
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
                        onClick={() => onView(getSelectedSchema())}
                        disabled={selectedIds.length !== 1}
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
                        onClick={() => {
                            onDelete(getSelectedSchema());
                        }}
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

                <div className="flex items-center gap-4">
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Page <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{currentPage}</span> of <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{totalPages || 1}</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={`p-2 border rounded-xl transition-all shadow-sm disabled:opacity-30 ${
                                isDark 
                                    ? 'border-slate-700 hover:bg-slate-800 text-slate-400' 
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))}
                            disabled={currentPage === (totalPages || 1)}
                            className={`p-2 border rounded-xl transition-all shadow-sm disabled:opacity-30 ${
                                isDark 
                                    ? 'border-slate-700 hover:bg-slate-800 text-slate-400' 
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchemaTable;
