import { useState } from 'react';
import { Plus, Edit, Trash2, Network as NetworkIcon, Circle, Eye, Loader2, Zap, Database, Server, Shield, Globe, Folder, Copy, ArrowLeftRight, Play, RefreshCw } from 'lucide-react';
import { useNetworks, useCreateNetwork, useUpdateNetwork, useDeleteNetwork, useTestNetworkConnection, useTestNetworkTargetConnection, useReverseNetwork, useCloneNetwork } from '../hooks/useQueries';
import { testTargetDBConnection } from '../services/api';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';
import { getErrorMessage } from '../utils/errorHelper';

function Network() {
    const { isDark } = useTheme();
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
        // ===== TARGET CONFIGURATION =====
        target_source_type: 'database',
        // Target Database
        target_db_driver: 'postgres',
        target_db_host: '',
        target_db_port: '5432',
        target_db_user: '',
        target_db_password: '',
        target_db_name: '',
        target_db_sslmode: 'disable',
        // Target FTP/SFTP
        target_ftp_host: '',
        target_ftp_port: '21',
        target_ftp_user: '',
        target_ftp_password: '',
        target_ftp_private_key: '',
        target_ftp_path: '',
        // Target API
        target_api_url: '',
        target_api_method: 'POST',
        target_api_headers: '',
        target_api_auth_type: 'none',
        target_api_auth_key: '',
        target_api_auth_value: '',
        target_api_body: '',
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

    // React Query hooks
    const { data: networks = [] } = useNetworks();
    const createNetworkMutation = useCreateNetwork();
    const updateNetworkMutation = useUpdateNetwork();
    const deleteNetworkMutation = useDeleteNetwork();
    const testConnectionMutation = useTestNetworkConnection();
    const testTargetConnectionMutation = useTestNetworkTargetConnection();
    const reverseNetworkMutation = useReverseNetwork();
    const cloneNetworkMutation = useCloneNetwork();
    const [testingTargetNetwork, setTestingTargetNetwork] = useState(null);
    const [reversingNetwork, setReversingNetwork] = useState(null);

    // Form-level connection testing state
    const [formTestingSource, setFormTestingSource] = useState(false);
    const [formTestingTarget, setFormTestingTarget] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingId) {
                await updateNetworkMutation.mutateAsync({ id: editingId, data: formData });
                addToast('Network updated successfully!', 'success');
            } else {
                await createNetworkMutation.mutateAsync(formData);
                addToast('Network created successfully!', 'success');
            }
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
            // Target fields
            target_source_type: network.target_source_type || 'database',
            target_db_driver: network.target_db_driver || 'postgres',
            target_db_host: network.target_db_host || '',
            target_db_port: network.target_db_port || '5432',
            target_db_user: network.target_db_user || '',
            target_db_password: network.target_db_password || '',
            target_db_name: network.target_db_name || '',
            target_db_sslmode: network.target_db_sslmode || 'disable',
            target_ftp_host: network.target_ftp_host || '',
            target_ftp_port: network.target_ftp_port || '21',
            target_ftp_user: network.target_ftp_user || '',
            target_ftp_password: network.target_ftp_password || '',
            target_ftp_private_key: network.target_ftp_private_key || '',
            target_ftp_path: network.target_ftp_path || '',
            target_api_url: network.target_api_url || '',
            target_api_method: network.target_api_method || 'POST',
            target_api_headers: network.target_api_headers || '',
            target_api_auth_type: network.target_api_auth_type || 'none',
            target_api_auth_key: network.target_api_auth_key || '',
            target_api_auth_value: network.target_api_auth_value || '',
            target_api_body: network.target_api_body || '',
        });
        setEditingId(network.id);
        setShowForm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsLoading(true);
        try {
            await deleteNetworkMutation.mutateAsync(deleteTarget.id);
            addToast(`Network "${deleteTarget.name}" deleted successfully!`, 'success');
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
            redis_host: '', redis_port: '6379', redis_password: '', redis_db: 0, redis_pattern: '*',
            // Target fields
            target_source_type: 'database',
            target_db_driver: 'postgres', target_db_host: '', target_db_port: '5432',
            target_db_user: '', target_db_password: '', target_db_name: '', target_db_sslmode: 'disable',
            target_ftp_host: '', target_ftp_port: '21', target_ftp_user: '', target_ftp_password: '', target_ftp_private_key: '', target_ftp_path: '',
            target_api_url: '', target_api_method: 'POST', target_api_headers: '', target_api_auth_type: 'none', target_api_auth_key: '', target_api_auth_value: '', target_api_body: '',
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
            const response = await testConnectionMutation.mutateAsync(network.id);
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
            await cloneNetworkMutation.mutateAsync(network.id);
            addToast(`Network "${network.name}" cloned successfully!`, 'success');
            // Scroll to top to see the new item
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to clone network:', error);
            addToast(getErrorMessage(error, 'Failed to clone network. Please try again.'), 'error');
        } finally {
            setCloningNetwork(null);
        }
    };

    const handleTestTargetConnection = async (network) => {
        // Validate based on target source type
        const type = network.target_source_type || 'database';
        let hasHost = false;

        switch (type) {
            case 'database':
                hasHost = !!network.target_db_host;
                break;
            case 'ftp':
            case 'sftp':
                hasHost = !!network.target_ftp_host;
                break;
            case 'api':
                hasHost = !!network.target_api_url;
                break;
            default:
                hasHost = false;
        }

        if (!hasHost) {
            addToast(`No target host/URL configured for this ${type} network`, 'warning');
            return;
        }
        try {
            setTestingTargetNetwork(network.id);
            const response = await testTargetConnectionMutation.mutateAsync(network.id);
            if (response.data.success) {
                addToast(`Target connection successful! Host: ${response.data.host || response.data.url || 'OK'}`, 'success');
            } else {
                addToast(response.data.error || 'Target test failed', 'error');
            }
        } catch (error) {
            console.error('Target test failed:', error);
            addToast('Failed to test target connection: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setTestingTargetNetwork(null);
        }
    };

    const handleReverseNetwork = async (network) => {
        try {
            setReversingNetwork(network.id);
            await reverseNetworkMutation.mutateAsync(network.id);
            addToast(`Network "${network.name}" source/target reversed!`, 'success');
        } catch (error) {
            console.error('Failed to reverse network:', error);
            addToast(getErrorMessage(error, 'Failed to reverse network. Please try again.'), 'error');
        } finally {
            setReversingNetwork(null);
        }
    };

    // Test Source connection from form (uses formData directly)
    const handleFormTestSource = async () => {
        const type = formData.source_type || 'database';

        // Validate based on source type
        if (type === 'database' && !formData.db_host) {
            addToast('Please fill in database host first', 'warning');
            return;
        }
        if ((type === 'ftp' || type === 'sftp') && !formData.ftp_host) {
            addToast('Please fill in FTP/SFTP host first', 'warning');
            return;
        }
        if (type === 'api' && !formData.api_url) {
            addToast('Please fill in API URL first', 'warning');
            return;
        }

        try {
            setFormTestingSource(true);
            // Use the test target DB connection API with source form data
            const testData = {
                driver: formData.db_driver,
                host: formData.db_host,
                port: formData.db_port,
                user: formData.db_user,
                password: formData.db_password,
                db_name: formData.db_name,
                sslmode: formData.db_sslmode
            };
            const response = await testTargetDBConnection(testData);
            if (response.data.success) {
                addToast(`Source connection successful! ${response.data.version ? `(${response.data.version.substring(0, 50)}...)` : ''}`, 'success');
            } else {
                addToast(response.data.error || 'Source test failed', 'error');
            }
        } catch (error) {
            console.error('Source test failed:', error);
            addToast('Failed to test source: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setFormTestingSource(false);
        }
    };

    // Test Target connection from form (uses formData directly)
    const handleFormTestTarget = async () => {
        const type = formData.target_source_type || 'database';

        // Validate based on target type
        if (type === 'database' && !formData.target_db_host) {
            addToast('Please fill in target database host first', 'warning');
            return;
        }
        if ((type === 'ftp' || type === 'sftp') && !formData.target_ftp_host) {
            addToast('Please fill in target FTP/SFTP host first', 'warning');
            return;
        }
        if (type === 'api' && !formData.target_api_url) {
            addToast('Please fill in target API URL first', 'warning');
            return;
        }

        try {
            setFormTestingTarget(true);
            // Use the test target DB connection API with target form data
            const testData = {
                driver: formData.target_db_driver,
                host: formData.target_db_host,
                port: formData.target_db_port,
                user: formData.target_db_user,
                password: formData.target_db_password,
                db_name: formData.target_db_name,
                sslmode: formData.target_db_sslmode
            };
            const response = await testTargetDBConnection(testData);
            if (response.data.success) {
                addToast(`Target connection successful! ${response.data.version ? `(${response.data.version.substring(0, 50)}...)` : ''}`, 'success');
            } else {
                addToast(response.data.error || 'Target test failed', 'error');
            }
        } catch (error) {
            console.error('Target test failed:', error);
            addToast('Failed to test target: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setFormTestingTarget(false);
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

                        {/* Source Configuration - shown when source_type is 'database' */}
                        {formData.source_type === 'database' && (
                            <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-md font-semibold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                        <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                                            <Database className="w-4 h-4" />
                                        </div>
                                        Source Configuration
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleFormTestSource}
                                        disabled={formTestingSource}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isDark
                                            ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30'
                                            : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200'}`}
                                    >
                                        {formTestingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                        Test Source
                                    </button>
                                </div>
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

                        {/* ===== TARGET CONFIGURATION SECTION ===== */}
                        <div className={`border-t-2 border-dashed pt-6 mt-6 ${isDark ? 'border-purple-500/30' : 'border-purple-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                        <ArrowLeftRight className="w-5 h-5" />
                                    </div>
                                    TARGET Configuration
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleFormTestTarget}
                                    disabled={formTestingTarget}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isDark
                                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200'}`}
                                >
                                    {formTestingTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    Test Target
                                </button>
                            </div>

                            {/* Target Source Type Selection */}
                            <div className="space-y-3 mb-6">
                                <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Target Type</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { id: 'database', label: 'Database', icon: Database },
                                        { id: 'ftp', label: 'FTP', icon: Server },
                                        { id: 'sftp', label: 'SFTP (SSH)', icon: Shield },
                                        { id: 'api', label: 'REST API', icon: Globe }
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, target_source_type: type.id })}
                                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${formData.target_source_type === type.id
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                : isDark ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            <type.icon className="w-5 h-5" />
                                            <span className="text-sm font-semibold">{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Target Database Configuration */}
                            {formData.target_source_type === 'database' && (
                                <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
                                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                        <Database className="w-4 h-4" />
                                        Target Database
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Driver</label>
                                            <select
                                                value={formData.target_db_driver}
                                                onChange={(e) => setFormData({ ...formData, target_db_driver: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            >
                                                <option value="postgres">PostgreSQL</option>
                                                <option value="mysql">MySQL</option>
                                                <option value="sqlserver">SQL Server</option>
                                                <option value="oracle">Oracle</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Host</label>
                                            <input
                                                type="text"
                                                value={formData.target_db_host}
                                                onChange={(e) => setFormData({ ...formData, target_db_host: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="Target host"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Port</label>
                                            <input
                                                type="text"
                                                value={formData.target_db_port}
                                                onChange={(e) => setFormData({ ...formData, target_db_port: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="5432"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Username</label>
                                            <input
                                                type="text"
                                                value={formData.target_db_user}
                                                onChange={(e) => setFormData({ ...formData, target_db_user: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="postgres"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Password</label>
                                            <input
                                                type="password"
                                                value={formData.target_db_password}
                                                onChange={(e) => setFormData({ ...formData, target_db_password: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Database Name</label>
                                            <input
                                                type="text"
                                                value={formData.target_db_name}
                                                onChange={(e) => setFormData({ ...formData, target_db_name: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="targetdb"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Target FTP/SFTP Configuration */}
                            {(formData.target_source_type === 'ftp' || formData.target_source_type === 'sftp') && (
                                <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
                                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                        <Folder className="w-4 h-4" />
                                        Target {formData.target_source_type.toUpperCase()}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Host</label>
                                            <input
                                                type="text"
                                                value={formData.target_ftp_host}
                                                onChange={(e) => setFormData({ ...formData, target_ftp_host: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="ftp.example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Port</label>
                                            <input
                                                type="text"
                                                value={formData.target_ftp_port}
                                                onChange={(e) => setFormData({ ...formData, target_ftp_port: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder={formData.target_source_type === 'sftp' ? '22' : '21'}
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Username</label>
                                            <input
                                                type="text"
                                                value={formData.target_ftp_user}
                                                onChange={(e) => setFormData({ ...formData, target_ftp_user: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="ftpuser"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Password</label>
                                            <input
                                                type="password"
                                                value={formData.target_ftp_password}
                                                onChange={(e) => setFormData({ ...formData, target_ftp_password: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Remote Path</label>
                                            <input
                                                type="text"
                                                value={formData.target_ftp_path}
                                                onChange={(e) => setFormData({ ...formData, target_ftp_path: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="/upload/data"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Target API Configuration */}
                            {formData.target_source_type === 'api' && (
                                <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
                                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                        <Globe className="w-4 h-4" />
                                        Target API Endpoint
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="md:col-span-2">
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>API URL</label>
                                            <input
                                                type="text"
                                                value={formData.target_api_url}
                                                onChange={(e) => setFormData({ ...formData, target_api_url: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                placeholder="https://api.example.com/data"
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Method</label>
                                            <select
                                                value={formData.target_api_method}
                                                onChange={(e) => setFormData({ ...formData, target_api_method: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            >
                                                <option value="POST">POST</option>
                                                <option value="PUT">PUT</option>
                                                <option value="PATCH">PATCH</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Auth Type</label>
                                            <select
                                                value={formData.target_api_auth_type}
                                                onChange={(e) => setFormData({ ...formData, target_api_auth_type: e.target.value })}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            >
                                                <option value="none">None</option>
                                                <option value="bearer">Bearer Token</option>
                                                <option value="basic">Basic Auth</option>
                                                <option value="api_key">API Key</option>
                                            </select>
                                        </div>
                                        {formData.target_api_auth_type !== 'none' && (
                                            <div className="md:col-span-2">
                                                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Auth Value</label>
                                                <input
                                                    type="password"
                                                    value={formData.target_api_auth_value}
                                                    onChange={(e) => setFormData({ ...formData, target_api_auth_value: e.target.value })}
                                                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                    placeholder="Token or API key"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

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

            {/* Networks Table - Desktop Only */}
            <div className={`hidden lg:block rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className={isDark ? 'bg-slate-900/50' : 'bg-slate-50'}>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID</th>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Name</th>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                    <span className="flex items-center gap-1">
                                        <Database className="w-3 h-3" />
                                        Source
                                    </span>
                                </th>
                                <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    <span className="flex items-center gap-1">
                                        <Server className="w-3 h-3" />
                                        Target
                                    </span>
                                </th>
                                <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                            {networks
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((network) => {
                                    // Generate Source connection string
                                    let sourceAddr = '';
                                    const srcType = network.source_type || 'database';
                                    if (srcType === 'database') {
                                        sourceAddr = `${network.db_driver || 'postgres'}://${network.db_host || '-'}:${network.db_port || '5432'}/${network.db_name || '-'}`;
                                    } else if (srcType === 'ftp' || srcType === 'sftp') {
                                        sourceAddr = `${srcType}://${network.ftp_host || '-'}:${network.ftp_port || '21'}${network.ftp_path || '/'}`;
                                    } else if (srcType === 'api') {
                                        sourceAddr = network.api_url || '-';
                                    } else if (srcType === 'mongodb') {
                                        sourceAddr = `mongodb://${network.mongo_host || '-'}:${network.mongo_port || '27017'}/${network.mongo_database || '-'}`;
                                    } else if (srcType === 'redis') {
                                        sourceAddr = `redis://${network.redis_host || '-'}:${network.redis_port || '6379'}/${network.redis_db || 0}`;
                                    }

                                    // Generate Target connection string
                                    let targetAddr = '';
                                    const tgtType = network.target_source_type || 'database';
                                    if (tgtType === 'database') {
                                        targetAddr = network.target_db_host
                                            ? `${network.target_db_driver || 'postgres'}://${network.target_db_host}:${network.target_db_port || '5432'}/${network.target_db_name || '-'}`
                                            : '-';
                                    } else if (tgtType === 'ftp' || tgtType === 'sftp') {
                                        targetAddr = network.target_ftp_host
                                            ? `${tgtType}://${network.target_ftp_host}:${network.target_ftp_port || '21'}${network.target_ftp_path || '/'}`
                                            : '-';
                                    } else if (tgtType === 'api') {
                                        targetAddr = network.target_api_url || '-';
                                    }

                                    return (
                                        <tr key={network.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
                                            <td className={`px-4 py-3 text-sm font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {network.id}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{network.name}</div>
                                                <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{network.ip_address}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                                    {srcType.toUpperCase()}
                                                </div>
                                                <div className={`text-xs font-mono break-all max-w-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {sourceAddr}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                    {tgtType.toUpperCase()}
                                                </div>
                                                <div className={`text-xs font-mono break-all max-w-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {targetAddr}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    {userRole === 'admin' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleTestConnection(network)}
                                                                disabled={testingNetwork === network.id}
                                                                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-purple-400' : 'hover:bg-purple-50 text-purple-600'}`}
                                                                title="Test Source"
                                                            >
                                                                {testingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleTestTargetConnection(network)}
                                                                disabled={testingTargetNetwork === network.id}
                                                                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'}`}
                                                                title="Test Target"
                                                            >
                                                                {testingTargetNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleReverseNetwork(network)}
                                                                disabled={reversingNetwork === network.id}
                                                                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-orange-400' : 'hover:bg-orange-50 text-orange-600'}`}
                                                                title="Swap ↔"
                                                            >
                                                                {reversingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedNetwork(network)}
                                                        className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-blue-400' : 'hover:bg-blue-50 text-blue-600'}`}
                                                        title="View"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    {userRole === 'admin' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(network)}
                                                                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleClone(network)}
                                                                disabled={cloningNetwork === network.id}
                                                                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                                                                title="Clone"
                                                            >
                                                                {cloningNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(network)}
                                                                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Networks Cards - Mobile Only */}
            <div className="lg:hidden space-y-4">
                {networks
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((network) => {
                        // Generate Source connection string
                        const srcType = network.source_type || 'database';
                        let sourceAddr = '';
                        if (srcType === 'database') {
                            sourceAddr = `${network.db_driver || 'postgres'}://${network.db_host || '-'}:${network.db_port || '5432'}`;
                        } else if (srcType === 'ftp' || srcType === 'sftp') {
                            sourceAddr = `${srcType}://${network.ftp_host || '-'}:${network.ftp_port || '21'}`;
                        } else if (srcType === 'api') {
                            sourceAddr = network.api_url || '-';
                        }

                        // Generate Target connection string
                        const tgtType = network.target_source_type || 'database';
                        let targetAddr = '';
                        if (tgtType === 'database' && network.target_db_host) {
                            targetAddr = `${network.target_db_driver || 'postgres'}://${network.target_db_host}:${network.target_db_port || '5432'}`;
                        } else if ((tgtType === 'ftp' || tgtType === 'sftp') && network.target_ftp_host) {
                            targetAddr = `${tgtType}://${network.target_ftp_host}:${network.target_ftp_port || '21'}`;
                        } else if (tgtType === 'api') {
                            targetAddr = network.target_api_url || '-';
                        } else {
                            targetAddr = '-';
                        }

                        return (
                            <div
                                key={network.id}
                                className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-md'}`}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                                            <Database className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{network.name}</div>
                                            <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ID: {network.id}</div>
                                        </div>
                                    </div>
                                    <Circle className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'} fill-current`} />
                                </div>

                                {/* Source & Target Info */}
                                <div className="space-y-2 mb-4">
                                    <div className={`p-2 rounded-lg text-xs ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-100'}`}>
                                        <span className={`font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>SOURCE:</span>
                                        <span className={`ml-2 font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{srcType.toUpperCase()} - {sourceAddr}</span>
                                    </div>
                                    <div className={`p-2 rounded-lg text-xs ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'}`}>
                                        <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>TARGET:</span>
                                        <span className={`ml-2 font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{tgtType.toUpperCase()} - {targetAddr}</span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className={`flex flex-wrap gap-2 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <button
                                        onClick={() => setSelectedNetwork(network)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        Detail
                                    </button>
                                    {userRole === 'admin' && (
                                        <>
                                            <button
                                                onClick={() => handleTestConnection(network)}
                                                disabled={testingNetwork === network.id}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                                            >
                                                {testingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                                Test Src
                                            </button>
                                            <button
                                                onClick={() => handleTestTargetConnection(network)}
                                                disabled={testingTargetNetwork === network.id}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                            >
                                                {testingTargetNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                                Test Target
                                            </button>
                                            <button
                                                onClick={() => handleReverseNetwork(network)}
                                                disabled={reversingNetwork === network.id}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                            >
                                                {reversingNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                                                Swap
                                            </button>
                                            <button
                                                onClick={() => handleEdit(network)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleClone(network)}
                                                disabled={cloningNetwork === network.id}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                            >
                                                {cloningNetwork === network.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                                                Clone
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(network)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Hapus
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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
