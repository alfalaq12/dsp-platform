import { useState, useEffect } from 'react';
import { Plus, Trash2, Search, User, Shield, Key, Edit, X } from 'lucide-react';
import { getUsers, createUser, deleteUser, updateUser } from '../services/api';
import { ConfirmModal, useToast, ToastContainer } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';

function Users() {
    const { isDark } = useTheme();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { toasts, addToast, removeToast } = useToast();

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
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await getUsers();
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            addToast('Failed to fetch users', 'error');
        } finally {
            setLoading(false);
        }
    };

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

                await updateUser(selectedUser.id, updateData);
                addToast('User updated successfully', 'success');
            } else {
                // Create
                await createUser(formData);
                addToast('User created successfully', 'success');
            }

            setIsModalOpen(false);
            fetchUsers();
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
            await deleteUser(deleteTarget.id);
            addToast(`User "${deleteTarget.username}" deleted successfully`, 'success');
            fetchUsers();
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-blue-500' : 'text-slate-800'}`}>User Management</h1>
                    <p className={isDark ? 'text-panda-text-muted mt-1' : 'text-slate-600 mt-1'}>Manage platform access and roles</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-panda-dark font-semibold rounded-xl hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Add User
                </button>
            </div>

            {/* Search and Filter */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-panda-dark-200 border-panda-dark-300' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-panda-text-muted w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-panda-dark-300 border border-panda-dark-400 rounded-lg text-panda-text focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
            </div>

            <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-panda-dark-200 border-panda-dark-300' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className={`border-b ${isDark ? 'border-panda-dark-300 bg-panda-dark-300/50' : 'border-slate-100 bg-slate-50'}`}>
                                <th className={`px-6 py-4 text-sm font-semibold ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Username</th>
                                <th className={`px-6 py-4 text-sm font-semibold ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Role</th>
                                <th className={`px-6 py-4 text-sm font-semibold ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Created At</th>
                                <th className={`px-6 py-4 text-sm font-semibold text-right ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-panda-dark-300' : 'divide-slate-100'}`}>
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className={`px-6 py-8 text-center ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Loading users...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className={`px-6 py-8 text-center ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>No users found</td>
                                </tr>
                            ) : (
                                filteredUsers
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((user) => (
                                        <tr key={user.id} className={`transition-colors ${isDark ? 'hover:bg-panda-dark-300/30' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-panda-dark-400 text-blue-500' : 'bg-blue-100 text-blue-600'}`}>
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <span className={`font-medium ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{user.username}</span>
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
                                            <td className={`px-6 py-4 text-sm ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenEdit(user)}
                                                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-panda-text-muted hover:text-blue-500 hover:bg-blue-500/10' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
                                                        title="Edit User"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>

                                                    {user.username !== 'admin' && (
                                                        <button
                                                            onClick={() => handleDeleteClick(user)}
                                                            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-panda-text-muted hover:text-red-400 hover:bg-red-400/10' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
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
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filteredUsers.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                )}
            </div>

            {/* Add/Edit User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden modal-scale-in transition-all ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {isEditing ? 'Edit User' : 'Create New User'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
                                <div className="relative">
                                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                                            ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                            }`}
                                        placeholder="Enter username"
                                        required
                                        disabled={isEditing} // Username cannot be changed
                                    />
                                </div>
                                {isEditing && <p className={`text-xs mt-1 ml-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Username cannot be changed</p>}
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {isEditing ? 'New Password (leave blank to keep)' : 'Password'}
                                </label>
                                <div className="relative">
                                    <Key className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${isDark
                                            ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                                            : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                            }`}
                                        placeholder={isEditing ? "Enter new password" : "Enter password"}
                                        required={!isEditing}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Role</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'viewer' })}
                                        disabled={isEditing && selectedUser?.username === 'admin'}
                                        className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${formData.role === 'viewer'
                                            ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                                            : isDark
                                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        <User className="w-4 h-4" />
                                        Viewer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'admin' })}
                                        className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.role === 'admin'
                                            ? 'bg-purple-500/10 border-purple-500 text-purple-500'
                                            : isDark
                                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Admin
                                    </button>
                                </div>
                                {isEditing && selectedUser?.username === 'admin' && (
                                    <p className="text-xs text-orange-400 mt-1 ml-1">Main admin role cannot be changed</p>
                                )}
                            </div>

                            {error && (
                                <div className={`p-3 rounded-lg text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                    {error}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {formLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
