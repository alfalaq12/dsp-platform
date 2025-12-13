import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Network as NetworkIcon, Circle, Eye, Loader2, Zap } from 'lucide-react';
import { getNetworks, createNetwork, updateNetwork, deleteNetwork, testNetworkConnection } from '../services/api';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';

function Network() {
    const { isDark } = useTheme();
    const [networks, setNetworks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        ip_address: '',
        type: 'source',
        source_type: 'database', // database, ftp, sftp, api
        // Database fields
        db_driver: 'postgres',
        db_host: '',
        db_port: '5432',
        db_user: '',
        db_password: '',
        db_name: '',
        db_sslmode: 'disable',
        // FTP/SFTP fields
        ftp_host: '',
        ftp_port: '21',
        ftp_user: '',
        ftp_password: '',
        ftp_private_key: '', // SSH private key (PEM format)
        ftp_path: '',
        ftp_passive: true,
        // API fields
        api_url: '',
        api_method: 'GET',
        api_headers: '',
        api_auth_type: 'none',
        api_auth_key: '',
        api_auth_value: '',
        api_body: '',
    });

    // New states for enhanced UX
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [testingNetwork, setTestingNetwork] = useState(null);
    const { toasts, addToast, removeToast } = useToast();
    const userRole = localStorage.getItem('role') || 'viewer';

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

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
            type: network.type || 'source',
            source_type: network.source_type || 'database',
            db_driver: network.db_driver || 'postgres',
            db_host: network.db_host || '',
            db_port: network.db_port || '5432',
            db_user: network.db_user || '',
            db_password: network.db_password || '',
            db_name: network.db_name || '',
            db_sslmode: network.db_sslmode || 'disable',
            ftp_host: network.ftp_host || '',
            ftp_port: network.ftp_port || '21',
            ftp_user: network.ftp_user || '',
            ftp_password: network.ftp_password || '',
            ftp_private_key: network.ftp_private_key || '',
            ftp_path: network.ftp_path || '',
            ftp_passive: network.ftp_passive !== false,
            // API fields
            api_url: network.api_url || '',
            api_method: network.api_method || 'GET',
            api_headers: network.api_headers || '',
            api_auth_type: network.api_auth_type || 'none',
            api_auth_key: network.api_auth_key || '',
            api_auth_value: network.api_auth_value || '',
            api_body: network.api_body || '',
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
            name: '', ip_address: '', type: 'source', source_type: 'database',
            db_driver: 'postgres', db_host: '', db_port: '5432',
            db_user: '', db_password: '', db_name: '', db_sslmode: 'disable',
            ftp_host: '', ftp_port: '21', ftp_user: '', ftp_password: '', ftp_private_key: '', ftp_path: '', ftp_passive: true,
            api_url: '', api_method: 'GET', api_headers: '', api_auth_type: 'none', api_auth_key: '', api_auth_value: '', api_body: ''
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleTestConnection = async (network) => {
        if (!network.db_host) {
            addToast('No database configured for this network', 'warning');
            return;
        }
        try {
            setTestingNetwork(network.id);
            const response = await testNetworkConnection(network.id);
            if (response.data.success) {
                addToast(`Test command sent to agent "${network.name}"`, 'success');
            } else {
                addToast(response.data.error || 'Test failed', 'error');
            }
        } catch (error) {
            console.error('Test failed:', error);
            addToast('Failed to send test command: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setTestingNetwork(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Network Management</h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Manage data sources and targets</p>
                </div>
                {userRole === 'admin' && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl transition shadow-lg shadow-purple-500/20 btn-pulse-glow"
                    >
                        <Plus className="w-5 h-5" />
                        New Network
                    </button>
                )}
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className={`backdrop-blur-sm border rounded-2xl p-6 modal-scale-in ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                    <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {editingId ? 'Edit Network' : 'Create New Network'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                placeholder="Network Name"
                                required
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>IP Address</label>
                            <input
                                type="text"
                                value={formData.ip_address}
                                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                placeholder="192.168.1.1"
                                required
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                            >
                                <option value="source">Source</option>
                                <option value="target">Target</option>
                            </select>
                        </div>

                        {/* Source Type Selection */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Source Type</label>
                            <select
                                value={formData.source_type}
                                onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                            >
                                <option value="database">Database</option>
                                <option value="ftp">FTP</option>
                                <option value="sftp">SFTP</option>
                                <option value="api">REST API</option>
                            </select>
                        </div>

                        {/* Database Configuration - shown when source_type is 'database' */}
                        {formData.source_type === 'database' && (
                            <div className={`border-t pt-4 mt-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                    Database Configuration
                                </h3>
                                <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Configure the database that this agent will sync data from</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Driver</label>
                                        <select
                                            value={formData.db_driver}
                                            onChange={(e) => setFormData({ ...formData, db_driver: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                        >
                                            <option value="postgres">PostgreSQL</option>
                                            <option value="mysql">MySQL</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label>
                                        <input
                                            type="text"
                                            value={formData.db_host}
                                            onChange={(e) => setFormData({ ...formData, db_host: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="localhost"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label>
                                        <input
                                            type="text"
                                            value={formData.db_port}
                                            onChange={(e) => setFormData({ ...formData, db_port: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="5432"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
                                        <input
                                            type="text"
                                            value={formData.db_user}
                                            onChange={(e) => setFormData({ ...formData, db_user: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="postgres"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                                        <input
                                            type="password"
                                            value={formData.db_password}
                                            onChange={(e) => setFormData({ ...formData, db_password: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Database Name</label>
                                        <input
                                            type="text"
                                            value={formData.db_name}
                                            onChange={(e) => setFormData({ ...formData, db_name: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="mydb"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FTP/SFTP Configuration - shown when source_type is 'ftp' or 'sftp' */}
                        {(formData.source_type === 'ftp' || formData.source_type === 'sftp') && (
                            <div className={`border-t pt-4 mt-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    {formData.source_type.toUpperCase()} Configuration
                                </h3>
                                <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Configure the file server that this agent will sync files from</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label>
                                        <input
                                            type="text"
                                            value={formData.ftp_host}
                                            onChange={(e) => setFormData({ ...formData, ftp_host: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="ftp.example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label>
                                        <input
                                            type="text"
                                            value={formData.ftp_port}
                                            onChange={(e) => setFormData({ ...formData, ftp_port: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder={formData.source_type === 'sftp' ? '22' : '21'}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
                                        <input
                                            type="text"
                                            value={formData.ftp_user}
                                            onChange={(e) => setFormData({ ...formData, ftp_user: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="ftpuser"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                                        <input
                                            type="password"
                                            value={formData.ftp_password}
                                            onChange={(e) => setFormData({ ...formData, ftp_password: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Remote Path</label>
                                        <input
                                            type="text"
                                            value={formData.ftp_path}
                                            onChange={(e) => setFormData({ ...formData, ftp_path: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="/data/exports"
                                        />
                                    </div>
                                    {formData.source_type === 'sftp' && (
                                        <div className="md:col-span-2">
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                SSH Private Key (optional)
                                            </label>
                                            <div className="flex gap-2 mb-2">
                                                <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg cursor-pointer transition text-sm">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                    </svg>
                                                    Upload Key File
                                                    <input
                                                        type="file"
                                                        accept=".pem,.ppk,.key"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (event) => {
                                                                    setFormData({ ...formData, ftp_private_key: event.target.result });
                                                                };
                                                                reader.readAsText(file);
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {formData.ftp_private_key && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, ftp_private_key: '' })}
                                                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition"
                                                    >
                                                        Clear Key
                                                    </button>
                                                )}
                                            </div>
                                            <textarea
                                                value={formData.ftp_private_key}
                                                onChange={(e) => setFormData({ ...formData, ftp_private_key: e.target.value })}
                                                rows="4"
                                                className={`w-full px-4 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                                            />
                                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                                Upload file .pem/.ppk atau paste isi key.
                                                <span className="text-amber-400 ml-1">Note: File .ppk (PuTTY) harus dikonversi ke format OpenSSH/PEM dulu.</span>
                                            </p>
                                        </div>
                                    )}
                                    {formData.source_type === 'ftp' && (
                                        <div className="md:col-span-2">
                                            <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.ftp_passive}
                                                    onChange={(e) => setFormData({ ...formData, ftp_passive: e.target.checked })}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                                />
                                                Use Passive Mode (recommended)
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* API Configuration */}
                        {formData.source_type === 'api' && (
                            <div className={`border-t pt-4 mt-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    REST API Configuration
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>API URL</label>
                                        <input
                                            type="url"
                                            value={formData.api_url}
                                            onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="https://api.example.com/data"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Method</label>
                                        <select
                                            value={formData.api_method}
                                            onChange={(e) => setFormData({ ...formData, api_method: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                        >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Authentication</label>
                                        <select
                                            value={formData.api_auth_type}
                                            onChange={(e) => setFormData({ ...formData, api_auth_type: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                        >
                                            <option value="none">No Auth</option>
                                            <option value="bearer">Bearer Token</option>
                                            <option value="basic">Basic Auth</option>
                                            <option value="api_key">API Key</option>
                                        </select>
                                    </div>
                                    {formData.api_auth_type === 'api_key' && (
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Header Name</label>
                                            <input
                                                type="text"
                                                value={formData.api_auth_key}
                                                onChange={(e) => setFormData({ ...formData, api_auth_key: e.target.value })}
                                                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="X-API-Key"
                                            />
                                        </div>
                                    )}
                                    {formData.api_auth_type !== 'none' && (
                                        <div className={formData.api_auth_type === 'api_key' ? '' : 'md:col-span-2'}>
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                {formData.api_auth_type === 'bearer' ? 'Token' :
                                                    formData.api_auth_type === 'basic' ? 'username:password' : 'API Key Value'}
                                            </label>
                                            <input
                                                type="password"
                                                value={formData.api_auth_value}
                                                onChange={(e) => setFormData({ ...formData, api_auth_value: e.target.value })}
                                                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder={formData.api_auth_type === 'basic' ? 'user:password' : 'Enter token/key...'}
                                            />
                                        </div>
                                    )}
                                    <div className="md:col-span-2">
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                            Custom Headers <span className="text-slate-500">(JSON format, optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.api_headers}
                                            onChange={(e) => setFormData({ ...formData, api_headers: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder='{"Content-Type": "application/json"}'
                                        />
                                    </div>
                                    {formData.api_method === 'POST' && (
                                        <div className="md:col-span-2">
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Request Body (JSON)</label>
                                            <textarea
                                                value={formData.api_body}
                                                onChange={(e) => setFormData({ ...formData, api_body: e.target.value })}
                                                rows="3"
                                                className={`w-full px-4 py-2 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder='{"query": "value"}'
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-stagger">
                {networks
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((network) => (
                        <div
                            key={network.id}
                            className={`backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 ${isDark
                                ? 'bg-slate-800/80 border-slate-700 border-l-4 border-l-purple-500'
                                : 'bg-gradient-to-br from-white to-purple-50 border-slate-200 border-l-4 border-l-purple-500 shadow-sm hover:shadow-md hover:-translate-y-1'
                                }`}
                        >
                            <div className="flex justify-between mb-4">
                                <div>
                                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{network.name}</h3>
                                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600 font-mono'}`}>{network.ip_address}</p>
                                </div>
                                <div className="flex gap-1">
                                    {userRole === 'admin' && (
                                        <button
                                            onClick={() => handleTestConnection(network)}
                                            disabled={testingNetwork === network.id}
                                            className="action-btn bg-amber-600/20 hover:bg-amber-600/40 text-amber-500"
                                            title="Test Connection"
                                        >
                                            {testingNetwork === network.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Zap className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedNetwork(network)}
                                        className="action-btn action-btn-view"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {userRole === 'admin' && (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className={`flex justify-between items-center pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</span>
                                <span className={`flex items-center gap-2 text-sm font-medium ${network.status === 'online' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                    <Circle className="w-2 h-2 fill-current" />
                                    {network.status || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-3">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Type</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${network.type === 'source' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700 border border-blue-100') : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700 border border-green-100')}`}>
                                    {network.type}
                                </span>
                            </div>
                        </div>
                    ))}
            </div>

            {/* Pagination */}
            {networks.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={networks.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                />
            )}

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
                        <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-100'}`}>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>#{selectedNetwork.id}</span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Name</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedNetwork.name}</span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>IP Address</span>
                                <span className={`text-sm font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedNetwork.ip_address}</span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between items-center">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Type</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${selectedNetwork.type === 'source' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700 border border-blue-100') : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700 border border-green-100')}`}>
                                    {selectedNetwork.type}
                                </span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between items-center">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</span>
                                <span className={`flex items-center gap-2 text-sm font-medium ${selectedNetwork.status === 'online' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                    <Circle className="w-2 h-2 fill-current" />
                                    {selectedNetwork.status || 'Unknown'}
                                </span>
                            </div>
                            <div className="detail-row flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Created At</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
