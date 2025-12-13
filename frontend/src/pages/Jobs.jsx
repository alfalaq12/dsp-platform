import { useEffect, useState, useCallback } from 'react';
import { Plus, Play, RefreshCw, X, Clock, Database, CheckCircle, XCircle, Loader2, Trash2, Eye, Pause, Network as NetworkIcon } from 'lucide-react';
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
    const [totalItems, setTotalItems] = useState(0);

    const loadData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [jobsRes, schemasRes, networksRes] = await Promise.all([
                getJobs({ page: currentPage, page_size: itemsPerPage }),
                getSchemas(),
                getNetworks(),
            ]);
            setJobs(jobsRes.data.data || []);
            setTotalItems(jobsRes.data.meta?.total || 0);
            setSchemas(schemasRes.data);
            setNetworks(networksRes.data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, [currentPage, itemsPerPage]);

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

    // Get human readable label from cron expression
    const getScheduleLabel = (schedule) => {
        if (!schedule || schedule === '' || schedule === 'manual') return 'Manual';

        // Common patterns to human readable
        const patterns = {
            '*/1 * * * *': 'Every 1 min',
            '*/5 * * * *': 'Every 5 min',
            '*/10 * * * *': 'Every 10 min',
            '*/15 * * * *': 'Every 15 min',
            '*/30 * * * *': 'Every 30 min',
            '0 * * * *': 'Every hour',
            '0 */3 * * *': 'Every 3 hours',
            '0 */6 * * *': 'Every 6 hours',
            '0 */12 * * *': 'Every 12 hours',
            '0 0 * * *': 'Daily midnight',
            '0 0 * * 0': 'Weekly (Sunday)',
        };

        return patterns[schedule] || schedule; // Show cron expression if not matched
    };

    // Parse cron expression to get interval in minutes (for simple patterns)
    const getScheduleIntervalMinutes = (schedule) => {
        if (!schedule || schedule === '' || schedule === 'manual') return 0;

        // Parse simple interval patterns: */n * * * * (every n minutes)
        const everyNMinMatch = schedule.match(/^\*\/(\d+) \* \* \* \*$/);
        if (everyNMinMatch) return parseInt(everyNMinMatch[1]);

        // Hourly: 0 * * * *
        if (schedule === '0 * * * *') return 60;

        // Every N hours: 0 */n * * *
        const everyNHourMatch = schedule.match(/^0 \*\/(\d+) \* \* \*$/);
        if (everyNHourMatch) return parseInt(everyNHourMatch[1]) * 60;

        // Daily: 0 0 * * *
        if (schedule === '0 0 * * *') return 1440;

        // Weekly: 0 0 * * 0
        if (schedule === '0 0 * * 0') return 10080;

        // For complex patterns, try to estimate from the first field
        return 0; // Can't determine interval
    };

    // Calculate next scheduled runs based on cron expression
    const getNextScheduledRuns = (schedule, lastRun, count = 5) => {
        const intervalMinutes = getScheduleIntervalMinutes(schedule);
        if (!intervalMinutes) {
            // For complex cron that we can't parse, just show the expression
            return null;
        }

        const now = new Date();
        let nextRun;

        if (lastRun && new Date(lastRun).getFullYear() > 2000) {
            // Calculate next run based on last_run + interval
            const lastRunDate = new Date(lastRun);
            const intervalMs = intervalMinutes * 60 * 1000;

            // Find the next run time after now
            nextRun = new Date(lastRunDate.getTime() + intervalMs);
            while (nextRun <= now) {
                nextRun = new Date(nextRun.getTime() + intervalMs);
            }
        } else {
            // If never run, next run is approximately now (scheduler checks every minute)
            nextRun = new Date(now.getTime() + 60 * 1000);
        }

        // Generate upcoming run times
        const runs = [];
        const intervalMs = intervalMinutes * 60 * 1000;
        for (let i = 0; i < count; i++) {
            runs.push(new Date(nextRun.getTime() + (i * intervalMs)));
        }

        return runs;
    };

    // Format schedule runs for display
    const formatScheduleRuns = (runs) => {
        if (!runs || runs.length === 0) return null;
        return runs.map(run =>
            run.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        ).join(', ');
    };

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Premium Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-sky-50/30 to-blue-50/20 border-slate-200/60 shadow-lg'}`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-sky-500/10 rounded-full blur-3xl"></div>

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                            <Play className="w-3 h-3" />
                            Job Scheduler
                        </div>
                        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Jobs Management</h1>
                        <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            <span>Execute and manage sync jobs</span>
                            <span className="text-slate-400">•</span>
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
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-medium">New Job</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className={`backdrop-blur-sm border rounded-2xl p-8 modal-scale-in mb-8 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
                    <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        <Plus className="w-5 h-5 text-blue-500" />
                        Create New Job
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Job Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                placeholder="e.g., Daily Sales Sync"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Schema</label>
                                <select
                                    value={formData.schema_id}
                                    onChange={(e) => setFormData({ ...formData, schema_id: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                    required
                                >
                                    <option value="">Select Schema</option>
                                    {schemas.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Network</label>
                                <select
                                    value={formData.network_id}
                                    onChange={(e) => setFormData({ ...formData, network_id: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                    required
                                >
                                    <option value="">Select Network</option>
                                    {networks.map((n) => (
                                        <option key={n.id} value={n.id}>{n.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Schedule (Cron Expression)
                            </label>
                            <div className="relative">
                                <Clock className={`absolute left-4 top-3.5 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    value={formData.schedule}
                                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                                    className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="*/5 * * * * (every 5 min) or leave empty for manual"
                                />
                            </div>
                            <div className={`mt-2 text-xs space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <p className="font-medium">Format: <span className="font-mono">minute hour day month weekday</span></p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <button type="button" onClick={() => setFormData({ ...formData, schedule: '*/5 * * * *' })}
                                        className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                        */5 * * * * <span className="opacity-60">(5 min)</span>
                                    </button>
                                    <button type="button" onClick={() => setFormData({ ...formData, schedule: '0 * * * *' })}
                                        className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                        0 * * * * <span className="opacity-60">(hourly)</span>
                                    </button>
                                    <button type="button" onClick={() => setFormData({ ...formData, schedule: '0 8,13,17 * * *' })}
                                        className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                        0 8,13,17 * * * <span className="opacity-60">(8am,1pm,5pm)</span>
                                    </button>
                                    <button type="button" onClick={() => setFormData({ ...formData, schedule: '0 0 * * *' })}
                                        className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                        0 0 * * * <span className="opacity-60">(daily midnight)</span>
                                    </button>
                                    <button type="button" onClick={() => setFormData({ ...formData, schedule: '' })}
                                        className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>
                                        Manual Only
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 shadow-lg shadow-blue-500/20 min-w-[120px]"
                            >
                                {isSubmitting ? 'Creating...' : 'Create Job'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className={`px-6 py-2.5 rounded-xl transition ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Jobs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-stagger">
                {jobs.map((job) => (
                    <div
                        key={job.id}
                        onClick={() => handleJobClick(job)}
                        className={`group border rounded-2xl p-6 cursor-pointer transition-all duration-300 ${isDark
                            ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-blue-500/50'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xl shadow-sm'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                    <Database className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className={`text-lg font-bold mb-1 transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                                        {job.name}
                                    </h3>
                                    <div className="flex flex-col gap-1">
                                        <p className={`text-sm flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            <span className="opacity-70">Schema:</span> {job.schema?.name}
                                        </p>
                                        <p className={`text-sm flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            <span className="opacity-70">Network:</span> {job.network?.name}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${isDark
                                    ? 'bg-slate-700 border-slate-600 text-slate-300'
                                    : 'bg-slate-100 border-slate-200 text-slate-600'
                                    }`}>
                                    {getScheduleLabel(job.schedule)}
                                </span>
                                {job.enabled === false && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                                        Paused
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Schedule Details - Show next runs for scheduled jobs */}
                        {job.schedule && job.schedule !== '' && job.enabled !== false && getNextScheduledRuns(job.schedule, job.last_run) && (
                            <div className={`mt-3 p-3 rounded-xl ${isDark ? 'bg-slate-900/50 border border-slate-700/50' : 'bg-slate-50 border border-slate-100'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                        Jadwal Berikutnya
                                    </span>
                                </div>
                                <div className={`text-xs font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        Next: {getNextScheduledRuns(job.schedule, job.last_run)?.[0]?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                    <span className="mx-2">→</span>
                                    <span className="opacity-80">
                                        {formatScheduleRuns(getNextScheduledRuns(job.schedule, job.last_run)?.slice(1, 4))}...
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className={`mt-4 pt-4 border-t flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                                <span className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${job.status === 'running'
                                    ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                                    : job.status === 'completed'
                                        ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                                        : job.status === 'failed'
                                            ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600')
                                            : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600')
                                    }`}>
                                    {getStatusIcon(job.status)}
                                    {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : 'Idle'}
                                </span>
                                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Last run: {job.last_run ? new Date(job.last_run).toLocaleString('id-ID') : 'Never'}
                                </span>
                            </div>

                            <div className="flex items-center gap-1 opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={(e) => handleJobClick(job)}
                                    className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-slate-400 hover:text-blue-600'}`}
                                    title="View Details"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                                {userRole === 'admin' && (
                                    <>
                                        <button
                                            onClick={(e) => handleRunJob(job.id, e)}
                                            disabled={job.status === 'running' || runningJobs.has(job.id)}
                                            className={`p-2 rounded-lg transition ${isDark
                                                ? 'hover:bg-blue-500/20 text-blue-400'
                                                : 'hover:bg-blue-50 text-blue-600'
                                                }`}
                                            title="Run Now"
                                        >
                                            {(job.status === 'running' || runningJobs.has(job.id)) ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => handleToggle(job, e)}
                                            className={`p-2 rounded-lg transition ${job.enabled !== false
                                                ? (isDark ? 'hover:bg-amber-500/20 text-slate-400 hover:text-amber-400' : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600')
                                                : (isDark ? 'hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400' : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600')
                                                }`}
                                            title={job.enabled !== false ? 'Pause Schedule' : 'Resume Schedule'}
                                        >
                                            {job.enabled !== false ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClick(job, e)}
                                            className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'
                                                }`}
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
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
                    totalItems={totalItems}
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
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all" onClick={() => setSelectedJob(null)}>
                        <div className={`rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden modal-scale-in shadow-2xl ${isDark ? 'bg-slate-900' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
                            <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedJob.name}</h2>
                                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Job Details & Execution History</p>
                                </div>
                                <button onClick={() => setSelectedJob(null)} className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)] custom-scrollbar">
                                {/* Job Info */}
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Database className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Schema</p>
                                        </div>
                                        <p className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedJob.schema?.name}</p>
                                    </div>
                                    <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <NetworkIcon className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Network</p>
                                        </div>
                                        <p className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedJob.network?.name}</p>
                                    </div>
                                </div>

                                {/* Execution Logs */}
                                <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    <Clock className="w-5 h-5 text-slate-400" />
                                    Execution History
                                </h3>

                                {jobDetails?.logs?.length > 0 ? (
                                    <div className="space-y-4">
                                        {jobDetails.logs.map((log, idx) => (
                                            <div key={log.id || idx} className={`rounded-xl p-5 border transition-all ${isDark ? 'bg-slate-800/30 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-full ${log.status === 'completed' ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') :
                                                            log.status === 'running' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600') :
                                                                log.status === 'failed' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600') :
                                                                    (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')
                                                            }`}>
                                                            {getStatusIcon(log.status)}
                                                        </div>
                                                        <div>
                                                            <span className={`block text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                {log.status?.charAt(0).toUpperCase() + log.status?.slice(1)}
                                                            </span>
                                                            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                {new Date(log.started_at).toLocaleString('id-ID')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                                        ID: {log.id || '-'}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                    <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                                                        <p className={`text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Duration</p>
                                                        <p className={`font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formatDuration(log.duration)}</p>
                                                    </div>
                                                    <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                                                        <p className={`text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Records</p>
                                                        <p className={`font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{log.record_count || '0'}</p>
                                                    </div>
                                                </div>

                                                {/* Error Message Display */}
                                                {log.status === 'failed' && log.error_message && (
                                                    <div className={`mt-4 p-4 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
                                                        <p className={`text-xs font-bold mb-1 uppercase tracking-wider ${isDark ? 'text-red-400' : 'text-red-700'}`}>Error Details</p>
                                                        <p className={`text-sm font-mono break-all ${isDark ? 'text-red-300' : 'text-red-600'}`}>{log.error_message}</p>
                                                    </div>
                                                )}

                                                {/* Sample Data Preview */}
                                                {log.sample_data && (
                                                    <div className="mt-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Sample Data</p>
                                                        </div>
                                                        <pre className={`rounded-xl p-4 text-xs overflow-x-auto font-mono custom-scrollbar ${isDark ? 'bg-slate-950 text-slate-300 border border-slate-800' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                                                            {JSON.stringify(JSON.parse(log.sample_data), null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={`text-center py-12 border-2 border-dashed rounded-2xl ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No execution history available.</p>
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