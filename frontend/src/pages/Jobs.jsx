import { useEffect, useState, useCallback } from 'react';
import { Plus, Play, RefreshCw, X, Clock, Database, CheckCircle, XCircle, Loader2, Trash2, Eye } from 'lucide-react';
import { getJobs, getSchemas, getNetworks, createJob, runJob, getJob, deleteJob } from '../services/api';
import { useToast, ToastContainer, ConfirmModal } from '../components/Toast';

function Jobs() {
    const [jobs, setJobs] = useState([]);
    const [schemas, setSchemas] = useState([]);
    const [networks, setNetworks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', schema_id: '', network_id: '', schedule: '' });
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobDetails, setJobDetails] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // New states for enhanced UX
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [runningJobs, setRunningJobs] = useState(new Set());
    const { toasts, addToast, removeToast } = useToast();

    const loadData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [jobsRes, schemasRes, networksRes] = await Promise.all([
                getJobs(),
                getSchemas(),
                getNetworks(),
            ]);
            setJobs(jobsRes.data);
            setSchemas(schemasRes.data);
            setNetworks(networksRes.data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    // Initial load and auto-refresh every 5 seconds
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, [loadData]);

    const loadJobDetails = async (jobId) => {
        try {
            const response = await getJob(jobId);
            setJobDetails(response.data);
        } catch (error) {
            console.error('Failed to load job details:', error);
        }
    };

    const handleJobClick = (job) => {
        setSelectedJob(job);
        loadJobDetails(job.id);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const jobData = {
                name: formData.name,
                schema_id: parseInt(formData.schema_id, 10),
                network_id: parseInt(formData.network_id, 10),
                schedule: formData.schedule || '',
            };
            await createJob(jobData);
            addToast('Job created successfully!', 'success');
            loadData();
            resetForm();
        } catch (error) {
            console.error('Failed to create job:', error);
            addToast('Failed to create job. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRunJob = async (jobId, e) => {
        e?.stopPropagation();
        setRunningJobs(prev => new Set([...prev, jobId]));
        try {
            await runJob(jobId);
            addToast('Job started successfully!', 'success');
            setTimeout(loadData, 1000);
            if (selectedJob?.id === jobId) {
                setTimeout(() => loadJobDetails(jobId), 2000);
            }
        } catch (error) {
            console.error('Failed to run job:', error);
            addToast('Failed to run job. Please try again.', 'error');
        } finally {
            setRunningJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(jobId);
                return newSet;
            });
        }
    };

    const handleDeleteClick = (job, e) => {
        e?.stopPropagation();
        setDeleteTarget(job);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteJob(deleteTarget.id);
            addToast(`Job "${deleteTarget.name}" deleted successfully!`, 'success');
            loadData();
            if (selectedJob?.id === deleteTarget.id) {
                setSelectedJob(null);
            }
        } catch (error) {
            console.error('Failed to delete job:', error);
            addToast('Failed to delete job. Please try again.', 'error');
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', schema_id: '', network_id: '', schedule: '' });
        setShowForm(false);
    };

    const formatDuration = (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatTime = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case 'running': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
            default: return <Clock className="w-4 h-4 text-panda-text-muted" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
            case 'running': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
            case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/50';
            default: return 'bg-panda-dark-300 text-panda-text-muted border-panda-dark-400';
        }
    };

    const getScheduleLabel = (schedule) => {
        const labels = {
            '1min': 'Every 1 min',
            '5min': 'Every 5 min',
            '10min': 'Every 10 min',
            '15min': 'Every 15 min',
            '30min': 'Every 30 min',
            '1hour': 'Every 1 hour',
            '3hour': 'Every 3 hours',
            '6hour': 'Every 6 hours',
            '12hour': 'Every 12 hours',
            'daily': 'Daily',
            'weekly': 'Weekly',
        };
        return labels[schedule] || 'Manual';
    };

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-panda-text mb-2">Jobs Management</h1>
                    <div className="flex items-center gap-3 text-sm text-panda-text-muted">
                        <span>Execute and manage sync jobs</span>
                        <span className="text-panda-dark-400">•</span>
                        <span className="flex items-center gap-1">
                            {isRefreshing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <RefreshCw className="w-3 h-3" />
                            )}
                            Updated {formatTime(lastUpdated)}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-panda-gold to-panda-gold-light hover:from-panda-gold-light hover:to-panda-gold text-panda-dark font-semibold rounded-xl transition shadow-lg shadow-panda-gold/20 btn-pulse-glow"
                >
                    <Plus className="w-5 h-5" />
                    New Job
                </button>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl p-6 modal-scale-in">
                    <h2 className="text-lg font-semibold text-panda-text mb-4">Create New Job</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-panda-dark border border-panda-dark-300 rounded-xl text-panda-text focus:border-panda-gold focus:outline-none transition"
                            placeholder="Job Name"
                            required
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                                value={formData.schema_id}
                                onChange={(e) => setFormData({ ...formData, schema_id: e.target.value })}
                                className="px-4 py-3 bg-panda-dark border border-panda-dark-300 rounded-xl text-panda-text focus:border-panda-gold focus:outline-none transition"
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
                                className="px-4 py-3 bg-panda-dark border border-panda-dark-300 rounded-xl text-panda-text focus:border-panda-gold focus:outline-none transition"
                                required
                            >
                                <option value="">Select Network</option>
                                {networks.map((n) => (
                                    <option key={n.id} value={n.id}>{n.name}</option>
                                ))}
                            </select>
                        </div>
                        <select
                            value={formData.schedule}
                            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                            className="w-full px-4 py-3 bg-panda-dark border border-panda-dark-300 rounded-xl text-panda-text focus:border-panda-gold focus:outline-none transition"
                        >
                            <option value="">Manual Only</option>
                            <option value="1min">Every 1 minute</option>
                            <option value="5min">Every 5 minutes</option>
                            <option value="10min">Every 10 minutes</option>
                            <option value="15min">Every 15 minutes</option>
                            <option value="30min">Every 30 minutes</option>
                            <option value="1hour">Every 1 hour</option>
                            <option value="3hour">Every 3 hours</option>
                            <option value="6hour">Every 6 hours</option>
                            <option value="12hour">Every 12 hours</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-panda-gold text-panda-dark font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                            >
                                {isSubmitting && <span className="spinner-border"></span>}
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-6 py-2.5 bg-panda-dark-300 text-panda-text rounded-xl hover:bg-panda-dark-400 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Jobs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {jobs.map((job) => (
                    <div
                        key={job.id}
                        className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl p-6 cursor-pointer hover:border-panda-gold/50 transition-all group card-hover"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div onClick={() => handleJobClick(job)} className="flex-1">
                                <h3 className="text-lg font-semibold text-panda-text group-hover:text-panda-gold transition">{job.name}</h3>
                                <p className="text-sm text-panda-text-muted mt-1">Schema: {job.schema?.name}</p>
                                <p className="text-sm text-panda-text-muted">Network: {job.network?.name}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
                                    {job.status}
                                </span>
                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs">
                                    {getScheduleLabel(job.schedule)}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-panda-text-muted">
                                Last run: {job.last_run ? new Date(job.last_run).toLocaleString('id-ID') : 'Never'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleJobClick(job)}
                                    className="action-btn action-btn-view"
                                    title="View Details"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => handleDeleteClick(job, e)}
                                    className="action-btn action-btn-delete"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => handleRunJob(job.id, e)}
                                    disabled={job.status === 'running' || runningJobs.has(job.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-panda-dark-300 hover:bg-panda-gold hover:text-panda-dark text-panda-text rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {(job.status === 'running' || runningJobs.has(job.id)) ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4" />
                                    )}
                                    {(job.status === 'running' || runningJobs.has(job.id)) ? 'Running...' : 'Run'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {jobs.length === 0 && (
                <div className="text-center py-12 text-panda-text-muted">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No jobs yet. Create one to get started.</p>
                </div>
            )}

            {/* Job Details Modal */}
            {selectedJob && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
                    <div className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden modal-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-panda-dark-300">
                            <div>
                                <h2 className="text-xl font-bold text-panda-text">{selectedJob.name}</h2>
                                <p className="text-sm text-panda-text-muted">Job Details & Execution History</p>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-panda-dark-300 rounded-lg transition">
                                <X className="w-5 h-5 text-panda-text-muted" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                            {/* Job Info */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-panda-dark/50 rounded-xl p-4">
                                    <p className="text-xs text-panda-text-muted mb-1">Schema</p>
                                    <p className="text-panda-text font-medium">{selectedJob.schema?.name}</p>
                                </div>
                                <div className="bg-panda-dark/50 rounded-xl p-4">
                                    <p className="text-xs text-panda-text-muted mb-1">Network</p>
                                    <p className="text-panda-text font-medium">{selectedJob.network?.name}</p>
                                </div>
                            </div>

                            {/* Execution Logs */}
                            <h3 className="text-lg font-semibold text-panda-text mb-4">Execution History</h3>
                            {jobDetails?.logs?.length > 0 ? (
                                <div className="space-y-3">
                                    {jobDetails.logs.map((log, idx) => (
                                        <div key={log.id || idx} className="bg-panda-dark/50 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(log.status)}
                                                    <span className={`text-sm font-medium ${log.status === 'completed' ? 'text-emerald-400' : log.status === 'running' ? 'text-blue-400' : 'text-panda-text-muted'}`}>
                                                        {log.status?.charAt(0).toUpperCase() + log.status?.slice(1)}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-panda-text-muted">
                                                    {new Date(log.started_at).toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-panda-text-muted">Duration</p>
                                                    <p className="text-panda-text font-medium">{formatDuration(log.duration)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-panda-text-muted">Records Synced</p>
                                                    <p className="text-panda-text font-medium">{log.record_count || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Sample Data Preview */}
                                            {log.sample_data && (
                                                <div className="mt-4">
                                                    <p className="text-xs text-panda-text-muted mb-2">Sample Data Preview</p>
                                                    <pre className="bg-panda-dark rounded-lg p-3 text-xs text-panda-text overflow-x-auto">
                                                        {JSON.stringify(JSON.parse(log.sample_data), null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-panda-text-muted">
                                    <p>No execution history yet. Run the job to see logs.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Job"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                isLoading={isDeleting}
            />
        </div>
    );
}

export default Jobs;
