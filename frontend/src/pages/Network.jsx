import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Network as NetworkIcon, Circle, Eye, Loader2 } from 'lucide-react';
import { getNetworks, createNetwork, updateNetwork, deleteNetwork } from '../services/api';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';

function Network() {
    const [networks, setNetworks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        ip_address: '',
        type: 'source',
        db_driver: 'postgres',
        db_host: '',
        db_port: '5432',
        db_user: '',
        db_password: '',
        db_name: '',
        db_sslmode: 'disable',
    });

    // New states for enhanced UX
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const { toasts, addToast, removeToast } = useToast();

    useEffect(() => {
        loadNetworks();
        const interval = setInterval(loadNetworks, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadNetworks = async () => {
        try {
            const response = await getNetworks();
            setNetworks(response.data);
        } catch (error) {
            console.error('Failed to load networks:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingId) {
                await updateNetwork(editingId, formData);
                addToast('Network updated successfully!', 'success');
            } else {
                await createNetwork(formData);
                addToast('Network created successfully!', 'success');
            }
            loadNetworks();
            resetForm();
        } catch (error) {
            console.error('Failed to save network:', error);
            addToast('Failed to save network. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (network) => {
        setFormData({
            name: network.name,
            ip_address: network.ip_address,
            type: network.type,
            db_driver: network.db_driver || 'postgres',
            db_host: network.db_host || '',
            db_port: network.db_port || '5432',
            db_user: network.db_user || '',
            db_password: network.db_password || '',
            db_name: network.db_name || '',
            db_sslmode: network.db_sslmode || 'disable',
        });
        setEditingId(network.id);
        setShowForm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsLoading(true);
        try {
            await deleteNetwork(deleteTarget.id);
            addToast(`Network "${deleteTarget.name}" deleted successfully!`, 'success');
            loadNetworks();
        } catch (error) {
            console.error('Failed to delete network:', error);
            addToast('Failed to delete network. Please try again.', 'error');
        } finally {
            setIsLoading(false);
            setDeleteTarget(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', ip_address: '', type: 'source',
            db_driver: 'postgres', db_host: '', db_port: '5432',
            db_user: '', db_password: '', db_name: '', db_sslmode: 'disable'
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
                    <h1 className="text-3xl font-bold text-white mb-2">Network Management</h1>
                    <p className="text-slate-400">Manage data sources and targets</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl transition shadow-lg shadow-purple-500/20 btn-pulse-glow"
                >
                    <Plus className="w-5 h-5" />
                    New Network
                </button>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 modal-scale-in">
                    <h2 className="text-xl font-semibold text-white mb-4">
                        {editingId ? 'Edit Network' : 'Create New Network'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="Network Name"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">IP Address</label>
                            <input
                                type="text"
                                value={formData.ip_address}
                                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="192.168.1.1"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                            >
                                <option value="source">Source</option>
                                <option value="target">Target</option>
                            </select>
                        </div>

                        {/* Source Database Configuration */}
                        <div className="border-t border-slate-700 pt-4 mt-4">
                            <h3 className="text-md font-semibold text-slate-200 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                </svg>
                                Source Database Configuration
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">Configure the database that this agent will sync data from</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Driver</label>
                                    <select
                                        value={formData.db_driver}
                                        onChange={(e) => setFormData({ ...formData, db_driver: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="postgres">PostgreSQL</option>
                                        <option value="mysql">MySQL</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Host</label>
                                    <input
                                        type="text"
                                        value={formData.db_host}
                                        onChange={(e) => setFormData({ ...formData, db_host: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="localhost"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
                                    <input
                                        type="text"
                                        value={formData.db_port}
                                        onChange={(e) => setFormData({ ...formData, db_port: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="5432"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={formData.db_user}
                                        onChange={(e) => setFormData({ ...formData, db_user: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="postgres"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={formData.db_password}
                                        onChange={(e) => setFormData({ ...formData, db_password: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Database Name</label>
                                    <input
                                        type="text"
                                        value={formData.db_name}
                                        onChange={(e) => setFormData({ ...formData, db_name: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="mydb"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
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

            {/* Networks Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {networks.map((network) => (
                    <div
                        key={network.id}
                        className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 card-hover"
                    >
                        <div className="flex justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{network.name}</h3>
                                <p className="text-sm text-slate-400">{network.ip_address}</p>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setSelectedNetwork(network)}
                                    className="action-btn action-btn-view"
                                    title="View Details"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleEdit(network)}
                                    className="action-btn action-btn-edit"
                                    title="Edit"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(network)}
                                    className="action-btn action-btn-delete"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                            <span className="text-sm text-slate-400">Status</span>
                            <span className={`flex items-center gap-2 text-sm font-medium ${network.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                                <Circle className="w-2 h-2 fill-current" />
                                {network.status || 'Unknown'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-3">
                            <span className="text-sm text-slate-400">Type</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${network.type === 'source' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                {network.type}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {networks.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <NetworkIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No networks yet. Create one to get started.</p>
                </div>
            )}

            {/* View Detail Modal */}
            <ViewModal
                isOpen={!!selectedNetwork}
                onClose={() => setSelectedNetwork(null)}
                title="Network Details"
            >
                {selectedNetwork && (
                    <div className="space-y-4">
                        <div className="bg-slate-800/50 rounded-xl p-4">
                            <div className="detail-row">
                                <span className="detail-label">ID</span>
                                <span className="detail-value">#{selectedNetwork.id}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Name</span>
                                <span className="detail-value">{selectedNetwork.name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">IP Address</span>
                                <span className="detail-value font-mono">{selectedNetwork.ip_address}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Type</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${selectedNetwork.type === 'source' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {selectedNetwork.type}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Status</span>
                                <span className={`flex items-center gap-2 ${selectedNetwork.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    <Circle className="w-2 h-2 fill-current" />
                                    {selectedNetwork.status || 'Unknown'}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Created At</span>
                                <span className="detail-value">
                                    {selectedNetwork.created_at ? new Date(selectedNetwork.created_at).toLocaleString('id-ID') : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </ViewModal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Network"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                isLoading={isLoading}
            />
        </div>
    );
}

export default Network;
