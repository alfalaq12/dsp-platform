import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Database } from 'lucide-react';
import { getSchemas, createSchema, updateSchema, deleteSchema } from '../services/api';

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
        try {
            if (editingId) {
                await updateSchema(editingId, formData);
            } else {
                await createSchema(formData);
            }
            loadSchemas();
            resetForm();
        } catch (error) {
            console.error('Failed to save schema:', error);
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

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this schema?')) {
            try {
                await deleteSchema(id);
                loadSchemas();
            } catch (error) {
                console.error('Failed to delete schema:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({ name: '', sql_command: '', target_table: '', description: '' });
        setEditingId(null);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Schema Management</h1>
                    <p className="text-slate-400">Define SQL queries for data synchronization</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                    <Plus className="w-5 h-5" />
                    New Schema
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
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
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">SQL Command</label>
                            <textarea
                                value={formData.sql_command}
                                onChange={(e) => setFormData({ ...formData, sql_command: e.target.value })}
                                rows="4"
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                            >
                                {editingId ? 'Update' : 'Create'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-900 border-b border-slate-700">
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
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                                        <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        No schemas yet. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                schemas.map((schema) => (
                                    <tr key={schema.id} className="hover:bg-slate-700/50 transition">
                                        <td className="px-6 py-4 text-white font-medium">{schema.name}</td>
                                        <td className="px-6 py-4 text-slate-300 font-mono text-sm max-w-md truncate">
                                            {schema.sql_command}
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">{schema.target_table}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(schema)}
                                                    className="p-2 text-blue-400 hover:bg-blue-600/20 rounded-lg transition"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(schema.id)}
                                                    className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition"
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
        </div>
    );
}

export default Schema;
