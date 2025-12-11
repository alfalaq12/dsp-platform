import { useState, useEffect } from 'react';
import { Plus, Trash2, Search, User, Shield, Key } from 'lucide-react';
import { getUsers, createUser, deleteUser } from '../services/api';

function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({ username: '', password: '', role: 'viewer' });
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await getUsers();
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');

        try {
            await createUser(formData);
            setIsAddModalOpen(false);
            setFormData({ username: '', password: '', role: 'viewer' });
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;

        try {
            await deleteUser(id);
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to delete user');
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-panda-gold">User Management</h1>
                    <p className="text-panda-text-muted mt-1">Manage platform access and roles</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-panda-gold text-panda-dark font-semibold rounded-xl hover:bg-panda-gold-light transition-colors shadow-lg shadow-panda-gold/20"
                >
                    <Plus className="w-5 h-5" />
                    Add User
                </button>
            </div>

            {/* Search and Filter */}
            <div className="bg-panda-dark-200 p-4 rounded-xl border border-panda-dark-300">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-panda-text-muted w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-panda-dark-300 border border-panda-dark-400 rounded-lg text-panda-text focus:outline-none focus:border-panda-gold transition-colors"
                    />
                </div>
            </div>

            <div className="bg-panda-dark-200 rounded-xl border border-panda-dark-300 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-panda-dark-300 bg-panda-dark-300/50">
                                <th className="px-6 py-4 text-sm font-semibold text-panda-text-muted">Username</th>
                                <th className="px-6 py-4 text-sm font-semibold text-panda-text-muted">Role</th>
                                <th className="px-6 py-4 text-sm font-semibold text-panda-text-muted">Created At</th>
                                <th className="px-6 py-4 text-sm font-semibold text-panda-text-muted text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-panda-dark-300">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-panda-text-muted">Loading users...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-panda-text-muted">No users found</td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-panda-dark-300/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-panda-dark-400 flex items-center justify-center text-panda-gold">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <span className="font-medium text-panda-text">{user.username}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${user.role === 'admin'
                                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                }`}>
                                                <Shield className="w-3 h-3" />
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-panda-text-muted">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="p-2 text-panda-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-panda-dark-200 w-full max-w-md rounded-2xl border border-panda-dark-300 shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-panda-dark-300 flex justify-between items-center bg-panda-dark-300/30">
                            <h3 className="text-xl font-semibold text-panda-gold">Create New User</h3>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-panda-text-muted hover:text-white transition-colors"
                            >
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-panda-text mb-2">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-panda-text-muted w-5 h-5" />
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-panda-dark-300 border border-panda-dark-400 rounded-xl text-panda-text focus:outline-none focus:border-panda-gold transition-colors"
                                        placeholder="Enter username"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-panda-text mb-2">Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-panda-text-muted w-5 h-5" />
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-panda-dark-300 border border-panda-dark-400 rounded-xl text-panda-text focus:outline-none focus:border-panda-gold transition-colors"
                                        placeholder="Enter password"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-panda-text mb-2">Role</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'viewer' })}
                                        className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.role === 'viewer'
                                                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                                : 'bg-panda-dark-300 border-panda-dark-400 text-panda-text-muted hover:border-panda-text-muted'
                                            }`}
                                    >
                                        <User className="w-4 h-4" />
                                        Viewer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'admin' })}
                                        className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.role === 'admin'
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                                : 'bg-panda-dark-300 border-panda-dark-400 text-panda-text-muted hover:border-panda-text-muted'
                                            }`}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Admin
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="w-full py-3 bg-panda-gold text-panda-dark font-bold rounded-xl hover:bg-panda-gold-light transition-colors shadow-lg shadow-panda-gold/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {formLoading ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Users;
