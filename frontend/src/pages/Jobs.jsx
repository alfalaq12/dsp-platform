import { useEffect, useState } from 'react';
import { Plus, Play, RefreshCw } from 'lucide-react';
import { getJobs, getSchemas, getNetworks, createJob, runJob } from '../services/api';

function Jobs() {
    const [jobs, setJobs] = useState([]);
    const [schemas, setSchemas] = useState([]);
    const [networks, setNetworks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', schema_id: '', network_id: '', schedule: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [jobsRes, schemasRes, networksRes] = await Promise.all([
                getJobs(),
                getSchemas(),
                getNetworks(),
            ]);
            setJobs(jobsRes.data);
            setSchemas(schemasRes.data);
            setNetworks(networksRes.data);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createJob(formData);
            loadData();
            resetForm();
        } catch (error) {
            console.error('Failed to create job:', error);
        }
    };

    const handleRunJob = async (jobId) => {
        try {
            await runJob(jobId);
            setTimeout(loadData, 1000);
        } catch (error) {
            console.error('Failed to run job:', error);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', schema_id: '', network_id: '', schedule: '' });
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Jobs Management</h1>
                    <p className="text-slate-400">Execute and manage sync jobs</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
                    <Plus className="w-5 h-5" />
                    New Job
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
                            placeholder="Job Name"
                            required
                        />
                        <select
                            value={formData.schema_id}
                            onChange={(e) => setFormData({ ...formData, schema_id: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            required
                        >
                            <option value="">Select Schema</option>
                            {schemas.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <select
                            value={formData.network_id}
                            onChange={(e) => setFormData({ ...formData, network_id: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            required
                        >
                            <option value="">Select Network</option>
                            {networks.map((n) => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                        </select>
                        <div className="flex gap-3">
                            <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg">Create</button>
                            <button type="button" onClick={resetForm} className="px-6 py-2 bg-slate-700 text-white rounded-lg">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {jobs.map((job) => (
                    <div key={job.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-semibold text-white">{job.name}</h3>
                                <p className="text-slate-400 mt-2">Schema: {job.schema?.name}</p>
                                <p className="text-slate-400">Network: {job.network?.name}</p>
                            </div>
                            <div className="flex gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm ${job.status === 'completed' ? 'bg-green-600/20 text-green-400' :
                                        job.status === 'running' ? 'bg-blue-600/20 text-blue-400' :
                                            'bg-slate-600/20 text-slate-400'
                                    }`}>
                                    {job.status}
                                </span>
                                <button
                                    onClick={() => handleRunJob(job.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                >
                                    <Play className="w-4 h-4" />
                                    Run
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Jobs;
