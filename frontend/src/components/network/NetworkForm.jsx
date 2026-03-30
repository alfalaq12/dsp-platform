import React, { useState, useEffect } from 'react';
import {
    Save, X, Database, Globe, Shield, Activity,
    Copy, Download, ArrowLeftRight, Check, AlertCircle,
    Terminal, Clipboard, FileType, ChevronDown, List, Clock,
    Upload, Cloud, Key, Lock, FolderOpen, Server, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import TestConsole from './TestConsole';

const SOURCE_TYPES = [
    { value: 'database', label: 'Database', icon: Database, color: 'purple' },
    { value: 'ftp', label: 'FTP', icon: Upload, color: 'blue' },
    { value: 'sftp', label: 'SFTP', icon: Lock, color: 'cyan' },
    { value: 'minio', label: 'Object Storage', icon: Cloud, color: 'orange' },
    { value: 'api', label: 'REST API', icon: Globe, color: 'pink' },
];

const NetworkForm = ({ formData, setFormData, editingId, isSubmitting, onSubmit, onCancel, addToast }) => {
    const { isDark } = useTheme();
    const [activeSourceType, setActiveSourceType] = useState(formData.source_type || 'database');
    const [activeTargetType, setActiveTargetType] = useState(formData.target_source_type || 'database');
    const [showTestConsole, setShowTestConsole] = useState(false);
    const [testConfig, setTestConfig] = useState(null);
    const [testAgent, setTestAgent] = useState('');

    useEffect(() => {
        setActiveSourceType(formData.source_type || 'database');
        setActiveTargetType(formData.target_source_type || 'database');
    }, [formData.source_type, formData.target_source_type]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Parse a single "host:port" string into separate host and port fields
    const handleHostPort = (hostField, portField, combinedValue) => {
        const lastColon = combinedValue.lastIndexOf(':');
        if (lastColon !== -1) {
            const host = combinedValue.substring(0, lastColon);
            const port = combinedValue.substring(lastColon + 1);
            setFormData(prev => ({ ...prev, [hostField]: host, [portField]: port }));
        } else {
            setFormData(prev => ({ ...prev, [hostField]: combinedValue }));
        }
    };

    const handleSourceTypeChange = (type) => {
        setActiveSourceType(type);
        setFormData(prev => ({ ...prev, source_type: type }));
    };

    const handleTargetTypeChange = (type) => {
        setActiveTargetType(type);
        setFormData(prev => ({ ...prev, target_source_type: type }));
    };

    const handleCopySourceToTarget = () => {
        setFormData(prev => ({
            ...prev,
            target_source_type: prev.source_type,
            // DB
            target_db_driver: prev.db_driver,
            target_db_host: prev.db_host,
            target_db_port: prev.db_port,
            target_db_user: prev.db_user,
            target_db_password: prev.db_password,
            target_db_name: prev.db_name,
            target_db_sslmode: prev.db_sslmode,
            // FTP/SFTP
            target_ftp_host: prev.ftp_host,
            target_ftp_port: prev.ftp_port,
            target_ftp_user: prev.ftp_user,
            target_ftp_password: prev.ftp_password,
            target_ftp_private_key: prev.ftp_private_key,
            target_ftp_path: prev.ftp_path,
            // API
            target_api_url: prev.api_url,
            target_api_method: prev.api_method,
            target_api_headers: prev.api_headers,
            target_api_auth_type: prev.api_auth_type,
            target_api_auth_key: prev.api_auth_key,
            target_api_auth_value: prev.api_auth_value,
            target_api_body: prev.api_body,
            // MinIO
            target_minio_endpoint: prev.minio_endpoint,
            target_minio_access_key: prev.minio_access_key,
            target_minio_secret_key: prev.minio_secret_key,
            target_minio_bucket: prev.minio_bucket,
            target_minio_object_path: prev.minio_object_path,
            target_minio_use_ssl: prev.minio_use_ssl,
            target_minio_region: prev.minio_region,
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
            db_driver: prev.target_db_driver, target_db_driver: prev.db_driver,
            db_host: prev.target_db_host, target_db_host: prev.db_host,
            db_port: prev.target_db_port, target_db_port: prev.db_port,
            db_user: prev.target_db_user, target_db_user: prev.db_user,
            db_password: prev.target_db_password, target_db_password: prev.db_password,
            db_name: prev.target_db_name, target_db_name: prev.db_name,
            db_sslmode: prev.target_db_sslmode, target_db_sslmode: prev.db_sslmode,
            // Swap FTP/SFTP
            ftp_host: prev.target_ftp_host, target_ftp_host: prev.ftp_host,
            ftp_port: prev.target_ftp_port, target_ftp_port: prev.ftp_port,
            ftp_user: prev.target_ftp_user, target_ftp_user: prev.ftp_user,
            ftp_password: prev.target_ftp_password, target_ftp_password: prev.ftp_password,
            ftp_private_key: prev.target_ftp_private_key, target_ftp_private_key: prev.ftp_private_key,
            ftp_path: prev.target_ftp_path, target_ftp_path: prev.ftp_path,
            // Swap API
            api_url: prev.target_api_url, target_api_url: prev.api_url,
            api_method: prev.target_api_method, target_api_method: prev.api_method,
            api_headers: prev.target_api_headers, target_api_headers: prev.api_headers,
            api_auth_type: prev.target_api_auth_type, target_api_auth_type: prev.api_auth_type,
            api_auth_key: prev.target_api_auth_key, target_api_auth_key: prev.api_auth_key,
            api_auth_value: prev.target_api_auth_value, target_api_auth_value: prev.api_auth_value,
            api_body: prev.target_api_body, target_api_body: prev.api_body,
            // Swap MinIO
            minio_endpoint: prev.target_minio_endpoint, target_minio_endpoint: prev.minio_endpoint,
            minio_access_key: prev.target_minio_access_key, target_minio_access_key: prev.minio_access_key,
            minio_secret_key: prev.target_minio_secret_key, target_minio_secret_key: prev.minio_secret_key,
            minio_bucket: prev.target_minio_bucket, target_minio_bucket: prev.minio_bucket,
            minio_object_path: prev.target_minio_object_path, target_minio_object_path: prev.minio_object_path,
            minio_use_ssl: prev.target_minio_use_ssl, target_minio_use_ssl: prev.minio_use_ssl,
            minio_region: prev.target_minio_region, target_minio_region: prev.minio_region,
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
        // If testing target, it's usually on Master host
        const agent = isTarget ? 'MASTER' : (formData.agent_name || formData.name || 'LOCAL');
        setTestAgent(agent);
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

    // ===== Source Type Tabs =====
    const SourceTypeTabs = ({ activeType, onTypeChange, prefix = '' }) => (
        <div className={`flex flex-wrap gap-1.5 p-1.5 rounded-2xl mb-6 ${isDark ? 'bg-slate-800/60' : 'bg-slate-100 border border-slate-200'}`}>
            {SOURCE_TYPES.map(({ value, label, icon: Icon, color }) => {
                const isActive = activeType === value;
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onTypeChange(value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                            isActive
                                ? (isDark
                                    ? `bg-${color}-500/20 text-${color}-400 shadow-lg shadow-${color}-500/10 border border-${color}-500/30`
                                    : `bg-white text-${color}-600 shadow-md border border-${color}-200`)
                                : (isDark
                                    ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/60')
                        }`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </button>
                );
            })}
        </div>
    );

    // ===== Conditional Form Fields =====
    const DatabaseFields = ({ prefix = '' }) => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={labelClasses}>Driver</label>
                    <select name={`${prefix}db_driver`} value={formData[`${prefix}db_driver`]} onChange={handleChange} className={inputClasses}>
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
                    <select name={`${prefix}db_sslmode`} value={formData[`${prefix}db_sslmode`]} onChange={handleChange} className={inputClasses}>
                        <option value="disable">Disabled</option>
                        <option value="require">Required</option>
                        <option value="verify-full">Verify Full</option>
                    </select>
                </div>
            </div>

            <div>
                <label className={labelClasses}>Connectivity (Host:Port)</label>
                <input
                    value={`${formData[`${prefix}db_host`] || ''}${formData[`${prefix}db_port`] !== undefined ? ':' + formData[`${prefix}db_port`] : ''}`}
                    onChange={(e) => handleHostPort(`${prefix}db_host`, `${prefix}db_port`, e.target.value)}
                    className={inputClasses}
                    placeholder="localhost:5432"
                />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={labelClasses}>User Identity</label>
                    <input name={`${prefix}db_user`} value={formData[`${prefix}db_user`]} onChange={handleChange} className={inputClasses} placeholder="username" />
                </div>
                <div>
                    <label className={labelClasses}>Passkey</label>
                    <input type="password" name={`${prefix}db_password`} value={formData[`${prefix}db_password`]} onChange={handleChange} className={inputClasses} placeholder="••••••••" />
                </div>
            </div>

            <div>
                <label className={labelClasses}>Database Identifier</label>
                <input name={`${prefix}db_name`} value={formData[`${prefix}db_name`]} onChange={handleChange} className={inputClasses} placeholder="database_name" />
            </div>
        </div>
    );

    const FtpFields = ({ prefix = '', isSftp = false }) => (
        <div className="space-y-6">
            <div>
                <label className={labelClasses}>Connectivity (Host:Port)</label>
                <input
                    value={`${formData[`${prefix}ftp_host`] || ''}${formData[`${prefix}ftp_port`] !== undefined ? ':' + formData[`${prefix}ftp_port`] : ''}`}
                    onChange={(e) => handleHostPort(`${prefix}ftp_host`, `${prefix}ftp_port`, e.target.value)}
                    className={inputClasses}
                    placeholder={isSftp ? 'sftp.example.com:22' : 'ftp.example.com:21'}
                />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={labelClasses}>Username</label>
                    <input name={`${prefix}ftp_user`} value={formData[`${prefix}ftp_user`]} onChange={handleChange} className={inputClasses} placeholder="ftp_user" />
                </div>
                <div>
                    <label className={labelClasses}>Password</label>
                    <input type="password" name={`${prefix}ftp_password`} value={formData[`${prefix}ftp_password`]} onChange={handleChange} className={inputClasses} placeholder="••••••••" />
                </div>
            </div>

            {isSftp && (
                <div>
                    <label className={labelClasses}>Private Key (PEM)</label>
                    <textarea name={`${prefix}ftp_private_key`} value={formData[`${prefix}ftp_private_key`]} onChange={handleChange} className={`${inputClasses} h-24 resize-none font-mono text-xs`} placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." />
                </div>
            )}

            <div>
                <label className={labelClasses}>Remote Path</label>
                <div className="relative">
                    <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input name={`${prefix}ftp_path`} value={formData[`${prefix}ftp_path`]} onChange={handleChange} className={`${inputClasses} pl-12`} placeholder="/data/exports/" />
                </div>
            </div>

            {!isSftp && !prefix && (
                <div className="flex items-center gap-3">
                    <input type="checkbox" id={`${prefix}ftp_passive`} name={`${prefix}ftp_passive`} checked={formData[`${prefix}ftp_passive`] !== false} onChange={handleChange} className="w-4 h-4 rounded text-blue-600" />
                    <label htmlFor={`${prefix}ftp_passive`} className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Passive Mode</label>
                </div>
            )}
        </div>
    );

    const MinioFields = ({ prefix = '' }) => (
        <div className="space-y-6">
            <div>
                <label className={labelClasses}>Endpoint URL</label>
                <div className="relative">
                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input name={`${prefix}minio_endpoint`} value={formData[`${prefix}minio_endpoint`]} onChange={handleChange} className={`${inputClasses} pl-12`} placeholder="s3.amazonaws.com or minio.local:9000" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={labelClasses}>Access Key</label>
                    <input name={`${prefix}minio_access_key`} value={formData[`${prefix}minio_access_key`]} onChange={handleChange} className={inputClasses} placeholder="AKIA..." />
                </div>
                <div>
                    <label className={labelClasses}>Secret Key</label>
                    <input type="password" name={`${prefix}minio_secret_key`} value={formData[`${prefix}minio_secret_key`]} onChange={handleChange} className={inputClasses} placeholder="••••••••" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={labelClasses}>Bucket Name</label>
                    <div className="relative">
                        <HardDrive className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input name={`${prefix}minio_bucket`} value={formData[`${prefix}minio_bucket`]} onChange={handleChange} className={`${inputClasses} pl-12`} placeholder="my-bucket" />
                    </div>
                </div>
                <div>
                    <label className={labelClasses}>Region</label>
                    <input name={`${prefix}minio_region`} value={formData[`${prefix}minio_region`]} onChange={handleChange} className={inputClasses} placeholder="us-east-1" />
                </div>
            </div>

            <div>
                <label className={labelClasses}>Object Path / Prefix</label>
                <div className="relative">
                    <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input name={`${prefix}minio_object_path`} value={formData[`${prefix}minio_object_path`]} onChange={handleChange} className={`${inputClasses} pl-12`} placeholder="data/exports/" />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <input type="checkbox" id={`${prefix}minio_use_ssl`} name={`${prefix}minio_use_ssl`} checked={formData[`${prefix}minio_use_ssl`] || false} onChange={handleChange} className="w-4 h-4 rounded text-blue-600" />
                <label htmlFor={`${prefix}minio_use_ssl`} className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Use SSL / HTTPS</label>
            </div>

            {prefix === 'target_' && (
                <div>
                    <label className={labelClasses}>Export Format</label>
                    <select name={`${prefix}minio_export_format`} value={formData[`${prefix}minio_export_format`] || 'csv'} onChange={handleChange} className={inputClasses}>
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                        <option value="parquet">Parquet</option>
                    </select>
                </div>
            )}
        </div>
    );

    const ApiFields = ({ prefix = '' }) => (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                    <label className={labelClasses}>Method</label>
                    <select name={`${prefix}api_method`} value={formData[`${prefix}api_method`]} onChange={handleChange} className={inputClasses}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className={labelClasses}>URL</label>
                    <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input name={`${prefix}api_url`} value={formData[`${prefix}api_url`]} onChange={handleChange} className={`${inputClasses} pl-12`} placeholder="https://api.example.com/v1/data" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className={labelClasses}>Auth Type</label>
                    <select name={`${prefix}api_auth_type`} value={formData[`${prefix}api_auth_type`]} onChange={handleChange} className={inputClasses}>
                        <option value="none">No Auth</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                        <option value="api_key">API Key</option>
                    </select>
                </div>
                {formData[`${prefix}api_auth_type`] && formData[`${prefix}api_auth_type`] !== 'none' && (
                    <div>
                        <label className={labelClasses}>{formData[`${prefix}api_auth_type`] === 'api_key' ? 'Key Name' : 'Username / Key'}</label>
                        <input name={`${prefix}api_auth_key`} value={formData[`${prefix}api_auth_key`]} onChange={handleChange} className={inputClasses} placeholder="Authorization key" />
                    </div>
                )}
            </div>

            {formData[`${prefix}api_auth_type`] && formData[`${prefix}api_auth_type`] !== 'none' && (
                <div>
                    <label className={labelClasses}>{formData[`${prefix}api_auth_type`] === 'basic' ? 'Password' : 'Token / Value'}</label>
                    <input type="password" name={`${prefix}api_auth_value`} value={formData[`${prefix}api_auth_value`]} onChange={handleChange} className={inputClasses} placeholder="••••••••" />
                </div>
            )}

            <div>
                <label className={labelClasses}>Headers (JSON)</label>
                <textarea name={`${prefix}api_headers`} value={formData[`${prefix}api_headers`]} onChange={handleChange} className={`${inputClasses} h-20 resize-none font-mono text-xs`} placeholder='{"Content-Type": "application/json"}' />
            </div>

            <div>
                <label className={labelClasses}>Body (JSON)</label>
                <textarea name={`${prefix}api_body`} value={formData[`${prefix}api_body`]} onChange={handleChange} className={`${inputClasses} h-24 resize-none font-mono text-xs`} placeholder='{"key": "value"}' />
            </div>
        </div>
    );

    // Render the correct form fields based on source type
    const renderFields = (type, prefix = '') => {
        switch (type) {
            case 'database': return <DatabaseFields prefix={prefix} />;
            case 'ftp': return <FtpFields prefix={prefix} isSftp={false} />;
            case 'sftp': return <FtpFields prefix={prefix} isSftp={true} />;
            case 'minio': return <MinioFields prefix={prefix} />;
            case 'api': return <ApiFields prefix={prefix} />;
            default: return <DatabaseFields prefix={prefix} />;
        }
    };

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
                                {activeSourceType === 'database' && (
                                    <button onClick={() => openTestConsole(false)} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-purple-400 hover:bg-purple-500/20' : 'bg-white text-purple-600 border border-purple-100 shadow-sm hover:bg-purple-50'}`}>
                                        <Terminal className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={handleCopySourceToTarget} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-blue-400 hover:bg-blue-500/20' : 'bg-white text-blue-600 border border-blue-100 shadow-sm hover:bg-blue-50'}`}>
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <SourceTypeTabs activeType={activeSourceType} onTypeChange={handleSourceTypeChange} />
                        {renderFields(activeSourceType, '')}
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
                                {activeTargetType === 'database' && (
                                    <button onClick={() => openTestConsole(true)} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white text-emerald-600 border border-emerald-100 shadow-sm hover:bg-emerald-50'}`}>
                                        <Terminal className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={handleReverse} className={`lg:hidden p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-100 shadow-sm hover:bg-slate-50'}`}>
                                    <ArrowLeftRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <SourceTypeTabs activeType={activeTargetType} onTypeChange={handleTargetTypeChange} />
                        {renderFields(activeTargetType, 'target_')}
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
