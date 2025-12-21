import { useState, useRef } from 'react';
import { useBackups, useCreateBackup, useRestoreBackup, useDeleteBackup } from '../hooks/useQueries';
import { getBackupDownloadUrl } from '../services/api';
import { useToast, ToastContainer, ConfirmModal } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { RefreshCw, Info, Settings as SettingsIcon, HardDrive, Download, Trash2, Upload, Archive, Clock, FileArchive, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function Settings() {
    const { isDark } = useTheme();
    const { toasts, addToast, removeToast } = useToast();

    // Backup state
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, filename: '' });
    const [restoreConfirm, setRestoreConfirm] = useState({ show: false, file: null });
    const fileInputRef = useRef(null);

    // Backup hooks
    const { data: backupsData, isLoading: isLoadingBackups } = useBackups();
    const createBackupMutation = useCreateBackup();
    const restoreBackupMutation = useRestoreBackup();
    const deleteBackupMutation = useDeleteBackup();

    // Backup handlers
    const handleCreateBackup = async () => {
        try {
            setIsCreatingBackup(true);
            await createBackupMutation.mutateAsync();
            addToast('Backup created successfully!', 'success');
        } catch (error) {
            console.error('Backup failed:', error);
            addToast('Failed to create backup: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setIsCreatingBackup(false);
        }
    };

    const handleDownloadBackup = (filename) => {
        window.open(getBackupDownloadUrl(filename), '_blank');
    };

    const handleDeleteBackup = async () => {
        try {
            await deleteBackupMutation.mutateAsync(deleteConfirm.filename);
            addToast('Backup deleted successfully!', 'success');
            setDeleteConfirm({ show: false, filename: '' });
        } catch (error) {
            console.error('Delete failed:', error);
            addToast('Failed to delete backup: ' + (error.response?.data?.error || error.message), 'error');
        }
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.zip')) {
                addToast('Please select a .zip backup file', 'warning');
                return;
            }
            setRestoreConfirm({ show: true, file });
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const handleRestore = async () => {
        if (!restoreConfirm.file) return;

        try {
            setIsRestoring(true);
            const formData = new FormData();
            formData.append('backup', restoreConfirm.file);

            const response = await restoreBackupMutation.mutateAsync(formData);
            addToast(response.data.message || 'Backup restored successfully!', 'success');
            setRestoreConfirm({ show: false, file: null });

            if (response.data.restart_needed) {
                addToast('Please restart the server for changes to take effect.', 'warning');
            }
        } catch (error) {
            console.error('Restore failed:', error);
            addToast('Failed to restore backup: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setIsRestoring(false);
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-8">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Premium Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 border-slate-200/60 shadow-lg'}`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-teal-500/10 rounded-full blur-3xl"></div>

                <div className="relative">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700'}`}>
                        <SettingsIcon className="w-3 h-3" />
                        System Administration
                    </div>
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Platform Settings</h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Backup, restore, and system configuration</p>
                </div>
            </div>

            {/* Quick Links Info */}
            <div className={`rounded-2xl p-6 border ${isDark ? 'bg-blue-900/10 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        <Info className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h3 className={`font-bold text-lg mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>Target Database Configuration</h3>
                        <p className={`text-base leading-relaxed mb-3 ${isDark ? 'text-blue-200/70' : 'text-blue-700/80'}`}>
                            Target database configuration is now set per-network. Each network has its own SOURCE and TARGET configuration for flexible data synchronization.
                        </p>
                        <Link
                            to="/network"
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                        >
                            Go to Network Management
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Backup & Restore Section */}
            <div className={`rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className={`px-8 py-6 border-b flex items-center justify-between ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/80'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                            <HardDrive className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Backup & Restore
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Backup database, config, and certificates for migration
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".zip"
                            className="hidden"
                        />
                        <button
                            onClick={handleRestoreClick}
                            disabled={isRestoring}
                            className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                        >
                            {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {isRestoring ? 'Restoring...' : 'Restore Backup'}
                        </button>
                        <button
                            onClick={handleCreateBackup}
                            disabled={isCreatingBackup}
                            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isCreatingBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                            {isCreatingBackup ? 'Creating...' : 'Backup Now'}
                        </button>
                    </div>
                </div>

                <div className="p-8">
                    {isLoadingBackups ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : backupsData?.backups?.length > 0 ? (
                        <div className="space-y-3">
                            {backupsData.backups.map((backup) => (
                                <div
                                    key={backup.filename}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isDark ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-lg ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                                            <FileArchive className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                {backup.filename}
                                            </p>
                                            <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatDate(backup.created_at)}
                                                </span>
                                                <span>•</span>
                                                <span>{formatBytes(backup.size)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDownloadBackup(backup.filename)}
                                            className={`p-2.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-blue-400' : 'hover:bg-slate-200 text-slate-500 hover:text-blue-600'}`}
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm({ show: true, filename: backup.filename })}
                                            className={`p-2.5 rounded-lg transition-all ${isDark ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-red-100 text-slate-500 hover:text-red-600'}`}
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="font-medium">No backups available</p>
                            <p className="text-sm mt-1">Create a backup to protect your data</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteConfirm.show}
                onClose={() => setDeleteConfirm({ show: false, filename: '' })}
                onConfirm={handleDeleteBackup}
                title="Delete Backup"
                message={`Are you sure you want to delete "${deleteConfirm.filename}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
            />

            {/* Restore Confirmation Modal */}
            <ConfirmModal
                isOpen={restoreConfirm.show}
                onClose={() => setRestoreConfirm({ show: false, file: null })}
                onConfirm={handleRestore}
                title="Restore Backup"
                message={`Are you sure you want to restore from "${restoreConfirm.file?.name}"? This will overwrite current database, config, and certificates. You may need to restart the server after restore.`}
                confirmText="Restore"
                variant="warning"
            />
        </div>
    );
}

export default Settings;
