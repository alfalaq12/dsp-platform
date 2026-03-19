import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Database, Eye, Code, FileSpreadsheet, Download, Search, Filter, CheckSquare, Square, Loader2 } from 'lucide-react';
import { useSchemas, useNetworks, useCreateSchema, useUpdateSchema, useDeleteSchema, useDiscoverTables, useBulkCreateSchemas, useNetworkSchemas } from '../hooks/useQueries';
import { useToast, ToastContainer, ConfirmModal, ViewModal } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { getErrorMessage } from '../utils/errorHelper';
import SchemaTable from '../components/schema/SchemaTable';
import SchemaForm from '../components/schema/SchemaForm';

function Schema() {
    const { isDark } = useTheme();
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        source_type: 'query',
        rules: []
    });

    const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
    const [selectedSchemaForView, setSelectedSchemaForView] = useState(null);

    // New states for enhanced UX
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const { toasts, addToast, removeToast } = useToast();
    const userRole = localStorage.getItem('role') || 'viewer';

    // Pagination states (Handled internally by SchemaTable now, but kept if needed for bulk)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(16);

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

    const [searchName, setSearchName] = useState('');
    const [searchGroup, setSearchGroup] = useState('');
    const [activeSearchName, setActiveSearchName] = useState('');
    const [activeSearchGroup, setActiveSearchGroup] = useState('');

    const handleSearch = () => {
        setActiveSearchName(searchName);
        setActiveSearchGroup(searchGroup);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // React Query hooks
    const { data: allSchemasData } = useSchemas();
    const { data: networksData } = useNetworks();
    const rawSchemas = allSchemasData || [];
    const allNetworks = networksData || [];
    
    // Filter schemas based on search
    const schemas = rawSchemas.filter(s => {
        const matchesName = !activeSearchName || 
            (s.name && s.name.toLowerCase().includes(activeSearchName.toLowerCase())) ||
            (s.target_table && s.target_table.toLowerCase().includes(activeSearchName.toLowerCase()));
            
        const actualGroup = s.group || 'General';
        const matchesGroup = !activeSearchGroup || 
            actualGroup.toLowerCase().includes(activeSearchGroup.toLowerCase());
            
        return matchesName && matchesGroup;
    });
    
    const createSchemaMutation = useCreateSchema();
    const updateSchemaMutation = useUpdateSchema();
    const deleteSchemaMutation = useDeleteSchema();
    const discoverTablesMutation = useDiscoverTables();
    const bulkCreateSchemasMutation = useBulkCreateSchemas();

    // Filter only database type networks
    const networks = Array.isArray(allNetworks) ? allNetworks.filter(n => n.source_type === 'database' || n.db_host) : [];

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
                prefix: importPrefix || '',
                db_schema: selectedDbSchema || ''
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

    const onFormSave = async (data) => {
        setIsSubmitting(true);
        try {
            // Strip id and timestamps from payload to avoid conflicts
            const { id, created_at, updated_at, ...saveData } = data;
            if (editingId) {
                await updateSchemaMutation.mutateAsync({ id: editingId, data: saveData });
                addToast('Schema updated successfully!', 'success');
            } else {
                await createSchemaMutation.mutateAsync(saveData);
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
        if (!schema) {
            addToast('Please select a schema to edit', 'warning');
            return;
        }

        let finalSchema = { ...schema };
        // Auto-convert legacy SQL schemas to Rules format for editing compatibility
        if ((!schema.rules || schema.rules.length === 0) && schema.sql_command) {
            finalSchema.rules = [{
                source_query: schema.sql_command,
                target_table: schema.target_table || '',
                truncate: false,
                notes: 'Auto-converted from legacy format'
            }];
        } else {
            finalSchema.rules = schema.rules || [];
        }

        setEditingId(schema.id);
        setFormData(finalSchema);
        setViewMode('form');
    };

    const handleDeleteClick = (schema) => {
        if (!schema) {
            addToast('Please select a schema to delete', 'warning');
            return;
        }
        setDeleteTarget(schema);
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

    const handleDuplicate = async (schema) => {
        if (!schema) {
            addToast('Please select a schema to duplicate', 'warning');
            return;
        }
        setIsSubmitting(true);
        try {
            const { id, created_at, updated_at, ...duplicateData } = schema;
            duplicateData.name = `${schema.name} (Copy)`;
            await createSchemaMutation.mutateAsync(duplicateData);
            addToast('Schema duplicated successfully!', 'success');
        } catch (error) {
            addToast(getErrorMessage(error), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            source_type: 'query',
            rules: []
        });
        setEditingId(null);
        setViewMode('list');
    };

    return (
        <div className="h-full">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {viewMode === 'list' ? (
                <div className={`min-h-screen animate-fade-in ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
                        {/* Page Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className={`text-3xl font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Schema Management</h1>
                                <p className={isDark ? 'text-slate-400 mt-1' : 'text-slate-500 mt-1'}>Manage and configure data extraction rules</p>
                            </div>
                            <div>
                                <button
                                    onClick={() => setShowImportModal(true)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-semibold transition-all shadow-sm ${
                                        isDark 
                                            ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' 
                                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <Download className="w-4 h-4" />
                                    Import Tables
                                </button>
                            </div>
                        </div>

                        {/* Top Action Bar */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setViewMode('form');
                                    }}
                                    className={`px-6 py-2.5 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-2 ${
                                        isDark ? 'bg-blue-700 hover:bg-blue-600 shadow-blue-900/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                    }`}
                                >
                                    <Plus className="w-5 h-5" />
                                    New Schema
                                </button>
                            </div>

                            <div className={`flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl border shadow-sm w-full lg:w-auto ${
                                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                            }`}>
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by Name..."
                                        value={searchName}
                                        onChange={(e) => setSearchName(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className={`w-full pl-9 pr-4 py-2 border-transparent rounded-xl text-sm transition-all outline-none ${
                                            isDark ? 'bg-slate-800 text-slate-200 focus:bg-slate-700' : 'bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500'
                                        }`}
                                    />
                                </div>
                                <div className="relative flex-1 sm:w-64">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by Group..."
                                        value={searchGroup}
                                        onChange={(e) => setSearchGroup(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className={`w-full pl-9 pr-4 py-2 border-transparent rounded-xl text-sm transition-all outline-none ${
                                            isDark ? 'bg-slate-800 text-slate-200 focus:bg-slate-700' : 'bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500'
                                        }`}
                                    />
                                </div>
                                <button 
                                    onClick={handleSearch}
                                    className={`w-full sm:w-auto px-6 py-2 text-white rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                    isDark ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
                                }`}>
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* Data Table Container */}
                        <div className={`rounded-3xl border shadow-xl overflow-hidden ${
                            isDark ? 'bg-slate-900 border-slate-800 shadow-black/20' : 'bg-white border-slate-200 shadow-slate-200/50'
                        }`}>
                            <SchemaTable
                                schemas={schemas}
                                onEdit={handleEdit}
                                onDelete={handleDeleteClick}
                                onDuplicate={handleDuplicate}
                                onView={(s) => { if (s) setSelectedSchemaForView(s); }}
                                onNew={() => {
                                    resetForm();
                                    setViewMode('form');
                                }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full animate-slide-up">
                    <SchemaForm
                        schema={formData}
                        isNew={!editingId}
                        onSave={onFormSave}
                        onCancel={resetForm}
                    />
                </div>
            )}

            <ViewModal
                isOpen={!!selectedSchemaForView}
                onClose={() => setSelectedSchemaForView(null)}
                title="Schema Details"
            >
                {selectedSchemaForView && (
                    <div className="space-y-4">
                        <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-100'}`}>
                            <div className="flex justify-between mb-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Schema Name</span>
                                <span className="text-sm font-medium">{selectedSchemaForView.name}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Source Type</span>
                                <span className="text-sm font-medium uppercase">{selectedSchemaForView.source_type}</span>
                            </div>
                        </div>

                        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800/20 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <table className="w-full text-xs">
                                <thead className={isDark ? 'bg-slate-900' : 'bg-slate-100'}>
                                    <tr>
                                        <th className="px-3 py-2 text-left">Source Query / Rule</th>
                                        <th className="px-3 py-2 text-left">Target Table</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(selectedSchemaForView.rules || []).map((rule, i) => (
                                        <tr key={i} className="border-t border-slate-700/30">
                                            <td className="px-3 py-2 font-mono whitespace-pre-wrap">{rule.source_query}</td>
                                            <td className="px-3 py-2 font-medium text-blue-500">{rule.target_table}</td>
                                        </tr>
                                    ))}
                                    {(!selectedSchemaForView.rules || selectedSchemaForView.rules.length === 0) && (
                                        <tr className="border-t border-slate-700/30">
                                            <td className="px-3 py-2 font-mono whitespace-pre-wrap">{selectedSchemaForView.sql_command}</td>
                                            <td className="px-3 py-2 font-medium text-blue-500">{selectedSchemaForView.target_table}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </ViewModal>

            {showImportModal && createPortal(
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className={`w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                        <div className={`px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <h2 className="text-xl font-bold">Import Tables</h2>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Source Network</label>
                                <select
                                    value={selectedNetwork || ''}
                                    onChange={(e) => {
                                        setSelectedNetwork(e.target.value);
                                        setSelectedDbSchema('');
                                        setDiscoveredTables([]);
                                        setSelectedTables([]);
                                    }}
                                    className={`w-full px-4 py-2 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                >
                                    <option value="">Choose network...</option>
                                    {(networks || []).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </select>
                            </div>
                            {selectedNetwork && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-2">Schema</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedDbSchema}
                                            onChange={(e) => setSelectedDbSchema(e.target.value)}
                                            className={`flex-1 px-4 py-2 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                        >
                                            <option value="">All</option>
                                            {availableDbSchemas.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button onClick={handleDiscoverTables} className="px-4 py-2 bg-blue-600 text-white rounded-xl">Scan</button>
                                    </div>
                                </div>
                            )}
                            {discoveredTables.length > 0 && (
                                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                    {discoveredTables.map(t => (
                                        <div
                                            key={t.table_name}
                                            onClick={() => toggleTableSelection(t.table_name)}
                                            className={`flex items-center gap-3 px-4 py-2 border-b cursor-pointer ${selectedTables.includes(t.table_name) ? 'bg-blue-500/10' : ''}`}
                                        >
                                            <input type="checkbox" checked={selectedTables.includes(t.table_name)} readOnly />
                                            <span className="text-sm">{t.table_name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end gap-2">
                            <button onClick={() => setShowImportModal(false)} className="px-4 py-2">Cancel</button>
                            <button onClick={handleBulkImport} className="px-4 py-2 bg-emerald-600 text-white rounded-xl">Import</button>
                        </div>
                    </div>
                </div>
                , document.body)}

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="Delete Schema"
                message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
                confirmText="Delete"
                isLoading={isLoading}
                isDark={isDark}
            />
        </div>
    );
}

export default Schema;
