import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Network as NetworkIcon, Circle, Eye, Loader2, Zap, Database, Server, Shield, Globe, Folder, Copy } from 'lucide-react';
import { getNetworks, createNetwork, updateNetwork, deleteNetwork, testNetworkConnection, cloneNetwork } from '../services/api';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';
import { getErrorMessage } from '../utils/errorHelper';

function Network() {
    const { isDark } = useTheme();
    const [networks, setNetworks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        agent_name: '', // Agent to route commands (leave empty to use name)
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
        // MongoDB fields
        mongo_host: '',
        mongo_port: '27017',
        mongo_user: '',
        mongo_password: '',
        mongo_database: '',
        mongo_collection: '',
        mongo_auth_db: 'admin',
        // Redis fields
        redis_host: '',
        redis_port: '6379',
        redis_password: '',
        redis_db: 0,
        redis_pattern: '*',
    });

    // New states for enhanced UX
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [testingNetwork, setTestingNetwork] = useState(null);
    const [cloningNetwork, setCloningNetwork] = useState(null);
    const { toasts, addToast, removeToast } = useToast();
    const userRole = localStorage.getItem('role') || 'viewer';

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    useEffect(() => {
        loadNetworks();
        const interval = setInterval(loadNetworks, 15000); // Poll every 15s instead of 5s for better INP
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
            addToast(getErrorMessage(error, 'Failed to save network. Please try again.'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (network) => {
        setFormData({
            name: network.name,
            agent_name: network.agent_name || '',
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
            // MongoDB fields
            mongo_host: network.mongo_host || '',
            mongo_port: network.mongo_port || '27017',
            mongo_user: network.mongo_user || '',
            mongo_password: network.mongo_password || '',
            mongo_database: network.mongo_database || '',
            mongo_collection: network.mongo_collection || '',
            mongo_auth_db: network.mongo_auth_db || 'admin',
            // Redis fields
            redis_host: network.redis_host || '',
            redis_port: network.redis_port || '6379',
            redis_password: network.redis_password || '',
            redis_db: network.redis_db || 0,
            redis_pattern: network.redis_pattern || '*',
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
            addToast(getErrorMessage(error, 'Failed to delete network. Please try again.'), 'error');
        } finally {
            setIsLoading(false);
            setDeleteTarget(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', agent_name: '', ip_address: '', type: 'source', source_type: 'database',
            db_driver: 'postgres', db_host: '', db_port: '5432',
            db_user: '', db_password: '', db_name: '', db_sslmode: 'disable',
            ftp_host: '', ftp_port: '21', ftp_user: '', ftp_password: '', ftp_private_key: '', ftp_path: '', ftp_passive: true,
            api_url: '', api_method: 'GET', api_headers: '', api_auth_type: 'none', api_auth_key: '', api_auth_value: '', api_body: '',
            mongo_host: '', mongo_port: '27017', mongo_user: '', mongo_password: '', mongo_database: '', mongo_collection: '', mongo_auth_db: 'admin',
            redis_host: '', redis_port: '6379', redis_password: '', redis_db: 0, redis_pattern: '*'
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleTestConnection = async (network) => {
        // Validate based on source type
        const type = network.source_type || 'database';
        let hasHost = false;

        switch (type) {
            case 'database':
                hasHost = !!network.db_host;
                break;
            case 'ftp':
            case 'sftp':
                hasHost = !!network.ftp_host;
                break;
            case 'api':
                hasHost = !!network.api_url;
                break;
            default:
                hasHost = false;
        }

        if (!hasHost) {
            addToast(`No host/URL configured for this ${type} network`, 'warning');
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

    const handleClone = async (network) => {
        try {
            setCloningNetwork(network.id);
            const response = await cloneNetwork(network.id);
            addToast(`Network "${network.name}" cloned successfully!`, 'success');
            loadNetworks();
            // Scroll to top to see the new item
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to clone network:', error);
            addToast(getErrorMessage(error, 'Failed to clone network. Please try again.'), 'error');
        } finally {
            setCloningNetwork(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Premium Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-purple-50/30 to-blue-50/20 border-slate-200/60 shadow-lg'}`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-3xl"></div>

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                            <NetworkIcon className="w-3 h-3" />
                            Connectivity
                        </div>
                        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Network Management</h1>
                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Manage database connections and file servers</p>
                    </div>
                    {userRole === 'admin' && (
                        <button
                            onClick={() => setShowForm(!showForm)}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-medium">New Network</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className={`backdrop-blur-sm border rounded-2xl p-8 modal-scale-in mb-8 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
                    <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {editingId ? <Edit className="w-5 h-5 text-purple-500" /> : <Plus className="w-5 h-5 text-purple-500" />}
                        {editingId ? 'Edit Network' : 'Create New Network'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="e.g., Production Database"
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Agent Name <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.agent_name}
                                    onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="Leave empty to use Name"
                                />
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Agent to route commands. Use this to share one agent across multiple networks.
                                </p>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>IP Address</label>
                                <input
                                    type="text"
                                    value={formData.ip_address}
                                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="e.g., 192.168.1.100"
                                    required
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Network Type</label>
                                <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'source' })}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${formData.type === 'source' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        Source
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'target' })}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${formData.type === 'target' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        Target
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Source Type Selection */}
                        <div className="space-y-3">
                            <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Connection Protocol</label>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                {[
                                    { id: 'database', label: 'Database', icon: Database },
                                    { id: 'mongodb', label: 'MongoDB', icon: Database },
                                    { id: 'redis', label: 'Redis', icon: Database },
                                    { id: 'ftp', label: 'FTP', icon: Server },
                                    { id: 'sftp', label: 'SFTP (SSH)', icon: Shield },
                                    { id: 'api', label: 'REST API', icon: Globe }
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, source_type: type.id })}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${formData.source_type === type.id
                                            ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                            : isDark ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        <type.icon className="w-6 h-6" />
                                        <span className="font-semibold">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Database Configuration - shown when source_type is 'database' */}
                        {formData.source_type === 'database' && (
                            <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                                        <Database className="w-4 h-4" />
                                    </div>
                                    Database Configuration
                                </h3>
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
                                            <option value="sqlserver">SQL Server (MSSQL)</option>
                                            <option value="oracle">Oracle</option>
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

                        {/* FTP/SFTP Configuration */}
                        {(formData.source_type === 'ftp' || formData.source_type === 'sftp') && (
                            <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                        <Server className="w-4 h-4" />
                                    </div>
                                    {formData.source_type.toUpperCase()} Configuration
                                </h3>

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
                                                Upload .pem/.key file. Note: .ppk must be converted to OpenSSH/PEM.
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
                            <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                                    <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                                        <Globe className="w-4 h-4" />
                                    </div>
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

                        {/* MongoDB Configuration */}
                        {formData.source_type === 'mongodb' && (
                            <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                    <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                                        <Database className="w-4 h-4" />
                                    </div>
                                    MongoDB Configuration
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label>
                                        <input
                                            type="text"
                                            value={formData.mongo_host}
                                            onChange={(e) => setFormData({ ...formData, mongo_host: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="localhost"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label>
                                        <input
                                            type="text"
                                            value={formData.mongo_port}
                                            onChange={(e) => setFormData({ ...formData, mongo_port: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="27017"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
                                        <input
                                            type="text"
                                            value={formData.mongo_user}
                                            onChange={(e) => setFormData({ ...formData, mongo_user: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="admin"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                                        <input
                                            type="password"
                                            value={formData.mongo_password}
                                            onChange={(e) => setFormData({ ...formData, mongo_password: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Database</label>
                                        <input
                                            type="text"
                                            value={formData.mongo_database}
                                            onChange={(e) => setFormData({ ...formData, mongo_database: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="mydb"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Collection</label>
                                        <input
                                            type="text"
                                            value={formData.mongo_collection}
                                            onChange={(e) => setFormData({ ...formData, mongo_collection: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="users"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Auth Database</label>
                                        <input
                                            type="text"
                                            value={formData.mongo_auth_db}
                                            onChange={(e) => setFormData({ ...formData, mongo_auth_db: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="admin"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Redis Configuration */}
                        {formData.source_type === 'redis' && (
                            <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                                    <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                        <Database className="w-4 h-4" />
                                    </div>
                                    Redis Configuration
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label>
                                        <input
                                            type="text"
                                            value={formData.redis_host}
                                            onChange={(e) => setFormData({ ...formData, redis_host: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="localhost"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label>
                                        <input
                                            type="text"
                                            value={formData.redis_port}
                                            onChange={(e) => setFormData({ ...formData, redis_port: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="6379"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                                        <input
                                            type="password"
                                            value={formData.redis_password}
                                            onChange={(e) => setFormData({ ...formData, redis_password: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Database Number (0-15)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="15"
                                            value={formData.redis_db}
                                            onChange={(e) => setFormData({ ...formData, redis_db: parseInt(e.target.value) || 0 })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Key Pattern</label>
                                        <input
                                            type="text"
                                            value={formData.redis_pattern}
                                            onChange={(e) => setFormData({ ...formData, redis_pattern: e.target.value })}
                                            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder="user:* (or * for all keys)"
                                        />
                                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            Pattern to scan keys (e.g., "user:*", "session:*", or "*" for all)
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition disabled:opacity-50 shadow-lg shadow-purple-500/20 min-w-[120px]"
                            >
                                {isSubmitting ? 'Saving...' : (editingId ? 'Update Network' : 'Create Network')}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className={`px-6 py-2.5 rounded-xl transition ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
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
                            className={`group border rounded-2xl p-6 transition-all duration-300 ${isDark
                                ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-purple-500/50'
                                : 'bg-white border-slate-200 hover:border-purple-300 hover:shadow-xl shadow-sm'
                                }`}
                        >
                            <div className="flex justify-between mb-4">
                                <div className="flex items-start gap-3">
                                    <div className={`p-3 rounded-xl ${network.type === 'source'
                                        ? (isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600')
                                        : (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                                        }`}>
                                        <NetworkIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900 group-hover:text-purple-700'} transition-colors`}>{network.name}</h3>
                                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500 font-mono'}`}>{network.ip_address}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {userRole === 'admin' && (
                                        <button
                                            onClick={() => handleTestConnection(network)}
                                            disabled={testingNetwork === network.id}
                                            className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-amber-400' : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'}`}
                                            title="Test Connection"
                                        >
                                            {testingNetwork === network.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedNetwork(network)}
                                        className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-slate-400 hover:text-blue-600'}`}
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {userRole === 'admin' && (
                                        <>
                                            <button
                                                onClick={() => handleEdit(network)}
                                                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-emerald-400' : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'}`}
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleClone(network)}
                                                disabled={cloningNetwork === network.id}
                                                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-purple-400' : 'hover:bg-purple-50 text-slate-400 hover:text-purple-600'}`}
                                                title="Clone Network"
                                            >
                                                {cloningNetwork === network.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(network)}
                                                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'}`}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className={`flex justify-between items-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    <span>Status</span>
                                    <span className={`flex items-center gap-2 font-medium ${network.status === 'online' ? 'text-emerald-500' : 'text-red-500'}`}>
                                        <Circle className="w-2 h-2 fill-current" />
                                        {network.status || 'Unknown'}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${network.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                        style={{ width: network.status === 'online' ? '100%' : '5%' }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                        {network.source_type || 'database'}
                                    </span>
                                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>#{network.id}</span>
                                </div>
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
