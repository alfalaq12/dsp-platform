import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Network as NetworkIcon, Circle, Search, Filter } from 'lucide-react';
import { useNetworks, useCreateNetwork, useUpdateNetwork, useDeleteNetwork, useTestNetworkConnection, useTestNetworkTargetConnection, useReverseNetwork, useCloneNetwork } from '../hooks/useQueries';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';
import { getErrorMessage } from '../utils/errorHelper';
import NetworkForm from '../components/network/NetworkForm';
import NetworkTable from '../components/network/NetworkTable';

const INITIAL_FORM_DATA = {
    name: '', agent_name: '', ip_address: '', type: 'source', source_type: 'database',
    db_driver: 'postgres', db_host: '', db_port: '5432', db_user: '', db_password: '', db_name: '', db_sslmode: 'disable',
    ftp_host: '', ftp_port: '21', ftp_user: '', ftp_password: '', ftp_private_key: '', ftp_path: '', ftp_passive: true,
    api_url: '', api_method: 'GET', api_headers: '', api_auth_type: 'none', api_auth_key: '', api_auth_value: '', api_body: '',
    mongo_host: '', mongo_port: '27017', mongo_user: '', mongo_password: '', mongo_database: '', mongo_collection: '', mongo_auth_db: 'admin',
    redis_host: '', redis_port: '6379', redis_password: '', redis_db: 0, redis_pattern: '*',
    minio_endpoint: '', minio_access_key: '', minio_secret_key: '', minio_bucket: '', minio_object_path: '', minio_use_ssl: false, minio_region: 'us-east-1',
    target_source_type: 'database',
    target_db_driver: 'postgres', target_db_host: '', target_db_port: '5432', target_db_user: '', target_db_password: '', target_db_name: '', target_db_sslmode: 'disable',
    target_ftp_host: '', target_ftp_port: '21', target_ftp_user: '', target_ftp_password: '', target_ftp_private_key: '', target_ftp_path: '',
    target_api_url: '', target_api_method: 'POST', target_api_headers: '', target_api_auth_type: 'none', target_api_auth_key: '', target_api_auth_value: '', target_api_body: '',
    target_minio_endpoint: '', target_minio_access_key: '', target_minio_secret_key: '', target_minio_bucket: '', target_minio_object_path: '', target_minio_use_ssl: false, target_minio_region: 'us-east-1', target_minio_export_format: 'csv',
    notes: '',
};

