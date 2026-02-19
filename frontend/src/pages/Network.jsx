import { useState } from 'react';
import { Plus, Network as NetworkIcon, Circle } from 'lucide-react';
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
};

function Network() {
    const { isDark } = useTheme();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA });

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
    const { data: networks = [] } = useNetworks();
    const createNetworkMutation = useCreateNetwork();
    const updateNetworkMutation = useUpdateNetwork();
    const deleteNetworkMutation = useDeleteNetwork();
    const testConnectionMutation = useTestNetworkConnection();
    const testTargetConnectionMutation = useTestNetworkTargetConnection();
    const reverseNetworkMutation = useReverseNetwork();
    const cloneNetworkMutation = useCloneNetwork();

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
            target_minio_region: network.target_minio_region || 'us-east-1',
            target_minio_export_format: network.target_minio_export_format || 'csv',
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
                addToast(`Test command sent to agent "${network.name}"`, 'success');
            } else {
                addToast(response.data.error || 'Test failed', 'error');
            }
        } catch (error) {
            console.error('Test failed:', error);
            addToast('Failed to send test command: ' + (error.response?.data?.error || error.message), 'error');
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
                addToast(`Target connection successful! Host: ${response.data.host || response.data.url || 'OK'}`, 'success');
            } else {
                addToast(response.data.error || 'Target test failed', 'error');
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
        <div className="space-y-6">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-purple-50/30 to-blue-50/20 border-slate-200/60 shadow-lg'}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-3xl"></div>
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                            <NetworkIcon className="w-3 h-3" /> Connectivity
                        </div>
                        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Network Management</h1>
                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Manage database connections and file servers</p>
                    </div>
                    {userRole === 'admin' && (
                        <button onClick={() => setShowForm(!showForm)}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5">
                            <Plus className="w-5 h-5" /><span className="font-medium">New Network</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Network Form (extracted component) */}
            {showForm && (
                <NetworkForm
                    formData={formData}
                    setFormData={setFormData}
                    editingId={editingId}
                    isSubmitting={isSubmitting}
                    onSubmit={handleSubmit}
                    onCancel={resetForm}
                    addToast={addToast}
                />
            )}

            {/* Network Table + Cards (extracted component) */}
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
                onEdit={handleEdit}
                onClone={handleClone}
                onDelete={setDeleteTarget}
            />

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
