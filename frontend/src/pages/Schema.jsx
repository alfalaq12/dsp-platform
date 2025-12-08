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
    });

    // New states for enhanced UX
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSchema, setSelectedSchema] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const { toasts, addToast, removeToast } = useToast();

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
            sql_command: schema.sql_command,
            target_table: schema.target_table,
            description: schema.description || '',
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
        setFormData({ name: '', sql_command: '', target_table: '', description: '' });
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
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition shadow-lg shadow-blue-500/20 btn-pulse-glow"
                >
                    <Plus className="w-5 h-5" />
                    New Schema
                </button>
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
