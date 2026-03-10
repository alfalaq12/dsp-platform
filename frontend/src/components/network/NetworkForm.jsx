import React, { useState, useEffect } from 'react';
import {
    Save, X, Database, Globe, Shield, Activity,
    Copy, Download, ArrowLeftRight, Check, AlertCircle,
    Terminal, Clipboard, FileType, ChevronDown, List, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import TestConsole from './TestConsole';

const NetworkForm = ({ formData, setFormData, editingId, isSubmitting, onSubmit, onCancel, addToast }) => {
    const { isDark } = useTheme();
    const [activeSourceType, setActiveSourceType] = useState(formData.source_type || 'database');
    const [activeTargetType, setActiveTargetType] = useState(formData.target_source_type || 'database');
    const [showTestConsole, setShowTestConsole] = useState(false);
    const [testConfig, setTestConfig] = useState(null);
    const [testAgent, setTestAgent] = useState('');

    useEffect(() => {
        setActiveSourceType(formData.source_type);
        setActiveTargetType(formData.target_source_type);
    }, [formData.source_type, formData.target_source_type]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleCopySourceToTarget = () => {
        setFormData(prev => ({
            ...prev,
            target_source_type: prev.source_type,
            target_db_driver: prev.db_driver,
            target_db_host: prev.db_host,
            target_db_port: prev.db_port,
            target_db_user: prev.db_user,
            target_db_password: prev.db_password,
            target_db_name: prev.db_name,
            target_db_sslmode: prev.db_sslmode,
        }));
        addToast('Source configuration copied to Target', 'info');
    };

    const handleReverse = () => {
        setFormData(prev => ({
            ...prev,
            // Swap General
            source_type: prev.target_source_type,
            target_source_type: prev.source_type,

            // Swap DB Config
            db_driver: prev.target_db_driver,
            target_db_driver: prev.db_driver,
            db_host: prev.target_db_host,
            target_db_host: prev.db_host,
            db_port: prev.target_db_port,
            target_db_port: prev.db_port,
            db_user: prev.target_db_user,
            target_db_user: prev.db_user,
            db_password: prev.target_db_password,
            target_db_password: prev.db_password,
            db_name: prev.target_db_name,
            target_db_name: prev.db_name,
            db_sslmode: prev.target_db_sslmode,
            target_db_sslmode: prev.db_sslmode,
        }));
        addToast('Source and Target configurations reversed', 'info');
    };

    const openTestConsole = (isTarget = false) => {
        const config = isTarget ? {
            driver: formData.target_db_driver,
            host: formData.target_db_host,
            port: formData.target_db_port,
            user: formData.target_db_user,
            password: formData.target_db_password,
            db_name: formData.target_db_name,
            sslmode: formData.target_db_sslmode,
        } : {
            driver: formData.db_driver,
            host: formData.db_host,
            port: formData.db_port,
            user: formData.db_user,
            password: formData.db_password,
            db_name: formData.db_name,
            sslmode: formData.db_sslmode,
        };

        setTestConfig(config);
        setTestAgent(formData.agent_name || 'LOCAL');
        setShowTestConsole(true);
    };

    const inputClasses = `w-full px-4 py-2.5 rounded-xl border-2 transition-all outline-none text-sm ${isDark
        ? 'bg-slate-800/50 border-slate-700/50 text-white focus:border-purple-500/50 focus:bg-slate-800'
        : 'bg-white border-slate-300 text-slate-900 focus:border-purple-500 shadow-sm'
        }`;

    const labelClasses = `block text-xs font-bold mb-2 uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

    const SectionHeader = ({ title, icon: Icon, color = 'purple' }) => (
        <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-400`}>
                <Icon className="w-5 h-5" />
            </div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <div className={`flex-1 h-[2px] ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`rounded-3xl border shadow-2xl overflow-hidden mb-8 ${isDark ? 'bg-slate-900/80 border-slate-800 backdrop-blur-xl' : 'bg-white border-slate-400'}`}
        >
            {/* Form Header */}
            <div className={`px-8 py-6 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-100 border-slate-300 shadow-sm'}`}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-lg">
                        <Terminal className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{editingId ? 'Edit Configuration' : 'New Network Hub'}</h2>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Hub ID: <span className="font-mono text-purple-500">{editingId || 'AUTO_INC'}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-200 bg-slate-100 border border-slate-300 shadow-sm'}`}>
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl transition-all font-bold shadow-lg shadow-purple-500/20 flex items-center gap-2"
                    >
                        {isSubmitting ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> : <Save className="w-4 h-4" />}
                        {editingId ? 'Update Hub' : 'Launch Hub'}
                    </button>
                </div>
            </div>

            <div className="p-8">
                {/* General Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="md:col-span-2 grid grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Hub Name</label>
                            <input name="name" value={formData.name} onChange={handleChange} className={inputClasses} placeholder="e.g. Primary Data Nexus" />
                        </div>
                        <div>
                            <label className={labelClasses}>Assigned Agent</label>
                            <input name="agent_name" value={formData.agent_name} onChange={handleChange} className={inputClasses} placeholder="Agent Identifier" />
                        </div>
                        <div>
                            <label className={labelClasses}>Sync Schedule (Cron)</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                                <input name="schedule" value={formData.schedule} onChange={handleChange} className={`${inputClasses} pl-12`} placeholder="*/5 * * * *" />
                            </div>
                        </div>
                        <div>
                            <label className={labelClasses}>Schema Reference</label>
                            <input name="schema_name" value={formData.schema_name} onChange={handleChange} className={inputClasses} placeholder="Internal Schema Tag" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>Operational Notes</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} className={`${inputClasses} h-[130px] resize-none`} placeholder="Describe the purpose of this connection..." />
                    </div>
                </div>

                {/* Source & Target Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative">

                    {/* Source Box */}
                    <div className={`p-8 rounded-3xl border-2 transition-all ${isDark ? 'bg-slate-800/20 border-slate-800/50 hover:border-purple-500/30' : 'bg-white border-slate-400 hover:border-purple-500 shadow-md'}`}>
                        <div className="flex items-center justify-between mb-8">
                            <SectionHeader title="SOURCE NODE" icon={Database} color="purple" />
                            <div className="flex items-center gap-2">
                                <button onClick={() => openTestConsole(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-purple-400 hover:bg-purple-500/20' : 'bg-white text-purple-600 border border-purple-100 shadow-sm hover:bg-purple-50'}`}>
                                    <Terminal className="w-4 h-4" />
                                </button>
                                <button onClick={handleCopySourceToTarget} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-blue-400 hover:bg-blue-500/20' : 'bg-white text-blue-600 border border-blue-100 shadow-sm hover:bg-blue-50'}`}>
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <select name="db_driver" value={formData.db_driver} onChange={handleChange} className={inputClasses}>
                                        <option value="postgres">PostgreSQL 42.2.19 (JDBC)</option>
                                        <option value="mysql">MySQL Connector/J 8.0</option>
                                        <option value="sqlserver">Microsoft SQL Server (jTDS)</option>
                                        <option value="oracle">ORACLE Thin Driver</option>
                                        <option value="sqlite">SQLite (Spatialite)</option>
                                        <option value="sap_hana">SAP HANA 2.4.63</option>
                                        <option value="db2">IBM DB2 10.1 FP0 (GA)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClasses}>SSL Policy</label>
                                    <select name="db_sslmode" value={formData.db_sslmode} onChange={handleChange} className={inputClasses}>
                                        <option value="disable">Disabled</option>
                                        <option value="require">Required</option>
                                        <option value="verify-full">Verify Full</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={labelClasses}>Connectivity (Host:Port)</label>
                                <div className="flex items-center gap-3">
                                    <input name="db_host" value={formData.db_host} onChange={handleChange} className={`${inputClasses} flex-1 min-w-0`} placeholder="localhost" />
                                    <span className="text-slate-500 font-bold">:</span>
                                    <input name="db_port" value={formData.db_port} onChange={handleChange} className={`${inputClasses} w-32 min-w-0`} placeholder="5432" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className={labelClasses}>User Identity</label>
                                    <input name="db_user" value={formData.db_user} onChange={handleChange} className={inputClasses} placeholder="username" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Passkey</label>
                                    <input type="password" name="db_password" value={formData.db_password} onChange={handleChange} className={inputClasses} placeholder="••••••••" />
                                </div>
                            </div>

                            <div>
                                <label className={labelClasses}>Database Identifier</label>
                                <input name="db_name" value={formData.db_name} onChange={handleChange} className={inputClasses} placeholder="database_name" />
                            </div>
                        </div>
                    </div>

                    {/* Bridge Icon - Desktop only */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 hidden lg:flex flex-col items-center gap-4 z-20">
                        <button onClick={handleReverse} className={`p-4 rounded-full border-4 shadow-2xl transition-all hover:scale-110 active:rotate-180 duration-500 ${isDark ? 'bg-slate-900 border-slate-800 text-purple-500' : 'bg-white border-slate-100 text-purple-600'}`}>
                            <ArrowLeftRight className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Target Box */}
                    <div className={`p-8 rounded-3xl border-2 transition-all ${isDark ? 'bg-slate-800/20 border-slate-800/50 hover:border-emerald-500/30' : 'bg-white border-slate-400 hover:border-emerald-500 shadow-md'}`}>
                        <div className="flex items-center justify-between mb-8">
                            <SectionHeader title="TARGET NODE" icon={Shield} color="emerald" />
                            <div className="flex items-center gap-2">
                                <button onClick={() => openTestConsole(true)} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white text-emerald-600 border border-emerald-100 shadow-sm hover:bg-emerald-50'}`}>
                                    <Terminal className="w-4 h-4" />
                                </button>
                                <button onClick={handleReverse} className={`lg:hidden p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-100 shadow-sm hover:bg-slate-50'}`}>
                                    <ArrowLeftRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <select name="target_db_driver" value={formData.target_db_driver} onChange={handleChange} className={inputClasses}>
                                        <option value="postgres">PostgreSQL 42.2.19 (JDBC)</option>
                                        <option value="mysql">MySQL Connector/J 8.0</option>
                                        <option value="sqlserver">Microsoft SQL Server (jTDS)</option>
                                        <option value="oracle">ORACLE Thin Driver</option>
                                        <option value="sqlite">SQLite (Spatialite)</option>
                                        <option value="sap_hana">SAP HANA 2.4.63</option>
                                        <option value="db2">IBM DB2 10.1 FP0 (GA)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClasses}>SSL Policy</label>
                                    <select name="target_db_sslmode" value={formData.target_db_sslmode} onChange={handleChange} className={inputClasses}>
                                        <option value="disable">Disabled</option>
                                        <option value="require">Required</option>
                                        <option value="verify-full">Verify Full</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={labelClasses}>Connectivity (Host:Port)</label>
                                <div className="flex items-center gap-3">
                                    <input name="target_db_host" value={formData.target_db_host} onChange={handleChange} className={`${inputClasses} flex-1 min-w-0`} placeholder="localhost" />
                                    <span className="text-slate-500 font-bold">:</span>
                                    <input name="target_db_port" value={formData.target_db_port} onChange={handleChange} className={`${inputClasses} w-32 min-w-0`} placeholder="5432" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className={labelClasses}>User Identity</label>
                                    <input name="target_db_user" value={formData.target_db_user} onChange={handleChange} className={inputClasses} placeholder="username" />
                                </div>
                                <div>
                                    <label className={labelClasses}>Passkey</label>
                                    <input type="password" name="target_db_password" value={formData.target_db_password} onChange={handleChange} className={inputClasses} placeholder="••••••••" />
                                </div>
                            </div>

                            <div>
                                <label className={labelClasses}>Database Identifier</label>
                                <input name="target_db_name" value={formData.target_db_name} onChange={handleChange} className={inputClasses} placeholder="database_name" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Test Console Overlay */}
            <AnimatePresence>
                {showTestConsole && (
                    <TestConsole
                        network={null} // We are testing with form values, not saved entity
                        agentName={testAgent}
                        dbConfig={testConfig}
                        onClose={() => setShowTestConsole(false)}
                        addToast={addToast}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default NetworkForm;
