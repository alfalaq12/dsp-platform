import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Database, Eye, Code } from 'lucide-react';
import { getSchemas, createSchema, updateSchema, deleteSchema } from '../services/api';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';

function Schema() {
    const { isDark } = useTheme();
    const [schemas, setSchemas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        sql_command: '',
        target_table: '',
        description: '',
        // File sync fields
        source_type: 'query', // query, file
        file_format: 'csv',   // csv, xlsx, json
        file_pattern: '',
        unique_key_column: '',
        has_header: true,
        delimiter: ',',
    });

    // New states for enhanced UX
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSchema, setSelectedSchema] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const { toasts, addToast, removeToast } = useToast();
    const userRole = localStorage.getItem('role') || 'viewer';

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        loadSchemas();
    }, []);

    const loadSchemas = async () => {
        try {
            const response = await getSchemas();
            setSchemas(response.data);
        } catch (error) {
            console.error('Failed to load schemas:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingId) {
                await updateSchema(editingId, formData);
                addToast('Schema updated successfully!', 'success');
            } else {
                await createSchema(formData);
                addToast('Schema created successfully!', 'success');
            }
            loadSchemas();
            resetForm();
        } catch (error) {
            console.error('Failed to save schema:', error);
            addToast('Failed to save schema. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (schema) => {
        setFormData({
            name: schema.name,
            sql_command: schema.sql_command || '',
            target_table: schema.target_table,
            description: schema.description || '',
            source_type: schema.source_type || 'query',
            file_format: schema.file_format || 'csv',
            file_pattern: schema.file_pattern || '',
            unique_key_column: schema.unique_key_column || '',
            has_header: schema.has_header !== false,
            delimiter: schema.delimiter || ',',
        });
        setEditingId(schema.id);
        setShowForm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsLoading(true);
        try {
            await deleteSchema(deleteTarget.id);
            addToast(`Schema "${deleteTarget.name}" deleted successfully!`, 'success');
            loadSchemas();
        } catch (error) {
            console.error('Failed to delete schema:', error);
            addToast('Failed to delete schema. Please try again.', 'error');
        } finally {
            setIsLoading(false);
            setDeleteTarget(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', sql_command: '', target_table: '', description: '',
            source_type: 'query', file_format: 'csv', file_pattern: '',
            unique_key_column: '', has_header: true, delimiter: ','
        });
        setEditingId(null);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Schema Management</h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Define SQL queries for data synchronization</p>
                </div>
                {userRole === 'admin' && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition shadow-lg shadow-blue-500/20 btn-pulse-glow"
                    >
                        <Plus className="w-5 h-5" />
                        New Schema
                    </button>
                )}
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className={`backdrop-blur-sm border rounded-2xl p-6 modal-scale-in ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                    <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {editingId ? 'Edit Schema' : 'Create New Schema'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                placeholder="Schema Name"
                                required
                            />
                        </div>

                        {/* Source Type Selection */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Source Type</label>
                            <select
                                value={formData.source_type}
                                onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                            >
                                <option value="query">SQL Query (Database)</option>
                                <option value="file">File (FTP/SFTP)</option>
                                <option value="api">API Response (REST API)</option>
                            </select>
                        </div>

                        {/* SQL Query Fields - shown when source_type is 'query' */}
                        {formData.source_type === 'query' && (
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>SQL Command</label>
                                <textarea
                                    value={formData.sql_command}
                                    onChange={(e) => setFormData({ ...formData, sql_command: e.target.value })}
                                    rows="4"
                                    className={`w-full px-4 py-3 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="SELECT * FROM users WHERE..."
                                    required
                                />
                            </div>
                        )}

                        {/* API Response Info - shown when source_type is 'api' */}
                        {formData.source_type === 'api' && (
                            <div className={`border-t pt-4 mt-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <div className={`border rounded-xl p-4 ${isDark ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'}`}>
                                    <h3 className={`font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        API Response Configuration
                                    </h3>
                                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        API endpoint dan authentication dikonfigurasi di <span className={`font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Network</span> dengan Source Type "REST API".
                                        Response akan otomatis di-parse sebagai JSON.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* File Sync Fields - shown when source_type is 'file' */}
                        {formData.source_type === 'file' && (
                            <div className={`border-t pt-4 mt-2 space-y-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    File Configuration
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>File Format</label>
                                        <select
                                            value={formData.file_format}
                                            onChange={(e) => setFormData({ ...formData, file_format: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                        >
                                            <option value="csv">CSV</option>
                                            <option value="txt">TXT (Text File)</option>
                                            <option value="xlsx">Excel (.xlsx)</option>
                                            <option value="json">JSON</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>File Pattern</label>
                                        <input
                                            type="text"
                                            value={formData.file_pattern}
                                            onChange={(e) => setFormData({ ...formData, file_pattern: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                            placeholder="data.csv atau *.csv"
                                        />
                                    </div>
                                    {(formData.file_format === 'csv' || formData.file_format === 'txt') && (
                                        <>
                                            <div>
                                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Delimiter</label>
                                                <select
                                                    value={formData.delimiter}
                                                    onChange={(e) => setFormData({ ...formData, delimiter: e.target.value })}
                                                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                >
                                                    <option value=",">Comma (,)</option>
                                                    <option value=";">Semicolon (;)</option>
                                                    <option value="\t">Tab</option>
                                                    <option value="|">Pipe (|)</option>
                                                </select>
                                                {formData.file_format === 'txt' && (
                                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Jika file tidak terstruktur, setiap baris akan jadi 1 record</p>
                                                )}
                                            </div>
                                            <div className="flex items-center">
                                                <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.has_header}
                                                        onChange={(e) => setFormData({ ...formData, has_header: e.target.checked })}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                                    />
                                                    File has header row
                                                </label>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Target Table</label>
                            <input
                                type="text"
                                value={formData.target_table}
                                onChange={(e) => setFormData({ ...formData, target_table: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                placeholder="sync_users"
                                required
                            />
                        </div>

                        {/* Unique Key Column for Upsert */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Unique Key Column (for Upsert)</label>
                            <input
                                type="text"
                                value={formData.unique_key_column}
                                onChange={(e) => setFormData({ ...formData, unique_key_column: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                placeholder="id atau email (kosongkan untuk insert biasa)"
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Column untuk menentukan apakah data di-update atau insert baru</p>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Description (Optional)</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                placeholder="Brief description of this schema"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                            >
                                {isSubmitting && <span className="spinner-border"></span>}
                                {editingId ? 'Update' : 'Create'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Schemas Table */}
            <div className={`backdrop-blur-sm border rounded-2xl overflow-hidden transition-all duration-300 ${isDark
                ? 'bg-slate-800/80 border-slate-700 border-l-4 border-l-blue-500'
                : 'bg-gradient-to-br from-white to-blue-50 border-slate-200 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md'
                }`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className={isDark ? 'bg-slate-900/50 border-b border-slate-700' : 'bg-slate-50 border-b border-slate-100'}>
                            <tr>
                                <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Name
                                </th>
                                <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    SQL Command
                                </th>
                                <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Target Table
                                </th>
                                <th className={`px-6 py-4 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                            {schemas.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className={`px-6 py-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No schemas yet. Create one to get started.</p>
                                    </td>
                                </tr>
                            ) : (
                                schemas
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((schema) => (
                                        <tr key={schema.id} className={`transition ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-6 py-4 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{schema.name}</td>
                                            <td className={`px-6 py-4 font-mono text-sm max-w-md ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                                <div className="truncate" title={schema.sql_command}>
                                                    {schema.sql_command}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                                    {schema.target_table}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setSelectedSchema(schema)}
                                                        className="action-btn action-btn-view"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {userRole === 'admin' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(schema)}
                                                                className="action-btn action-btn-edit"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(schema)}
                                                                className="action-btn action-btn-delete"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {schemas.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalItems={schemas.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                )}
            </div>

            {/* View Detail Modal */}
            <ViewModal
                isOpen={!!selectedSchema}
                onClose={() => setSelectedSchema(null)}
                title="Schema Details"
            >
                {selectedSchema && (
                    <div className="space-y-4">
                        <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-100'}`}>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>#{selectedSchema.id}</span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Name</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedSchema.name}</span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between items-center">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Target Table</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                    {selectedSchema.target_table}
                                </span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Description</span>
                                <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedSchema.description || '-'}</span>
                            </div>
                            <div className="detail-row flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Created At</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {selectedSchema.created_at ? new Date(selectedSchema.created_at).toLocaleString('id-ID') : '-'}
                                </span>
                            </div>
                        </div>

                        <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-100'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Code className="w-4 h-4 text-blue-400" />
                                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>SQL Command</span>
                            </div>
                            <pre className={`rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white border border-slate-200 text-slate-800'}`}>
                                {selectedSchema.sql_command}
                            </pre>
                        </div>
                    </div>
                )}
            </ViewModal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Schema"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                isLoading={isLoading}
            />
        </div>
    );
}

export default Schema;
