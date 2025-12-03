import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Network as NetworkIcon, Circle } from 'lucide-react';
import { getNetworks, createNetwork, updateNetwork, deleteNetwork } from '../services/api';

function Network() {
    const [networks, setNetworks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        ip_address: '',
        type: 'source',
    });

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
        try {
            if (editingId) {
                await updateNetwork(editingId, formData);
            } else {
                await createNetwork(formData);
            }
            loadNetworks();
            resetForm();
        } catch (error) {
            console.error('Failed to save network:', error);
        }
    };

    const handleEdit = (network) => {
        setFormData({
            name: network.name,
            ip_address: network.ip_address,
            type: network.type,
        });
        setEditingId(network.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Delete this network?')) {
            try {
                await deleteNetwork(id);
                loadNetworks();
            } catch (error) {
                console.error('Failed to delete network:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({ name: '', ip_address: '', type: 'source' });
        setEditingId(null);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Network Management</h1>
                    <p className="text-slate-400">Manage data sources and targets</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                    <Plus className="w-5 h-5" />
                    New Network
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            placeholder="Name"
                            required
                        />
                        <input
                            type="text"
                            value={formData.ip_address}
                            onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            placeholder="IP Address"
                            required
                        />
                        <div className="flex gap-3">
                            <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-lg">
                                {editingId ? 'Update' : 'Add'}
                            </button>
                            <button type="button" onClick={resetForm} className="px-6 py-2 bg-slate-700 text-white rounded-lg">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {networks.map((network) => (
                    <div key={network.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <div className="flex justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{network.name}</h3>
                                <p className="text-sm text-slate-400">{network.ip_address}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(network)} className="p-2 text-blue-400">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(network.id)} className="p-2 text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-400">Status</span>
                            <span className={network.status === 'online' ? 'text-green-400' : 'text-red-400'}>
                                <Circle className="w-2 h-2 fill-current inline" /> {network.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Network;
