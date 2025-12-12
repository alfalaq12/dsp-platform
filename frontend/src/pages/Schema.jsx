import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Database, Eye, Code } from 'lucide-react';
import { getSchemas, createSchema, updateSchema, deleteSchema } from '../services/api';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';

function Schema() {
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
                    <h1 className="text-3xl font-bold text-white mb-2">Schema Management</h1>
                    <p className="text-slate-400">Define SQL queries for data synchronization</p>
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
                <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 modal-scale-in">
                    <h2 className="text-xl font-semibold text-white mb-4">
                        {editingId ? 'Edit Schema' : 'Create New Schema'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="Schema Name"
                                required
                            />
                        </div>

                        {/* Source Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Source Type</label>
                            <select
                                value={formData.source_type}
                                onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            >
                                <option value="query">SQL Query (Database)</option>
                                <option value="file">File (FTP/SFTP)</option>
                            </select>
                        </div>

                        {/* SQL Query Fields - shown when source_type is 'query' */}
                        {formData.source_type === 'query' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">SQL Command</label>
                                <textarea
                                    value={formData.sql_command}
                                    onChange={(e) => setFormData({ ...formData, sql_command: e.target.value })}
                                    rows="4"
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    placeholder="SELECT * FROM users WHERE..."
                                    required
                                />
                            </div>
                        )}

                        {/* File Sync Fields - shown when source_type is 'file' */}
                        {formData.source_type === 'file' && (
                            <div className="border-t border-slate-700 pt-4 mt-2 space-y-4">
                                <h3 className="text-md font-semibold text-amber-400 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    File Configuration
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">File Format</label>
                                        <select
                                            value={formData.file_format}
                                            onChange={(e) => setFormData({ ...formData, file_format: e.target.value })}
                                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="csv">CSV</option>
                                            <option value="txt">TXT (Text File)</option>
                                            <option value="xlsx">Excel (.xlsx)</option>
                                            <option value="json">JSON</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">File Pattern</label>
                                        <input
                                            type="text"
                                            value={formData.file_pattern}
                                            onChange={(e) => setFormData({ ...formData, file_pattern: e.target.value })}
                                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            placeholder="data.csv atau *.csv"
                                        />
                                    </div>
                                    {(formData.file_format === 'csv' || formData.file_format === 'txt') && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-1">Delimiter</label>
                                                <select
                                                    value={formData.delimiter}
                                                    onChange={(e) => setFormData({ ...formData, delimiter: e.target.value })}
                                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                >
                                                    <option value=",">Comma (,)</option>
                                                    <option value=";">Semicolon (;)</option>
                                                    <option value="\t">Tab</option>
                                                    <option value="|">Pipe (|)</option>
                                                </select>
                                                {formData.file_format === 'txt' && (
                                                    <p className="text-xs text-slate-500 mt-1">Jika file tidak terstruktur, setiap baris akan jadi 1 record</p>
                                                )}
                                            </div>
                                            <div className="flex items-center">
                                                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
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
                            <label className="block text-sm font-medium text-slate-300 mb-2">Target Table</label>
                            <input
                                type="text"
                                value={formData.target_table}
                                onChange={(e) => setFormData({ ...formData, target_table: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="sync_users"
                                required
                            />
                        </div>

                        {/* Unique Key Column for Upsert */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Unique Key Column (for Upsert)</label>
                            <input
                                type="text"
                                value={formData.unique_key_column}
                                onChange={(e) => setFormData({ ...formData, unique_key_column: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="id atau email (kosongkan untuk insert biasa)"
                            />
                            <p className="text-xs text-slate-500 mt-1">Column untuk menentukan apakah data di-update atau insert baru</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Description (Optional)</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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
            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    SQL Command
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Target Table
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {schemas.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                                        <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No schemas yet. Create one to get started.</p>
                                    </td>
                                </tr>
                            ) : (
                                schemas.map((schema) => (
                                    <tr key={schema.id} className="hover:bg-slate-700/30 transition">
                                        <td className="px-6 py-4 text-white font-medium">{schema.name}</td>
                                        <td className="px-6 py-4 text-slate-300 font-mono text-sm max-w-md">
                                            <div className="truncate" title={schema.sql_command}>
                                                {schema.sql_command}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
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
            </div>

            {/* View Detail Modal */}
            <ViewModal
                isOpen={!!selectedSchema}
                onClose={() => setSelectedSchema(null)}
                title="Schema Details"
            >
                {selectedSchema && (
                    <div className="space-y-4">
                        <div className="bg-slate-800/50 rounded-xl p-4">
                            <div className="detail-row">
                                <span className="detail-label">ID</span>
                                <span className="detail-value">#{selectedSchema.id}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Name</span>
                                <span className="detail-value">{selectedSchema.name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Target Table</span>
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                                    {selectedSchema.target_table}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Description</span>
                                <span className="detail-value">{selectedSchema.description || '-'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Created At</span>
                                <span className="detail-value">
                                    {selectedSchema.created_at ? new Date(selectedSchema.created_at).toLocaleString('id-ID') : '-'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Code className="w-4 h-4 text-blue-400" />
                                <span className="text-sm font-medium text-slate-300">SQL Command</span>
                            </div>
                            <pre className="bg-slate-900 rounded-lg p-4 text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
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
