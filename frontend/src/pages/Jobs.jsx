import { useEffect, useState, useCallback } from 'react';
import { Plus, Play, RefreshCw, X, Clock, Database, CheckCircle, XCircle, Loader2, Trash2, Eye, Pause } from 'lucide-react';
import { getJobs, getSchemas, getNetworks, createJob, runJob, getJob, deleteJob, toggleJob } from '../services/api';
import { useToast, ToastContainer, ConfirmModal } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';

function Jobs() {
    const { isDark } = useTheme();
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
    const userRole = localStorage.getItem('role') || 'viewer';

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

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
            const response = await runJob(jobId);
            // Check if response indicates success or has error
            if (response.data?.job?.status === 'failed') {
                addToast(`Job failed: ${response.data?.error || 'Unknown error'}`, 'error');
            } else {
                addToast('Job started successfully!', 'success');
            }
            setTimeout(loadData, 1000);
            if (selectedJob?.id === jobId) {
                setTimeout(() => loadJobDetails(jobId), 2000);
            }
        } catch (error) {
            console.error('Failed to run job:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
            addToast(`Job failed: ${errorMsg}`, 'error');
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

    const handleToggle = async (job, e) => {
        e?.stopPropagation();
        try {
            await toggleJob(job.id);
            const action = job.enabled ? 'paused' : 'resumed';
            addToast(`Job "${job.name}" ${action}!`, 'success');
            loadData();
        } catch (error) {
            console.error('Failed to toggle job:', error);
            addToast('Failed to toggle job. Please try again.', 'error');
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
                    <h1 className={`text-2xl sm:text-3xl font-bold mb-2 ${isDark ? 'text-panda-text' : 'text-slate-800'}`}>Jobs Management</h1>
                    <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>
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
                {userRole === 'admin' && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-500 text-panda-dark font-semibold rounded-xl transition shadow-lg shadow-blue-500/20 btn-pulse-glow"
                    >
                        <Plus className="w-5 h-5" />
                        New Job
                    </button>
                )}
            </div>

            {/* Create Form */}
            {
                showForm && (
                    <div className={`border rounded-2xl p-6 modal-scale-in ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-lg'}`}>
                        <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>Create New Job</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:border-blue-500 focus:outline-none transition ${isDark ? 'bg-panda-dark border-panda-dark-300 text-panda-text' : 'bg-white border-slate-300 text-slate-900'}`}
                                placeholder="Job Name"
                                required
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select
                                    value={formData.schema_id}
                                    onChange={(e) => setFormData({ ...formData, schema_id: e.target.value })}
                                    className={`px-4 py-3 border rounded-xl focus:border-blue-500 focus:outline-none transition ${isDark ? 'bg-panda-dark border-panda-dark-300 text-panda-text' : 'bg-white border-slate-300 text-slate-900'}`}
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
                                    className={`px-4 py-3 border rounded-xl focus:border-blue-500 focus:outline-none transition ${isDark ? 'bg-panda-dark border-panda-dark-300 text-panda-text' : 'bg-white border-slate-300 text-slate-900'}`}
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
                                className={`w-full px-4 py-3 border rounded-xl focus:border-blue-500 focus:outline-none transition ${isDark ? 'bg-panda-dark border-panda-dark-300 text-panda-text' : 'bg-white border-slate-300 text-slate-900'}`}
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
                                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                                >
                                    {isSubmitting && <span className="spinner-border"></span>}
                                    Create
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className={`px-6 py-2.5 rounded-xl transition ${isDark ? 'bg-panda-dark-300 text-panda-text hover:bg-panda-dark-400' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* Jobs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-stagger">
                {jobs
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((job) => (
                        <div
                            key={job.id}
                            className={`rounded-2xl p-6 cursor-pointer transition-all duration-300 group ${isDark
                                ? 'bg-panda-dark-100 border border-panda-dark-300 border-l-4 border-l-blue-500'
                                : 'bg-gradient-to-br from-white to-slate-50 border border-slate-200 border-l-4 border-l-slate-500 shadow-sm hover:shadow-md hover:-translate-y-1'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div onClick={() => handleJobClick(job)} className="flex-1">
                                    <h3 className={`text-lg font-semibold transition ${isDark ? 'text-panda-text group-hover:text-blue-500' : 'text-slate-900 group-hover:text-blue-600'}`}>{job.name}</h3>
                                    <p className={`text-sm mt-1 ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Schema: {job.schema?.name}</p>
                                    <p className={`text-sm ${isDark ? 'text-panda-text-muted' : 'text-slate-600'}`}>Network: {job.network?.name}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(job.status)}`}>
                                        {job.status}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs border ${isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                        {getScheduleLabel(job.schedule)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={`text-xs ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                    Last run: {job.last_run ? new Date(job.last_run).toLocaleString('id-ID') : 'Never'}
                                </span>
                                <div className="flex items-center gap-2">
                                    {userRole === 'admin' && (
                                        <button
                                            onClick={(e) => handleToggle(job, e)}
                                            className={`action-btn ${job.enabled !== false ? 'bg-orange-600/20 hover:bg-orange-600/40 text-orange-400' : 'bg-green-600/20 hover:bg-green-600/40 text-green-400'}`}
                                            title={job.enabled !== false ? 'Pause Schedule' : 'Resume Schedule'}
                                        >
                                            {job.enabled !== false ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleJobClick(job)}
                                        className="action-btn action-btn-view"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {userRole === 'admin' && (
                                        <>
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
                                                className="flex items-center gap-2 px-4 py-2 bg-panda-dark-300 hover:bg-blue-500 hover:text-panda-dark text-panda-text rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {(job.status === 'running' || runningJobs.has(job.id)) ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                                {(job.status === 'running' || runningJobs.has(job.id)) ? 'Running...' : 'Run'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
            </div>

            {/* Pagination */}
            {jobs.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={jobs.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                />
            )}

            {
                jobs.length === 0 && (
                    <div className="text-center py-12 text-panda-text-muted">
                        <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No jobs yet. Create one to get started.</p>
                    </div>
                )
            }

            {
                selectedJob && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
                        <div className={`border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden modal-scale-in ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-2xl'}`} onClick={(e) => e.stopPropagation()}>
                            <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-panda-dark-300' : 'border-slate-100'}`}>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{selectedJob.name}</h2>
                                    <p className={`text-sm ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Job Details & Execution History</p>
                                </div>
                                <button onClick={() => setSelectedJob(null)} className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-panda-dark-300 text-panda-text-muted' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                                {/* Job Info */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className={`rounded-xl p-4 ${isDark ? 'bg-panda-dark/50' : 'bg-slate-50 border border-slate-100'}`}>
                                        <p className={`text-xs mb-1 ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Schema</p>
                                        <p className={`font-medium ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{selectedJob.schema?.name}</p>
                                    </div>
                                    <div className={`rounded-xl p-4 ${isDark ? 'bg-panda-dark/50' : 'bg-slate-50 border border-slate-100'}`}>
                                        <p className={`text-xs mb-1 ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Network</p>
                                        <p className={`font-medium ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{selectedJob.network?.name}</p>
                                    </div>
                                </div>

                                {/* Execution Logs */}
                                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>Execution History</h3>
                                {jobDetails?.logs?.length > 0 ? (
                                    <div className="space-y-3">
                                        {jobDetails.logs.map((log, idx) => (
                                            <div key={log.id || idx} className={`rounded-xl p-4 ${isDark ? 'bg-panda-dark/50' : 'bg-slate-50 border border-slate-100'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(log.status)}
                                                        <span className={`text-sm font-medium ${log.status === 'completed' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : log.status === 'running' ? 'text-blue-400' : log.status === 'failed' ? 'text-red-400' : (isDark ? 'text-panda-text-muted' : 'text-slate-500')}`}>
                                                            {log.status?.charAt(0).toUpperCase() + log.status?.slice(1)}
                                                        </span>
                                                    </div>
                                                    <span className={`text-xs ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                                        {new Date(log.started_at).toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className={`${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Duration</p>
                                                        <p className={`font-medium ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{formatDuration(log.duration)}</p>
                                                    </div>
                                                    <div>
                                                        <p className={`${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Records Synced</p>
                                                        <p className={`font-medium ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{log.record_count || '-'}</p>
                                                    </div>
                                                </div>

                                                {/* Error Message Display */}
                                                {log.status === 'failed' && log.error_message && (
                                                    <div className={`mt-4 p-3 rounded-lg border ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-100'}`}>
                                                        <p className={`text-xs font-medium mb-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Error Details:</p>
                                                        <p className={`text-sm font-mono break-all ${isDark ? 'text-red-300' : 'text-red-600'}`}>{log.error_message}</p>
                                                    </div>
                                                )}

                                                {/* Sample Data Preview */}
                                                {log.sample_data && (
                                                    <div className="mt-4">
                                                        <p className={`text-xs mb-2 ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>Sample Data Preview</p>
                                                        <pre className={`rounded-lg p-3 text-xs overflow-x-auto ${isDark ? 'bg-panda-dark text-panda-text' : 'bg-white border border-slate-200 text-slate-800'}`}>
                                                            {JSON.stringify(JSON.parse(log.sample_data), null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={`text-center py-8 ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>
                                        <p>No execution history yet. Run the job to see logs.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

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
        </div >
    );
}

export default Jobs;
