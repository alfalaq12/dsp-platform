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
    const itemsPerPage = 16; // As per high-density reference

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

    return (
        <div className="space-y-4">
            {/* High Density Header Section (Based on Image 1) */}
            <div className={`p-6 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex flex-col md:flex-row md:items-end justify-end gap-4 mb-6">
                    <div className="space-y-4 max-w-md w-full">
                        <div className="flex items-center gap-4">
                            <label className={`text-sm font-medium w-24 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Search 1 :</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`flex-1 px-3 py-1.5 rounded border focus:ring-1 focus:ring-blue-500 outline-none transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-yellow-50 border-slate-300 shadow-inner'}`}
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <label className={`text-sm font-medium w-24 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Search 2 :</label>
                            <input
                                type="text"
                                value={searchTerm2}
                                onChange={(e) => setSearchTerm2(e.target.value)}
                                className={`flex-1 px-3 py-1.5 rounded border focus:ring-1 focus:ring-blue-500 outline-none transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-yellow-50 border-slate-300 shadow-inner'}`}
                            />
                        </div>
                        <div className="pl-28">
                            <button className={`px-6 py-1 rounded border font-medium text-sm transition-all ${isDark ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'}`}>
                                Search
                            </button>
                        </div>
                    </div>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2 mb-4 text-xs font-mono">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>[ </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={`hover:text-blue-500 ${currentPage === 1 ? 'opacity-30 pointer-events-none' : ''}`}
                    >
                        <ChevronLeft className="w-3 h-3" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`${currentPage === i + 1 ? 'text-red-500 font-bold underline' : 'hover:text-blue-500'}`}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={`hover:text-blue-500 ${currentPage === totalPages ? 'opacity-30 pointer-events-none' : ''}`}
                    >
                        <ChevronRight className="w-3 h-3" />
                    </button>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}> &gt; Goto page </span>
                    <input
                        type="number"
                        value={currentPage}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 0 && val <= totalPages) setCurrentPage(val);
                        }}
                        className={`w-10 px-1 py-0.5 border text-center ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-yellow-50 border-slate-300'}`}
                    />
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}> of {totalPages} ]</span>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs font-medium border-collapse">
                        <thead>
                            <tr className={`border-b ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-800 text-white border-slate-300'}`}>
                                <th className="px-2 py-2 text-center border-r w-8"></th>
                                <th className="px-4 py-2 text-left border-r w-20">ID</th>
                                <th className="px-4 py-2 text-left border-r">Name</th>
                                <th className="px-4 py-2 text-left border-r w-32">Group</th>
                                <th className="px-4 py-2 text-left w-32">Creator</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                            {paginatedSchemas.map((schema, idx) => (
                                <tr
                                    key={schema.id}
                                    className={`group cursor-pointer hover:bg-blue-500/10 transition-colors ${idx % 2 === 0 ? (isDark ? 'bg-slate-800/20' : 'bg-white') : (isDark ? 'bg-slate-800/40' : 'bg-slate-100')}`}
                                    onClick={() => onView(schema)}
                                >
                                    <td className="px-2 py-1.5 text-center border-r">
                                        <input
                                            type="radio"
                                            name="selectedSchema"
                                            className="w-3 h-3 cursor-pointer"
                                            onChange={() => onView(schema)}
                                        />
                                    </td>
                                    <td className="px-4 py-1.5 border-r font-mono text-slate-500">{schema.id}</td>
                                    <td className="px-4 py-1.5 border-r">
                                        <div className="flex items-center gap-2">
                                            {getSourceIcon(schema.source_type)}
                                            <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{schema.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-1.5 border-r text-slate-500">admin</td>
                                    <td className="px-4 py-1.5 text-slate-500">administrator</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                    <button
                        onClick={onNew}
                        className={`px-4 py-1.5 rounded border text-sm font-medium transition-all ${isDark ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 shadow-sm'}`}
                    >
                        New Schema
                    </button>
                    <button
                        onClick={onDuplicate}
                        className={`px-4 py-1.5 rounded border text-sm font-medium transition-all ${isDark ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 shadow-sm'}`}
                    >
                        Duplicate
                    </button>
                    <button
                        onClick={onEdit}
                        className={`px-4 py-1.5 rounded border text-sm font-medium transition-all ${isDark ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 shadow-sm'}`}
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => onView(null)}
                        className={`px-4 py-1.5 rounded border text-sm font-medium transition-all ${isDark ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 shadow-sm'}`}
                    >
                        View
                    </button>
                    <button
                        onClick={onDelete}
                        className={`px-4 py-1.5 rounded border text-sm font-medium transition-all ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 shadow-sm'}`}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SchemaTable;
