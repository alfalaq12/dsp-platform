import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Search, User, Shield, Key, Edit, X } from 'lucide-react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/useQueries';
import { ConfirmModal, useToast, ToastContainer } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';

function Users() {
    const { isDark } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { toasts, addToast, removeToast } = useToast();

    // React Query hooks - auto caching & invalidation
    const { data: users = [], isLoading: loading } = useUsers();
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const deleteUserMutation = useDeleteUser();

    // Form state
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState({ username: '', password: '', role: 'viewer' });
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const handleOpenAdd = () => {
        setIsEditing(false);
        setSelectedUser(null);
        setFormData({ username: '', password: '', role: 'viewer' });
        setError('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user) => {
        setIsEditing(true);
        setSelectedUser(user);
        // Don't fill password for edit, only role and display username
        setFormData({ username: user.username, password: '', role: user.role });
        setError('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');

        try {
            if (isEditing) {
                // Update
                const updateData = {};
                if (formData.password) updateData.password = formData.password;
                if (formData.role && formData.role !== selectedUser.role) updateData.role = formData.role;

                if (Object.keys(updateData).length === 0) {
                    setIsModalOpen(false);
                    return;
                }

                await updateUserMutation.mutateAsync({ id: selectedUser.id, data: updateData });
                addToast('User updated successfully', 'success');
            } else {
                // Create
                await createUserMutation.mutateAsync(formData);
                addToast('User created successfully', 'success');
            }

            setIsModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${isEditing ? 'update' : 'create'} user`);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteClick = (user) => {
        setDeleteTarget(user);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteUserMutation.mutateAsync(deleteTarget.id);
            addToast(`User "${deleteTarget.username}" deleted successfully`, 'success');
        } catch (error) {
            addToast(error.response?.data?.error || 'Failed to delete user', 'error');
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Premium Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 border-slate-200/60 shadow-lg'}`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl"></div>

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                            <Shield className="w-3 h-3" />
                            Access Control
                        </div>
                        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>User Management</h1>
                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Manage platform access and assign roles</p>
                    </div>
                    <button
                        onClick={handleOpenAdd}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Add User</span>
                    </button>
                </div>
            </div>

            {/* Search and Filter */}
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="relative">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                        type="text"
                        placeholder="Search users by name or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className={`rounded-2xl overflow-hidden border shadow-xl ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700/50 bg-slate-800/80' : 'border-slate-50/50 border-slate-200'}`}>
                    <h3 className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>User List</h3>
                    <div className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        {filteredUsers.length} Users
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className={isDark ? 'bg-slate-900/50 border-b border-slate-700' : 'bg-slate-50/80 border-b border-slate-200'}>
                            <tr>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Username</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Role</th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Created At</th>
                                <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Loading users...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className={`px-6 py-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No users found matching your search.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((user) => (
                                        <tr key={user.id} className={`group transition-all duration-200 ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700 text-blue-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{user.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${user.role === 'admin'
                                                    ? (isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-100')
                                                    : (isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-100')
                                                    }`}>
                                                    <Shield className="w-3 h-3" />
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleOpenEdit(user)}
                                                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-700' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                        title="Edit User"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>

                                                    {user.username !== 'admin' && (
                                                        <button
                                                            onClick={() => handleDeleteClick(user)}
                                                            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                            title="Delete User"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredUsers.length > 0 && (
                    <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={filteredUsers.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    </div>
                )}
            </div>
            {/* Add/Edit User Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all" onClick={() => setIsModalOpen(false)}>
                    <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden modal-scale-in ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} onClick={(e) => e.stopPropagation()}>
                        <div className={`px-8 py-6 border-b flex justify-between items-center ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-50 bg-slate-50/80'}`}>
                            <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {isEditing ? <Edit className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                                {isEditing ? 'Edit User' : 'Create New User'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
                                <div className="relative">
                                    <User className={`absolute left-4 top-3.5 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                                            ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500'
                                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                            }`}
                                        placeholder="Enter username"
                                        required
                                        disabled={isEditing}
                                    />
                                </div>
                                {isEditing && <p className={`text-xs mt-2 ml-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Username cannot be changed</p>}
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {isEditing ? 'New Password (leave blank to keep)' : 'Password'}
                                </label>
                                <div className="relative">
                                    <Key className={`absolute left-4 top-3.5 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${isDark
                                            ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500'
                                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                            }`}
                                        placeholder={isEditing ? "Enter new password" : "Enter password"}
                                        required={!isEditing}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Role</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'viewer' })}
                                        disabled={isEditing && selectedUser?.username === 'admin'}
                                        className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${formData.role === 'viewer'
                                            ? 'bg-blue-500/10 border-blue-500 text-blue-500 ring-1 ring-blue-500'
                                            : isDark
                                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                            }`}
                                    >
                                        <User className="w-4 h-4" />
                                        Viewer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'admin' })}
                                        className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.role === 'admin'
                                            ? 'bg-purple-500/10 border-purple-500 text-purple-500 ring-1 ring-purple-500'
                                            : isDark
                                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                            }`}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Admin
                                    </button>
                                </div>
                                {isEditing && selectedUser?.username === 'admin' && (
                                    <p className="text-xs text-amber-500 mt-2 ml-1 flex items-center gap-1">
                                        <Shield className="w-3 h-3" /> Main admin role cannot be changed
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div className={`p-4 rounded-xl text-sm border flex items-center gap-3 ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                    <div className={`p-1 rounded-full ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                                        <X className="w-4 h-4" />
                                    </div>
                                    {error}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {formLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                , document.body)}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete User"
                message={`Are you sure you want to delete user "${deleteTarget?.username}"? This action cannot be undone.`}
                confirmText="Delete User"
                isLoading={isDeleting}
            />
        </div>
    );
}

export default Users;
