import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Database, Eye, Code, FileSpreadsheet, Download, Search, CheckSquare, Square, Loader2 } from 'lucide-react';
import { useSchemas, useNetworks, useCreateSchema, useUpdateSchema, useDeleteSchema, useDiscoverTables, useBulkCreateSchemas, useNetworkSchemas } from '../hooks/useQueries';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';
import Pagination from '../components/Pagination';
import { useTheme } from '../contexts/ThemeContext';
import { getErrorMessage } from '../utils/errorHelper';

function Schema() {
    const { isDark } = useTheme();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        sql_command: '',
        target_table: '',
        description: '',
        // File sync fields
        source_type: 'query', // query, file
        file_format: 'csv',   // csv, xlsx, json
        file_pattern: '',
        unique_key_column: '',
        has_header: true,
        delimiter: ',',
    });

    // New states for enhanced UX
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSchema, setSelectedSchema] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const { toasts, addToast, removeToast } = useToast();
    const userRole = localStorage.getItem('role') || 'viewer';

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    // Import Tables Modal states
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState(null);
    const [discoveredTables, setDiscoveredTables] = useState([]);
    const [selectedTables, setSelectedTables] = useState([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importPrefix, setImportPrefix] = useState('');
    const [tableSearchQuery, setTableSearchQuery] = useState('');
    const [selectedDbSchema, setSelectedDbSchema] = useState(''); // Database schema filter (e.g., 'public', 'mrz')

    // React Query hooks
    const { data: schemas = [] } = useSchemas();
    const { data: allNetworks = [] } = useNetworks();
    const createSchemaMutation = useCreateSchema();
    const updateSchemaMutation = useUpdateSchema();
    const deleteSchemaMutation = useDeleteSchema();
    const discoverTablesMutation = useDiscoverTables();
    const bulkCreateSchemasMutation = useBulkCreateSchemas();

    // Filter only database type networks
    const networks = allNetworks.filter(n => n.source_type === 'database' || n.db_host);

    // Fetch available schemas when network is selected
    const { data: schemasData, isFetching: isFetchingSchemas } = useNetworkSchemas(selectedNetwork);
    const availableDbSchemas = schemasData?.schemas || [];

    const handleDiscoverTables = async () => {
        if (!selectedNetwork) return;
        setIsDiscovering(true);
        setDiscoveredTables([]);
        setSelectedTables([]);
        try {
            const response = await discoverTablesMutation.mutateAsync({
                networkId: selectedNetwork,
                schema: selectedDbSchema || ''
            });
            setDiscoveredTables(response.data.tables || []);
            const schemaInfo = selectedDbSchema ? ` from schema '${selectedDbSchema}'` : '';
            addToast(`Found ${response.data.total} tables${schemaInfo}`, 'success');
        } catch (error) {
            addToast(getErrorMessage(error), 'error');
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleBulkImport = async () => {
        if (selectedTables.length === 0) {
            addToast('Please select at least one table', 'warning');
            return;
        }
        setIsImporting(true);
        try {
            const response = await bulkCreateSchemasMutation.mutateAsync({
                network_id: parseInt(selectedNetwork),
                tables: selectedTables,
                prefix: importPrefix || ''
            });
            addToast(response.data.message, 'success');
            setShowImportModal(false);
            setSelectedTables([]);
            setDiscoveredTables([]);
        } catch (error) {
            addToast(getErrorMessage(error), 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const toggleTableSelection = (tableName) => {
        setSelectedTables(prev =>
            prev.includes(tableName)
                ? prev.filter(t => t !== tableName)
                : [...prev, tableName]
        );
    };

    const toggleSelectAll = () => {
        const filteredTables = discoveredTables.filter(t =>
            t.table_name.toLowerCase().includes(tableSearchQuery.toLowerCase())
        );
        if (selectedTables.length === filteredTables.length) {
            setSelectedTables([]);
        } else {
            setSelectedTables(filteredTables.map(t => t.table_name));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingId) {
                await updateSchemaMutation.mutateAsync({ id: editingId, data: formData });
                addToast('Schema updated successfully!', 'success');
            } else {
                await createSchemaMutation.mutateAsync(formData);
                addToast('Schema created successfully!', 'success');
            }
            resetForm();
        } catch (error) {
            console.error('Failed to save schema:', error);
            addToast(getErrorMessage(error, 'Failed to save schema. Please try again.'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (schema) => {
        setFormData({
            name: schema.name,
            sql_command: schema.sql_command || '',
            target_table: schema.target_table,
            description: schema.description || '',
            source_type: schema.source_type || 'query',
            file_format: schema.file_format || 'csv',
            file_pattern: schema.file_pattern || '',
            unique_key_column: schema.unique_key_column || '',
            has_header: schema.has_header !== false,
            delimiter: schema.delimiter || ',',
        });
        setEditingId(schema.id);
        setShowForm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsLoading(true);
        try {
            await deleteSchemaMutation.mutateAsync(deleteTarget.id);
            addToast(`Schema "${deleteTarget.name}" deleted successfully!`, 'success');
        } catch (error) {
            console.error('Failed to delete schema:', error);
            addToast(getErrorMessage(error, 'Failed to delete schema. Please try again.'), 'error');
        } finally {
            setIsLoading(false);
            setDeleteTarget(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', sql_command: '', target_table: '', description: '',
            source_type: 'query', file_format: 'csv', file_pattern: '',
            unique_key_column: '', has_header: true, delimiter: ','
        });
        setEditingId(null);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Premium Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 border-slate-200/60 shadow-lg'}`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                            <Database className="w-3 h-3" />
                            Data Definitions
                        </div>
                        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Schema Management</h1>
                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Define and manage SQL queries for data synchronization</p>
                    </div>
                    {userRole === 'admin' && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowImportModal(true)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-200 hover:-translate-y-0.5 ${isDark
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                    }`}
                            >
                                <Download className="w-5 h-5" />
                                <span className="font-medium">Import Tables</span>
                            </button>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="font-medium">New Schema</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className={`backdrop-blur-sm border rounded-2xl p-6 modal-scale-in mb-8 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
                    <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {editingId ? <Edit className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                        {editingId ? 'Edit Schema' : 'Create New Schema'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="e.g., Master User Sync"
                                    required
                                />
                            </div>

                            {/* Source Type Selection */}
                            <div className="md:col-span-2">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Source Type</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'query', label: 'SQL Query', icon: Database },
                                        { id: 'file', label: 'File (CSV/Excel)', icon: FileSpreadsheet },
                                        { id: 'api', label: 'REST API', icon: Code }
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, source_type: type.id })}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${formData.source_type === type.id
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                                : isDark ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            <type.icon className="w-5 h-5" />
                                            <span className="text-sm font-medium">{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* SQL Query Fields - shown when source_type is 'query' */}
                            {formData.source_type === 'query' && (
                                <div className="md:col-span-2">
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>SQL Command</label>
                                    <textarea
                                        value={formData.sql_command}
                                        onChange={(e) => setFormData({ ...formData, sql_command: e.target.value })}
                                        rows="4"
                                        className={`w-full px-4 py-3 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                        placeholder="SELECT * FROM users WHERE..."
                                        required
                                    />
                                </div>
                            )}

                            {/* API Response Info - shown when source_type is 'api' */}
                            {formData.source_type === 'api' && (
                                <div className={`md:col-span-2 border-t pt-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <div className={`border rounded-xl p-4 ${isDark ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'}`}>
                                        <h3 className={`font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                                            <Code className="w-4 h-4" />
                                            API Response Configuration
                                        </h3>
                                        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                            API endpoint dan authentication dikonfigurasi di <span className={`font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Network</span> dengan Source Type "REST API".
                                            Response akan otomatis di-parse sebagai JSON.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* File Sync Fields - shown when source_type is 'file' */}
                            {formData.source_type === 'file' && (
                                <div className={`md:col-span-2 border-t pt-4 space-y-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <h3 className={`text-md font-semibold flex items-center gap-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                        <Database className="w-4 h-4" />
                                        File Configuration
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>File Format</label>
                                            <select
                                                value={formData.file_format}
                                                onChange={(e) => setFormData({ ...formData, file_format: e.target.value })}
                                                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            >
                                                <option value="csv">CSV</option>
                                                <option value="txt">TXT (Text File)</option>
                                                <option value="xlsx">Excel (.xlsx)</option>
                                                <option value="json">JSON</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>File Pattern</label>
                                            <input
                                                type="text"
                                                value={formData.file_pattern}
                                                onChange={(e) => setFormData({ ...formData, file_pattern: e.target.value })}
                                                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                                placeholder="data.csv or *.csv"
                                            />
                                        </div>
                                        {(formData.file_format === 'csv' || formData.file_format === 'txt') && (
                                            <>
                                                <div>
                                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Delimiter</label>
                                                    <select
                                                        value={formData.delimiter}
                                                        onChange={(e) => setFormData({ ...formData, delimiter: e.target.value })}
                                                        className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                    >
                                                        <option value=",">Comma (,)</option>
                                                        <option value=";">Semicolon (;)</option>
                                                        <option value="\t">Tab</option>
                                                        <option value="|">Pipe (|)</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center">
                                                    <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.has_header}
                                                            onChange={(e) => setFormData({ ...formData, has_header: e.target.checked })}
                                                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                                        />
                                                        File has header row
                                                    </label>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Target Table</label>
                                <input
                                    type="text"
                                    value={formData.target_table}
                                    onChange={(e) => setFormData({ ...formData, target_table: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="e.g., sync_users"
                                    required
                                />
                            </div>

                            {/* Unique Key Column */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Unique Key Column (Upsert)</label>
                                <input
                                    type="text"
                                    value={formData.unique_key_column}
                                    onChange={(e) => setFormData({ ...formData, unique_key_column: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="e.g., id or email"
                                />
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Leave empty for standard insert</p>
                            </div>

                            <div className="md:col-span-2">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                                    placeholder="Brief description..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 min-w-[120px] shadow-lg shadow-blue-500/20"
                            >
                                {isSubmitting ? 'Saving...' : (editingId ? 'Update Schema' : 'Create Schema')}
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

            {/* Schemas Table - Premium Container */}
            <div className={`rounded-2xl overflow-hidden border shadow-xl ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-700/50 bg-slate-800/80' : 'border-slate-200 bg-slate-50/50'}`}>
                    <h3 className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Schema List</h3>
                    <div className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        {schemas.length} Total
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className={isDark ? 'bg-slate-900/50 border-b border-slate-700' : 'bg-slate-50/80 border-b border-slate-200'}>
                            <tr>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Name
                                </th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Source
                                </th>
                                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Target Table
                                </th>
                                <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                            {schemas.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className={`px-6 py-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        <div className={`inline-flex p-4 rounded-full mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                            <Database className="w-8 h-8 opacity-50" />
                                        </div>
                                        <p className="font-medium">No schemas found</p>
                                        <p className="text-sm opacity-75 mt-1">Create a new schema to begin</p>
                                    </td>
                                </tr>
                            ) : (
                                schemas
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((schema) => (
                                        <tr key={schema.id} className={`group transition-all duration-200 ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{schema.name}</div>
                                                {schema.description && (
                                                    <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{schema.description}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {schema.source_type === 'api' ? (
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-700 border border-cyan-100'}`}>
                                                            <Code className="w-3 h-3" /> API
                                                        </span>
                                                    ) : schema.source_type === 'file' ? (
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                            <Database className="w-3 h-3" /> File
                                                        </span>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                                            <Database className="w-3 h-3" /> SQL
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-mono max-w-[150px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={schema.sql_command || schema.file_pattern}>
                                                        {schema.source_type === 'file' ? schema.file_pattern : (schema.sql_command || '-')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                                    {schema.target_table}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedSchema(schema)}
                                                        className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-slate-400 hover:text-blue-600'}`}
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {userRole === 'admin' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(schema)}
                                                                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-amber-400' : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'}`}
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(schema)}
                                                                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'}`}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
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
                {schemas.length > 0 && (
                    <div className={`px-6 py-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={schemas.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    </div>
                )}
            </div>

            {/* View Detail Modal */}
            <ViewModal
                isOpen={!!selectedSchema}
                onClose={() => setSelectedSchema(null)}
                title="Schema Details"
            >
                {selectedSchema && (
                    <div className="space-y-4">
                        <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-100'}`}>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ID</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>#{selectedSchema.id}</span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Name</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedSchema.name}</span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between items-center">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Target Table</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                    {selectedSchema.target_table}
                                </span>
                            </div>
                            <div className="detail-row mb-3 flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Description</span>
                                <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedSchema.description || '-'}</span>
                            </div>
                            <div className="detail-row flex justify-between">
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Created At</span>
                                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {selectedSchema.created_at ? new Date(selectedSchema.created_at).toLocaleString('id-ID') : '-'}
                                </span>
                            </div>
                        </div>

                        <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-100'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Code className="w-4 h-4 text-blue-400" />
                                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>SQL Command</span>
                            </div>
                            <pre className={`rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white border border-slate-200 text-slate-800'}`}>
                                {selectedSchema.sql_command}
                            </pre>
                        </div>
                    </div>
                )}
            </ViewModal>

            {/* Import Tables Modal */}
            {showImportModal && createPortal(
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className={`w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col ${isDark ? 'bg-panda-dark-100' : 'bg-white'}`}>
                        {/* Header */}
                        <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Import Tables from Database
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Select a network and discover tables to import as schemas
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex-1 overflow-y-auto">
                            {/* Network Selection */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Select Source Network
                                </label>
                                <select
                                    value={selectedNetwork || ''}
                                    onChange={(e) => {
                                        setSelectedNetwork(e.target.value);
                                        setSelectedDbSchema(''); // Reset schema when network changes
                                        setDiscoveredTables([]);
                                        setSelectedTables([]);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl border ${isDark
                                        ? 'bg-slate-800 border-slate-600 text-white'
                                        : 'bg-white border-slate-300 text-slate-900'
                                        }`}
                                >
                                    <option value="">Choose a database connection...</option>
                                    {networks.map((network) => (
                                        <option key={network.id} value={network.id}>
                                            {network.name} ({network.db_driver || 'database'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Database Schema Selection - Shows when network selected and schemas available */}
                            {selectedNetwork && (
                                <div className="mb-4">
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        Database Schema (optional)
                                    </label>
                                    <div className="flex gap-3">
                                        <select
                                            value={selectedDbSchema}
                                            onChange={(e) => setSelectedDbSchema(e.target.value)}
                                            disabled={isFetchingSchemas}
                                            className={`flex-1 px-4 py-2.5 rounded-xl border ${isDark
                                                ? 'bg-slate-800 border-slate-600 text-white'
                                                : 'bg-white border-slate-300 text-slate-900'
                                                } ${isFetchingSchemas ? 'opacity-50 cursor-wait' : ''}`}
                                        >
                                            <option value="">All schemas</option>
                                            {availableDbSchemas.map((schema) => (
                                                <option key={schema} value={schema}>
                                                    {schema}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleDiscoverTables}
                                            disabled={!selectedNetwork || isDiscovering}
                                            className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${!selectedNetwork || isDiscovering
                                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                                                }`}
                                        >
                                            {isDiscovering ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Scanning...
                                                </>
                                            ) : (
                                                <>
                                                    <Search className="w-4 h-4" />
                                                    Scan Tables
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {isFetchingSchemas && (
                                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Loading available schemas...
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Prefix Option */}
                            {discoveredTables.length > 0 && (
                                <div className="mb-4">
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        Schema Name Prefix (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={importPrefix}
                                        onChange={(e) => setImportPrefix(e.target.value)}
                                        placeholder="e.g., sync_"
                                        className={`w-full px-4 py-2.5 rounded-xl border ${isDark
                                            ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
                                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                                            }`}
                                    />
                                </div>
                            )}

                            {/* Tables List */}
                            {discoveredTables.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                Tables ({discoveredTables.length})
                                            </span>
                                            <button
                                                onClick={toggleSelectAll}
                                                className={`text-xs px-2 py-1 rounded ${isDark
                                                    ? 'bg-slate-700 text-blue-400 hover:bg-slate-600'
                                                    : 'bg-slate-100 text-blue-600 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {selectedTables.length === discoveredTables.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={tableSearchQuery}
                                            onChange={(e) => setTableSearchQuery(e.target.value)}
                                            placeholder="Search tables..."
                                            className={`px-3 py-1.5 text-sm rounded-lg border ${isDark
                                                ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
                                                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                                                }`}
                                        />
                                    </div>
                                    <div className={`max-h-64 overflow-y-auto rounded-xl border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                        {discoveredTables
                                            .filter(t => t.table_name.toLowerCase().includes(tableSearchQuery.toLowerCase()))
                                            .map((table) => (
                                                <button
                                                    key={table.table_name}
                                                    onClick={() => toggleTableSelection(table.table_name)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b transition-colors ${isDark
                                                        ? 'border-slate-700 hover:bg-slate-800'
                                                        : 'border-slate-100 hover:bg-slate-50'
                                                        } ${selectedTables.includes(table.table_name)
                                                            ? isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                                                            : ''
                                                        }`}
                                                >
                                                    {selectedTables.includes(table.table_name) ? (
                                                        <CheckSquare className="w-5 h-5 text-blue-500" />
                                                    ) : (
                                                        <Square className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                            {table.table_name}
                                                        </span>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                                        {Number(table.row_count).toLocaleString()} rows
                                                    </span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {selectedNetwork && !isDiscovering && discoveredTables.length === 0 && (
                                <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>Click "Scan Tables" to discover tables from the selected database</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                {selectedTables.length > 0 ? `${selectedTables.length} tables selected` : 'No tables selected'}
                            </span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowImportModal(false);
                                        setDiscoveredTables([]);
                                        setSelectedTables([]);
                                        setSelectedNetwork(null);
                                    }}
                                    className={`px-5 py-2.5 rounded-xl font-medium ${isDark
                                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                        }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkImport}
                                    disabled={selectedTables.length === 0 || isImporting}
                                    className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 ${selectedTables.length === 0 || isImporting
                                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        }`}
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            Import {selectedTables.length} Tables
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Schema"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                isLoading={isLoading}
            />
        </div>
    );
}

export default Schema;
