import { useState } from 'react';
import { useAgentTokens, useCreateAgentToken, useRevokeAgentToken, useDeleteAgentToken } from '../hooks/useQueries';
import { useToast, ToastContainer, ConfirmModal } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import {
    Key, Plus, Trash2, Ban, RefreshCw, Copy, CheckCircle,
    Clock, Shield, AlertTriangle, Eye, EyeOff
} from 'lucide-react';

function TokenManagement() {
    const { isDark } = useTheme();
    const { toasts, addToast, removeToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [newToken, setNewToken] = useState(null); // Stores newly created token
    const [formData, setFormData] = useState({
        agent_name: '',
        description: '',
        retention: '365' // Default 1 year
    });

    // React Query hooks
    const { data: tokens = [], isLoading, refetch } = useAgentTokens();
    const createTokenMutation = useCreateAgentToken();
    const revokeTokenMutation = useRevokeAgentToken();
    const deleteTokenMutation = useDeleteAgentToken();

    // Confirm modal states
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        variant: 'warning',
        onConfirm: null,
        confirmText: 'Confirm'
    });

    // Retention options (up to 4 years for government projects)
    const retentionOptions = [
        { value: '90', label: '3 Bulan' },
        { value: '180', label: '6 Bulan' },
        { value: '365', label: '1 Tahun' },
        { value: '730', label: '2 Tahun' },
        { value: '1095', label: '3 Tahun' },
        { value: '1460', label: '4 Tahun' },
        { value: '0', label: 'Tidak Expire' },
    ];

    const handleCreateToken = async (e) => {
        e.preventDefault();
        if (!formData.agent_name.trim()) {
            addToast('Agent name is required', 'warning');
            return;
        }

        try {
            const response = await createTokenMutation.mutateAsync({
                agent_name: formData.agent_name,
                description: formData.description,
                expires_in: parseInt(formData.retention)
            });

            // Store the new token to display (only shown once!)
            setNewToken({
                token: response.data.token,
                agent_name: response.data.agent_name
            });

            addToast('Token created successfully!', 'success');
            setFormData({ agent_name: '', description: '', retention: '365' });
            setShowForm(false);
        } catch (error) {
            console.error('Failed to create token:', error);
            addToast(error.response?.data?.error || 'Failed to create token', 'error');
        }
    };

    const handleRevoke = (token) => {
        setConfirmModal({
            isOpen: true,
            title: 'Revoke Token',
            message: `Apakah Anda yakin ingin merevoke token untuk agent "${token.agent_name}"? Agent tidak akan bisa terhubung lagi.`,
            variant: 'warning',
            confirmText: 'Revoke',
            onConfirm: async () => {
                try {
                    await revokeTokenMutation.mutateAsync(token.id);
                    addToast('Token revoked successfully', 'success');
                } catch (error) {
                    addToast('Failed to revoke token', 'error');
                }
                setConfirmModal({ ...confirmModal, isOpen: false });
            }
        });
    };

    const handleDelete = (token) => {
        setConfirmModal({
            isOpen: true,
            title: 'Hapus Token',
            message: `Apakah Anda yakin ingin menghapus token untuk agent "${token.agent_name}" secara permanen?`,
            variant: 'danger',
            confirmText: 'Hapus',
            onConfirm: async () => {
                try {
                    await deleteTokenMutation.mutateAsync(token.id);
                    addToast('Token deleted successfully', 'success');
                } catch (error) {
                    addToast('Failed to delete token', 'error');
                }
                setConfirmModal({ ...confirmModal, isOpen: false });
            }
        });
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        addToast('Copied to clipboard!', 'success');
    };

    const formatDate = (date) => {
        if (!date) return 'Never';
        return new Date(date).toLocaleDateString('id-ID', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const getStatusBadge = (token) => {
        if (token.revoked) {
            return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">Revoked</span>;
        }
        if (token.expires_at && new Date(token.expires_at) < new Date()) {
            return <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">Expired</span>;
        }
        return <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Active</span>;
    };

    return (
        <div className="space-y-6">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                variant={confirmModal.variant}
            />

            {/* Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-amber-50/30 to-orange-50/20 border-slate-200/60 shadow-lg'}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full blur-3xl"></div>
                <div className="relative flex items-center justify-between">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                            <Key className="w-3 h-3" />
                            Security
                        </div>
                        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Agent Tokens</h1>
                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                            Manage authentication tokens for tenant agents
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white rounded-xl font-medium shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Generate Token
                    </button>
                </div>
            </div>

            {/* New Token Display (shown only once after creation) */}
            {newToken && (
                <div className={`p-6 rounded-2xl border-2 border-emerald-500 ${isDark ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-emerald-500/20">
                            <CheckCircle className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                                Token Created for "{newToken.agent_name}"
                            </h3>
                            <p className={`text-sm mb-4 ${isDark ? 'text-emerald-200/70' : 'text-emerald-700'}`}>
                                ⚠️ <strong>IMPORTANT:</strong> Copy this token now! It will not be shown again.
                            </p>
                            <div className={`p-4 rounded-xl font-mono text-sm break-all ${isDark ? 'bg-slate-900 text-emerald-400' : 'bg-white text-emerald-700 border'}`}>
                                {newToken.token}
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => copyToClipboard(newToken.token)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
                                >
                                    <Copy className="w-4 h-4" />
                                    Copy Token
                                </button>
                                <button
                                    onClick={() => copyToClipboard(`AGENT_NAME=${newToken.agent_name}\nAGENT_TOKEN=${newToken.token}`)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                                >
                                    <Copy className="w-4 h-4" />
                                    Copy .env Format
                                </button>
                                <button
                                    onClick={() => setNewToken(null)}
                                    className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Token Form */}
            {showForm && (
                <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                    <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        <Key className="w-5 h-5 text-amber-500" />
                        Generate New Token
                    </h3>
                    <form onSubmit={handleCreateToken} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Agent Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.agent_name}
                                    onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                    placeholder="e.g., pusat-perbelanjaan-A"
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                    placeholder="e.g., Mall Jakarta Pusat"
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Token Retention
                                </label>
                                <select
                                    value={formData.retention}
                                    onChange={(e) => setFormData({ ...formData, retention: e.target.value })}
                                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                >
                                    {retentionOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium shadow-lg shadow-amber-500/20"
                            >
                                <Key className="w-4 h-4" />
                                Generate Token
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className={`px-6 py-2.5 rounded-xl ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tokens List */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Token List ({tokens.length})
                    </h3>
                    <button onClick={() => refetch()} className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                    </div>
                ) : tokens.length === 0 ? (
                    <div className={`p-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Key className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No tokens created yet</p>
                        <p className="text-sm mt-1">Click "Generate Token" to create one</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className={isDark ? 'bg-slate-900/50' : 'bg-slate-50'}>
                                <tr>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Agent</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Token</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Created</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Expires</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Last Used</th>
                                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                {tokens.map(token => (
                                    <tr key={token.id} className={isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}>
                                        <td className="px-6 py-4">
                                            <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{token.agent_name}</div>
                                            {token.description && (
                                                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{token.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className={`text-sm font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                                {token.token_prefix}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(token)}</td>
                                        <td className={`px-6 py-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {formatDate(token.created_at)}
                                        </td>
                                        <td className={`px-6 py-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {formatDate(token.expires_at)}
                                        </td>
                                        <td className={`px-6 py-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {token.last_used_at ? formatDate(token.last_used_at) : 'Never'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {!token.revoked && (
                                                    <button
                                                        onClick={() => handleRevoke(token)}
                                                        className="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg"
                                                        title="Revoke Token"
                                                    >
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(token)}
                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                                                    title="Delete Token"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className={`rounded-2xl p-6 border ${isDark ? 'bg-amber-900/10 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                            Cara Penggunaan Token
                        </h3>
                        <ol className={`text-sm space-y-2 list-decimal list-inside ${isDark ? 'text-amber-200/70' : 'text-amber-700/80'}`}>
                            <li>Generate token untuk agent baru</li>
                            <li>Copy token dan simpan di file <code className="px-1.5 py-0.5 rounded bg-amber-500/20">.env</code> agent</li>
                            <li>Agent akan menggunakan token ini saat mendaftar ke Master</li>
                            <li>Token dapat di-revoke kapan saja untuk memutus koneksi agent</li>
                        </ol>
                        <div className={`mt-4 p-3 rounded-xl font-mono text-xs ${isDark ? 'bg-slate-900 text-amber-400' : 'bg-white text-amber-700 border border-amber-200'}`}>
                            # Agent .env file<br />
                            AGENT_NAME=pusat-perbelanjaan-A<br />
                            AGENT_TOKEN=your-token-here
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TokenManagement;