function Network() {
    const { isDark } = useTheme();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA });
    const [searchName, setSearchName] = useState('');
    const [searchNotes, setSearchNotes] = useState('');
    const [activeSearchName, setActiveSearchName] = useState('');
    const [activeSearchNotes, setActiveSearchNotes] = useState('');

    const handleSearch = () => {
        setActiveSearchName(searchName);
        setActiveSearchNotes(searchNotes);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // UX states
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [testingNetwork, setTestingNetwork] = useState(null);
    const [testingTargetNetwork, setTestingTargetNetwork] = useState(null);
    const [reversingNetwork, setReversingNetwork] = useState(null);
    const [cloningNetwork, setCloningNetwork] = useState(null);
    const { toasts, addToast, removeToast } = useToast();
    const userRole = localStorage.getItem('role') || 'viewer';

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    // React Query hooks
    const { data: rawNetworks = [] } = useNetworks();

    // Filter networks based on search
    const networks = Array.isArray(rawNetworks) ? rawNetworks.filter(n => {
        const contentName = `${n.id || ''} ${n.name || ''} ${n.agent_name || ''} ${n.ip_address || ''}`.toLowerCase();
        const contentNotes = `${n.notes || ''}`.toLowerCase();
        
        const matchesName = !activeSearchName || contentName.includes(activeSearchName.toLowerCase());
        const matchesNotes = !activeSearchNotes || contentNotes.includes(activeSearchNotes.toLowerCase());
            
        return matchesName && matchesNotes;
    }) : [];
    const createNetworkMutation = useCreateNetwork();
    const updateNetworkMutation = useUpdateNetwork();
    const deleteNetworkMutation = useDeleteNetwork();
    const testConnectionMutation = useTestNetworkConnection();
    const testTargetConnectionMutation = useTestNetworkTargetConnection();
    const reverseNetworkMutation = useReverseNetwork();
    const cloneNetworkMutation = useCloneNetwork();
    const location = useLocation();

    // Handle Promotion from Nodes page
    useEffect(() => {
        const networkList = networks || [];
        if (location.state?.promoteId && networkList.length > 0) {
            const network = networkList.find(n => n.id === location.state.promoteId);
            if (network) {
                handleEdit(network);
                // Clear state to avoid re-opening on refresh
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state, networks]);

    // ===== Handlers =====

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
            db_host: network.db_host || '', db_port: network.db_port || '5432',
            db_user: network.db_user || '', db_password: network.db_password || '',
            db_name: network.db_name || '', db_sslmode: network.db_sslmode || 'disable',
            ftp_host: network.ftp_host || '', ftp_port: network.ftp_port || '21',
            ftp_user: network.ftp_user || '', ftp_password: network.ftp_password || '',
            ftp_private_key: network.ftp_private_key || '', ftp_path: network.ftp_path || '',
            ftp_passive: network.ftp_passive !== false,
            api_url: network.api_url || '', api_method: network.api_method || 'GET',
            api_headers: network.api_headers || '', api_auth_type: network.api_auth_type || 'none',
            api_auth_key: network.api_auth_key || '', api_auth_value: network.api_auth_value || '',
            api_body: network.api_body || '',
            mongo_host: network.mongo_host || '', mongo_port: network.mongo_port || '27017',
            mongo_user: network.mongo_user || '', mongo_password: network.mongo_password || '',
            mongo_database: network.mongo_database || '', mongo_collection: network.mongo_collection || '',
            mongo_auth_db: network.mongo_auth_db || 'admin',
            redis_host: network.redis_host || '', redis_port: network.redis_port || '6379',
            redis_password: network.redis_password || '', redis_db: network.redis_db || 0,
            redis_pattern: network.redis_pattern || '*',
            minio_endpoint: network.minio_endpoint || '', minio_access_key: network.minio_access_key || '',
            minio_secret_key: network.minio_secret_key || '', minio_bucket: network.minio_bucket || '',
            minio_object_path: network.minio_object_path || '', minio_use_ssl: network.minio_use_ssl || false,
            minio_region: network.minio_region || 'us-east-1',
            target_source_type: network.target_source_type || 'database',
            target_db_driver: network.target_db_driver || 'postgres',
            target_db_host: network.target_db_host || '', target_db_port: network.target_db_port || '5432',
            target_db_user: network.target_db_user || '', target_db_password: network.target_db_password || '',
            target_db_name: network.target_db_name || '', target_db_sslmode: network.target_db_sslmode || 'disable',
            target_ftp_host: network.target_ftp_host || '', target_ftp_port: network.target_ftp_port || '21',
            target_ftp_user: network.target_ftp_user || '', target_ftp_password: network.target_ftp_password || '',
            target_ftp_private_key: network.target_ftp_private_key || '', target_ftp_path: network.target_ftp_path || '',
            target_api_url: network.target_api_url || '', target_api_method: network.target_api_method || 'POST',
            target_api_headers: network.target_api_headers || '', target_api_auth_type: network.target_api_auth_type || 'none',
            target_api_auth_key: network.target_api_auth_key || '', target_api_auth_value: network.target_api_auth_value || '',
            target_api_body: network.target_api_body || '',
            target_minio_endpoint: network.target_minio_endpoint || '', target_minio_access_key: network.target_minio_access_key || '',
            target_minio_secret_key: network.target_minio_secret_key || '', target_minio_bucket: network.target_minio_bucket || '',
            target_minio_object_path: network.target_minio_object_path || '', target_minio_use_ssl: network.target_minio_use_ssl || false,
            target_minio_region: network.minio_region || 'us-east-1',
            target_minio_export_format: network.target_minio_export_format || 'csv',
            notes: network.notes || '',
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
        setFormData({ ...INITIAL_FORM_DATA });
        setEditingId(null);
        setShowForm(false);
    };

    const handleTestConnection = async (network) => {
        const type = network.source_type || 'database';
        let hasHost = false;
        switch (type) {
            case 'database': hasHost = !!network.db_host; break;
            case 'ftp': case 'sftp': hasHost = !!network.ftp_host; break;
            case 'api': hasHost = !!network.api_url; break;
            case 'minio': hasHost = !!network.minio_endpoint; break;
            default: hasHost = false;
        }
        if (!hasHost) { addToast(`No host/URL configured for this ${type} network`, 'warning'); return; }
        try {
            setTestingNetwork(network.id);
            const response = await testConnectionMutation.mutateAsync(network.id);
            if (response.data.success) {
                addToast(`Connection successful! ${response.data.message || ''} ${response.data.duration ? `(${response.data.duration}ms)` : ''}`, 'success');
            } else {
                addToast(response.data.error || 'Connection failed', 'error');
            }
        } catch (error) {
            console.error('Test failed:', error);
            addToast('Failed to test connection: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setTestingNetwork(null); }
    };

    const handleTestTargetConnection = async (network) => {
        const type = network.target_source_type || 'database';
        let hasHost = false;
        switch (type) {
            case 'database': hasHost = !!network.target_db_host; break;
            case 'ftp': case 'sftp': hasHost = !!network.target_ftp_host; break;
            case 'api': hasHost = !!network.target_api_url; break;
            case 'minio': hasHost = !!network.target_minio_endpoint; break;
            default: hasHost = false;
        }
        if (!hasHost) { addToast(`No target host/URL configured for this ${type} network`, 'warning'); return; }
        try {
            setTestingTargetNetwork(network.id);
            const response = await testTargetConnectionMutation.mutateAsync(network.id);
            if (response.data.success) {
                addToast(`${response.data.message || 'Target connection successful!'} ${response.data.duration ? `(${response.data.duration}ms)` : ''}`, 'success');
            } else {
                addToast(response.data.error || 'Target connection failed', 'error');
            }
        } catch (error) {
            console.error('Target test failed:', error);
            addToast('Failed to test target connection: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setTestingTargetNetwork(null); }
    };

    const handleReverseNetwork = async (network) => {
        try {
            setReversingNetwork(network.id);
            await reverseNetworkMutation.mutateAsync(network.id);
            addToast(`Network "${network.name}" source/target reversed!`, 'success');
        } catch (error) {
            console.error('Failed to reverse network:', error);
            addToast(getErrorMessage(error, 'Failed to reverse network. Please try again.'), 'error');
        } finally { setReversingNetwork(null); }
    };

    const handleClone = async (network) => {
        try {
            setCloningNetwork(network.id);
            await cloneNetworkMutation.mutateAsync({ id: network.id });
            addToast(`Network "${network.name}" cloned successfully!`, 'success');
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to clone network:', error);
            addToast(getErrorMessage(error, 'Failed to clone network. Please try again.'), 'error');
        } finally { setCloningNetwork(null); }
    };

    // ===== Render =====

    return (
        <div className="h-full">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {!showForm ? (
                <div className={`min-h-screen animate-fade-in ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
                        {/* Page Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className={`text-3xl font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Network Management</h1>
                                <p className={isDark ? 'text-slate-400 mt-1' : 'text-slate-500 mt-1'}>Manage database connections and file servers</p>
                            </div>
                        </div>

                        {/* Top Action Bar */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                {userRole === 'admin' && (
                                    <button
                                        onClick={() => {
                                            resetForm();
                                            setShowForm(true);
                                        }}
                                        className={`px-6 py-2.5 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-2 ${
                                            isDark ? 'bg-blue-700 hover:bg-blue-600 shadow-blue-900/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                        }`}
                                    >
                                        <Plus className="w-5 h-5" />
                                        New Network
                                    </button>
                                )}
                            </div>

                            <div className={`flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl border shadow-sm w-full lg:w-auto ${
                                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                            }`}>
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search ID/Name/IP..."
                                        value={searchName}
                                        onChange={(e) => setSearchName(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className={`w-full pl-9 pr-4 py-2 border-transparent rounded-xl text-sm transition-all outline-none ${
                                            isDark ? 'bg-slate-800 text-slate-200 focus:bg-slate-700' : 'bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500'
                                        }`}
                                    />
                                </div>
                                <div className="relative flex-1 sm:w-64">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search Notes..."
                                        value={searchNotes}
                                        onChange={(e) => setSearchNotes(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className={`w-full pl-9 pr-4 py-2 border-transparent rounded-xl text-sm transition-all outline-none ${
                                            isDark ? 'bg-slate-800 text-slate-200 focus:bg-slate-700' : 'bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500'
                                        }`}
                                    />
                                </div>
                                <button 
                                    onClick={handleSearch}
                                    className={`w-full sm:w-auto px-6 py-2 text-white rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                    isDark ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
                                }`}>
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* Data Table Container */}
                        <div className={`rounded-3xl border shadow-xl overflow-hidden ${
                            isDark ? 'bg-slate-900 border-slate-800 shadow-black/20' : 'bg-white border-slate-200 shadow-slate-200/50'
                        }`}>
                            <NetworkTable
                                networks={networks}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                userRole={userRole}
                                testingNetwork={testingNetwork}
                                testingTargetNetwork={testingTargetNetwork}
                                reversingNetwork={reversingNetwork}
                                cloningNetwork={cloningNetwork}
                                onTestSource={handleTestConnection}
                                onTestTarget={handleTestTargetConnection}
                                onReverse={handleReverseNetwork}
                                onView={setSelectedNetwork}
                                onAdd={() => { resetForm(); setShowForm(true); }}
                                onEdit={handleEdit}
                                onClone={handleClone}
                                onDelete={setDeleteTarget}
                            />
                        </div>

                        {/* Pagination */}
                        {(networks || []).length > 0 && (
                            <Pagination
                                currentPage={currentPage}
                                totalItems={(networks || []).length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        )}

                        {(networks || []).length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                <NetworkIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No networks yet. Create one to get started.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-full animate-slide-up">
                    <NetworkForm
                        formData={formData}
                        setFormData={setFormData}
                        editingId={editingId}
                        isSubmitting={isSubmitting}
                        onSubmit={handleSubmit}
                        onCancel={resetForm}
                        addToast={addToast}
                    />
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
