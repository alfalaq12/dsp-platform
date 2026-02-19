import { useState } from 'react';
import { Plus, Edit, Loader2, Zap, Database, Server, Shield, Globe, Folder, HardDrive, ArrowLeftRight } from 'lucide-react';
import { testTargetDBConnection } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

// Reusable input class helper
const inputClass = (isDark, ring = 'purple') =>
    `w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-${ring}-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`;

const smallInputClass = (isDark) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`;

// Source type options
const SOURCE_TYPES = [
    { id: 'database', label: 'Database', icon: Database },
    { id: 'mongodb', label: 'MongoDB', icon: Database },
    { id: 'redis', label: 'Redis', icon: Database },
    { id: 'minio', label: 'MinIO/S3', icon: HardDrive },
    { id: 'ftp', label: 'FTP', icon: Server },
    { id: 'sftp', label: 'SFTP (SSH)', icon: Shield },
    { id: 'api', label: 'REST API', icon: Globe }
];

const TARGET_TYPES = [
    { id: 'database', label: 'Database', icon: Database },
    { id: 'minio', label: 'MinIO/S3', icon: HardDrive },
    { id: 'ftp', label: 'FTP', icon: Server },
    { id: 'sftp', label: 'SFTP (SSH)', icon: Shield },
    { id: 'api', label: 'REST API', icon: Globe }
];

export default function NetworkForm({ formData, setFormData, editingId, isSubmitting, onSubmit, onCancel, addToast }) {
    const { isDark } = useTheme();
    const [formTestingSource, setFormTestingSource] = useState(false);
    const [formTestingTarget, setFormTestingTarget] = useState(false);

    const handleFormTestSource = async () => {
        const type = formData.source_type || 'database';
        if (type === 'database' && !formData.db_host) { addToast('Please fill in database host first', 'warning'); return; }
        if ((type === 'ftp' || type === 'sftp') && !formData.ftp_host) { addToast('Please fill in FTP/SFTP host first', 'warning'); return; }
        if (type === 'api' && !formData.api_url) { addToast('Please fill in API URL first', 'warning'); return; }
        try {
            setFormTestingSource(true);
            const testData = { driver: formData.db_driver, host: formData.db_host, port: formData.db_port, user: formData.db_user, password: formData.db_password, db_name: formData.db_name, sslmode: formData.db_sslmode };
            const response = await testTargetDBConnection(testData);
            if (response.data.success) {
                addToast(`Source connection successful! ${response.data.version ? `(${response.data.version.substring(0, 50)}...)` : ''}`, 'success');
            } else {
                addToast(response.data.error || 'Source test failed', 'error');
            }
        } catch (error) {
            addToast('Failed to test source: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setFormTestingSource(false); }
    };

    const handleFormTestTarget = async () => {
        const type = formData.target_source_type || 'database';
        if (type === 'database' && !formData.target_db_host) { addToast('Please fill in target database host first', 'warning'); return; }
        if ((type === 'ftp' || type === 'sftp') && !formData.target_ftp_host) { addToast('Please fill in target FTP/SFTP host first', 'warning'); return; }
        if (type === 'api' && !formData.target_api_url) { addToast('Please fill in target API URL first', 'warning'); return; }
        try {
            setFormTestingTarget(true);
            const testData = { driver: formData.target_db_driver, host: formData.target_db_host, port: formData.target_db_port, user: formData.target_db_user, password: formData.target_db_password, db_name: formData.target_db_name, sslmode: formData.target_db_sslmode };
            const response = await testTargetDBConnection(testData);
            if (response.data.success) {
                addToast(`Target connection successful! ${response.data.version ? `(${response.data.version.substring(0, 50)}...)` : ''}`, 'success');
            } else {
                addToast(response.data.error || 'Target test failed', 'error');
            }
        } catch (error) {
            addToast('Failed to test target: ' + (error.response?.data?.error || error.message), 'error');
        } finally { setFormTestingTarget(false); }
    };

    const updateField = (field, value) => setFormData({ ...formData, [field]: value });

    return (
        <div className={`backdrop-blur-sm border rounded-2xl p-8 modal-scale-in mb-8 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-xl'}`}>
            <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {editingId ? <Edit className="w-5 h-5 text-purple-500" /> : <Plus className="w-5 h-5 text-purple-500" />}
                {editingId ? 'Edit Network' : 'Create New Network'}
            </h2>
            <form onSubmit={onSubmit} className="space-y-6">
                {/* Basic Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Name</label>
                        <input type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                            placeholder="e.g., Production Database" required />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>IP Address</label>
                        <input type="text" value={formData.ip_address} onChange={(e) => updateField('ip_address', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                            placeholder="e.g., 192.168.1.100" required />
                    </div>
                </div>

                {/* Source Type Selection */}
                <div className="space-y-3">
                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Connection Protocol</label>
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                        {SOURCE_TYPES.map((type) => (
                            <button key={type.id} type="button" onClick={() => updateField('source_type', type.id)}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${formData.source_type === type.id
                                    ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                    : isDark ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}>
                                <type.icon className="w-6 h-6" />
                                <span className="font-semibold">{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Source Database Config */}
                {formData.source_type === 'database' && (
                    <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-md font-semibold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"><Database className="w-4 h-4" /></div>
                                Source Configuration
                            </h3>
                            <button type="button" onClick={handleFormTestSource} disabled={formTestingSource}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30' : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200'}`}>
                                {formTestingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Test Source
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Driver</label>
                                <select value={formData.db_driver} onChange={(e) => updateField('db_driver', e.target.value)} className={inputClass(isDark)}>
                                    <option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="sqlserver">SQL Server (MSSQL)</option><option value="oracle">Oracle</option>
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label>
                                <input type="text" value={formData.db_host} onChange={(e) => updateField('db_host', e.target.value)} className={inputClass(isDark)} placeholder="localhost" />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label>
                                <input type="text" value={formData.db_port} onChange={(e) => updateField('db_port', e.target.value)} className={inputClass(isDark)} placeholder="5432" />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
                                <input type="text" value={formData.db_user} onChange={(e) => updateField('db_user', e.target.value)} className={inputClass(isDark)} placeholder="postgres" />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                                <input type="password" value={formData.db_password} onChange={(e) => updateField('db_password', e.target.value)} className={inputClass(isDark)} placeholder="••••••••" />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Database Name</label>
                                <input type="text" value={formData.db_name} onChange={(e) => updateField('db_name', e.target.value)} className={inputClass(isDark)} placeholder="mydb" />
                            </div>
                        </div>
                    </div>
                )}

                {/* FTP/SFTP Config */}
                {(formData.source_type === 'ftp' || formData.source_type === 'sftp') && (
                    <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"><Server className="w-4 h-4" /></div>
                            {formData.source_type.toUpperCase()} Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label><input type="text" value={formData.ftp_host} onChange={(e) => updateField('ftp_host', e.target.value)} className={inputClass(isDark, 'amber')} placeholder="ftp.example.com" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label><input type="text" value={formData.ftp_port} onChange={(e) => updateField('ftp_port', e.target.value)} className={inputClass(isDark, 'amber')} placeholder={formData.source_type === 'sftp' ? '22' : '21'} /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label><input type="text" value={formData.ftp_user} onChange={(e) => updateField('ftp_user', e.target.value)} className={inputClass(isDark, 'amber')} placeholder="ftpuser" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label><input type="password" value={formData.ftp_password} onChange={(e) => updateField('ftp_password', e.target.value)} className={inputClass(isDark, 'amber')} placeholder="••••••••" /></div>
                            <div className="md:col-span-2"><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Remote Path</label><input type="text" value={formData.ftp_path} onChange={(e) => updateField('ftp_path', e.target.value)} className={inputClass(isDark, 'amber')} placeholder="/data/exports" /></div>
                            {formData.source_type === 'sftp' && (
                                <div className="md:col-span-2">
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>SSH Private Key (optional)</label>
                                    <div className="flex gap-2 mb-2">
                                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg cursor-pointer transition text-sm">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                            Upload Key File
                                            <input type="file" accept=".pem,.ppk,.key" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => updateField('ftp_private_key', event.target.result); reader.readAsText(file); } }} />
                                        </label>
                                        {formData.ftp_private_key && (<button type="button" onClick={() => updateField('ftp_private_key', '')} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition">Clear Key</button>)}
                                    </div>
                                    <textarea value={formData.ftp_private_key} onChange={(e) => updateField('ftp_private_key', e.target.value)} rows="4"
                                        className={`w-full px-4 py-2 border rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                        placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"} />
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Upload .pem/.key file. Note: .ppk must be converted to OpenSSH/PEM.</p>
                                </div>
                            )}
                            {formData.source_type === 'ftp' && (
                                <div className="md:col-span-2">
                                    <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        <input type="checkbox" checked={formData.ftp_passive} onChange={(e) => updateField('ftp_passive', e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" />
                                        Use Passive Mode (recommended)
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* API Config */}
                {formData.source_type === 'api' && (
                    <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                            <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"><Globe className="w-4 h-4" /></div>
                            REST API Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2"><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>API URL</label><input type="url" value={formData.api_url} onChange={(e) => updateField('api_url', e.target.value)} className={inputClass(isDark, 'cyan')} placeholder="https://api.example.com/data" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Method</label><select value={formData.api_method} onChange={(e) => updateField('api_method', e.target.value)} className={inputClass(isDark, 'cyan')}><option value="GET">GET</option><option value="POST">POST</option></select></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Authentication</label><select value={formData.api_auth_type} onChange={(e) => updateField('api_auth_type', e.target.value)} className={inputClass(isDark, 'cyan')}><option value="none">No Auth</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="api_key">API Key</option></select></div>
                            {formData.api_auth_type === 'api_key' && (<div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Header Name</label><input type="text" value={formData.api_auth_key} onChange={(e) => updateField('api_auth_key', e.target.value)} className={inputClass(isDark, 'cyan')} placeholder="X-API-Key" /></div>)}
                            {formData.api_auth_type !== 'none' && (<div className={formData.api_auth_type === 'api_key' ? '' : 'md:col-span-2'}><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formData.api_auth_type === 'bearer' ? 'Token' : formData.api_auth_type === 'basic' ? 'username:password' : 'API Key Value'}</label><input type="password" value={formData.api_auth_value} onChange={(e) => updateField('api_auth_value', e.target.value)} className={inputClass(isDark, 'cyan')} placeholder={formData.api_auth_type === 'basic' ? 'user:password' : 'Enter token/key...'} /></div>)}
                            <div className="md:col-span-2"><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Custom Headers <span className="text-slate-500">(JSON format, optional)</span></label><input type="text" value={formData.api_headers} onChange={(e) => updateField('api_headers', e.target.value)} className={`w-full px-4 py-2 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`} placeholder='{"Content-Type": "application/json"}' /></div>
                            {formData.api_method === 'POST' && (<div className="md:col-span-2"><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Request Body (JSON)</label><textarea value={formData.api_body} onChange={(e) => updateField('api_body', e.target.value)} rows="3" className={`w-full px-4 py-2 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`} placeholder='{"query": "value"}' /></div>)}
                        </div>
                    </div>
                )}

                {/* MongoDB Config */}
                {formData.source_type === 'mongodb' && (
                    <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400"><Database className="w-4 h-4" /></div>
                            MongoDB Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label><input type="text" value={formData.mongo_host} onChange={(e) => updateField('mongo_host', e.target.value)} className={inputClass(isDark, 'green')} placeholder="localhost" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label><input type="text" value={formData.mongo_port} onChange={(e) => updateField('mongo_port', e.target.value)} className={inputClass(isDark, 'green')} placeholder="27017" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label><input type="text" value={formData.mongo_user} onChange={(e) => updateField('mongo_user', e.target.value)} className={inputClass(isDark, 'green')} placeholder="admin" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label><input type="password" value={formData.mongo_password} onChange={(e) => updateField('mongo_password', e.target.value)} className={inputClass(isDark, 'green')} placeholder="••••••••" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Database</label><input type="text" value={formData.mongo_database} onChange={(e) => updateField('mongo_database', e.target.value)} className={inputClass(isDark, 'green')} placeholder="mydb" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Collection</label><input type="text" value={formData.mongo_collection} onChange={(e) => updateField('mongo_collection', e.target.value)} className={inputClass(isDark, 'green')} placeholder="users" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Auth Database</label><input type="text" value={formData.mongo_auth_db} onChange={(e) => updateField('mongo_auth_db', e.target.value)} className={inputClass(isDark, 'green')} placeholder="admin" /></div>
                        </div>
                    </div>
                )}

                {/* Redis Config */}
                {formData.source_type === 'redis' && (
                    <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"><Database className="w-4 h-4" /></div>
                            Redis Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Host</label><input type="text" value={formData.redis_host} onChange={(e) => updateField('redis_host', e.target.value)} className={inputClass(isDark, 'red')} placeholder="localhost" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Port</label><input type="text" value={formData.redis_port} onChange={(e) => updateField('redis_port', e.target.value)} className={inputClass(isDark, 'red')} placeholder="6379" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label><input type="password" value={formData.redis_password} onChange={(e) => updateField('redis_password', e.target.value)} className={inputClass(isDark, 'red')} placeholder="Optional" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Database Number (0-15)</label><input type="number" min="0" max="15" value={formData.redis_db} onChange={(e) => updateField('redis_db', parseInt(e.target.value) || 0)} className={inputClass(isDark, 'red')} placeholder="0" /></div>
                            <div className="md:col-span-2"><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Key Pattern</label><input type="text" value={formData.redis_pattern} onChange={(e) => updateField('redis_pattern', e.target.value)} className={inputClass(isDark, 'red')} placeholder="user:* (or * for all keys)" /><p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pattern to scan keys (e.g., "user:*", "session:*", or "*" for all)</p></div>
                        </div>
                    </div>
                )}

                {/* MinIO/S3 Config */}
                {formData.source_type === 'minio' && (
                    <div className={`border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`text-md font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                            <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"><HardDrive className="w-4 h-4" /></div>
                            MinIO/S3 Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2"><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Endpoint</label><input type="text" value={formData.minio_endpoint} onChange={(e) => updateField('minio_endpoint', e.target.value)} className={inputClass(isDark, 'orange')} placeholder="minio.example.com:9000 or s3.amazonaws.com" /><p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MinIO server endpoint (without http/https prefix)</p></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Access Key ID</label><input type="text" value={formData.minio_access_key} onChange={(e) => updateField('minio_access_key', e.target.value)} className={inputClass(isDark, 'orange')} placeholder="minioadmin" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Secret Access Key</label><input type="password" value={formData.minio_secret_key} onChange={(e) => updateField('minio_secret_key', e.target.value)} className={inputClass(isDark, 'orange')} placeholder="••••••••" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Bucket Name</label><input type="text" value={formData.minio_bucket} onChange={(e) => updateField('minio_bucket', e.target.value)} className={inputClass(isDark, 'orange')} placeholder="my-bucket" /></div>
                            <div><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Region</label><input type="text" value={formData.minio_region} onChange={(e) => updateField('minio_region', e.target.value)} className={inputClass(isDark, 'orange')} placeholder="us-east-1" /></div>
                            <div className="md:col-span-2"><label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Object Path/Prefix</label><input type="text" value={formData.minio_object_path} onChange={(e) => updateField('minio_object_path', e.target.value)} className={inputClass(isDark, 'orange')} placeholder="data/exports/ or data.csv" /><p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Path prefix to list objects or specific object key to read</p></div>
                            <div className="md:col-span-2"><label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}><input type="checkbox" checked={formData.minio_use_ssl} onChange={(e) => updateField('minio_use_ssl', e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500" />Use SSL/TLS (HTTPS)</label><p className={`text-xs mt-1 ml-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Enable for production MinIO or AWS S3</p></div>
                        </div>
                    </div>
                )}

                {/* ===== TARGET CONFIGURATION ===== */}
                <div className={`border-t-2 border-dashed pt-6 mt-6 ${isDark ? 'border-purple-500/30' : 'border-purple-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"><ArrowLeftRight className="w-5 h-5" /></div>
                            TARGET Configuration
                        </h3>
                        <button type="button" onClick={handleFormTestTarget} disabled={formTestingTarget}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200'}`}>
                            {formTestingTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Test Target
                        </button>
                    </div>

                    {/* Target Type Selection */}
                    <div className="space-y-3 mb-6">
                        <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Target Type</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {TARGET_TYPES.map((type) => (
                                <button key={type.id} type="button" onClick={() => updateField('target_source_type', type.id)}
                                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${formData.target_source_type === type.id
                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : isDark ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}>
                                    <type.icon className="w-5 h-5" />
                                    <span className="text-sm font-semibold">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Database */}
                    {formData.target_source_type === 'database' && (
                        <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
                            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}><Database className="w-4 h-4" /> Target Database</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Driver</label><select value={formData.target_db_driver} onChange={(e) => updateField('target_db_driver', e.target.value)} className={smallInputClass(isDark)}><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="sqlserver">SQL Server</option><option value="oracle">Oracle</option></select></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Host</label><input type="text" value={formData.target_db_host} onChange={(e) => updateField('target_db_host', e.target.value)} className={smallInputClass(isDark)} placeholder="Target host" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Port</label><input type="text" value={formData.target_db_port} onChange={(e) => updateField('target_db_port', e.target.value)} className={smallInputClass(isDark)} placeholder="5432" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Username</label><input type="text" value={formData.target_db_user} onChange={(e) => updateField('target_db_user', e.target.value)} className={smallInputClass(isDark)} placeholder="postgres" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Password</label><input type="password" value={formData.target_db_password} onChange={(e) => updateField('target_db_password', e.target.value)} className={smallInputClass(isDark)} placeholder="••••••••" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Database Name</label><input type="text" value={formData.target_db_name} onChange={(e) => updateField('target_db_name', e.target.value)} className={smallInputClass(isDark)} placeholder="targetdb" /></div>
                            </div>
                        </div>
                    )}

                    {/* Target FTP/SFTP */}
                    {(formData.target_source_type === 'ftp' || formData.target_source_type === 'sftp') && (
                        <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
                            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}><Folder className="w-4 h-4" /> Target {formData.target_source_type.toUpperCase()}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Host</label><input type="text" value={formData.target_ftp_host} onChange={(e) => updateField('target_ftp_host', e.target.value)} className={smallInputClass(isDark)} placeholder="ftp.example.com" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Port</label><input type="text" value={formData.target_ftp_port} onChange={(e) => updateField('target_ftp_port', e.target.value)} className={smallInputClass(isDark)} placeholder={formData.target_source_type === 'sftp' ? '22' : '21'} /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Username</label><input type="text" value={formData.target_ftp_user} onChange={(e) => updateField('target_ftp_user', e.target.value)} className={smallInputClass(isDark)} placeholder="ftpuser" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Password</label><input type="password" value={formData.target_ftp_password} onChange={(e) => updateField('target_ftp_password', e.target.value)} className={smallInputClass(isDark)} placeholder="••••••••" /></div>
                                <div className="md:col-span-2"><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Remote Path</label><input type="text" value={formData.target_ftp_path} onChange={(e) => updateField('target_ftp_path', e.target.value)} className={smallInputClass(isDark)} placeholder="/upload/data" /></div>
                            </div>
                        </div>
                    )}

                    {/* Target API */}
                    {formData.target_source_type === 'api' && (
                        <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
                            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}><Globe className="w-4 h-4" /> Target API Endpoint</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2"><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>API URL</label><input type="text" value={formData.target_api_url} onChange={(e) => updateField('target_api_url', e.target.value)} className={smallInputClass(isDark)} placeholder="https://api.example.com/data" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Method</label><select value={formData.target_api_method} onChange={(e) => updateField('target_api_method', e.target.value)} className={smallInputClass(isDark)}><option value="POST">POST</option><option value="PUT">PUT</option><option value="PATCH">PATCH</option></select></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Auth Type</label><select value={formData.target_api_auth_type} onChange={(e) => updateField('target_api_auth_type', e.target.value)} className={smallInputClass(isDark)}><option value="none">None</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="api_key">API Key</option></select></div>
                                {formData.target_api_auth_type !== 'none' && (<div className="md:col-span-2"><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Auth Value</label><input type="password" value={formData.target_api_auth_value} onChange={(e) => updateField('target_api_auth_value', e.target.value)} className={smallInputClass(isDark)} placeholder="Token or API key" /></div>)}
                            </div>
                        </div>
                    )}

                    {/* Target MinIO/S3 */}
                    {formData.target_source_type === 'minio' && (
                        <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
                            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}><HardDrive className="w-4 h-4" /> Target MinIO/S3 Bucket</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2"><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Endpoint</label><input type="text" value={formData.target_minio_endpoint} onChange={(e) => updateField('target_minio_endpoint', e.target.value)} className={smallInputClass(isDark)} placeholder="minio.example.com:9000" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Access Key ID</label><input type="text" value={formData.target_minio_access_key} onChange={(e) => updateField('target_minio_access_key', e.target.value)} className={smallInputClass(isDark)} placeholder="minioadmin" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Secret Access Key</label><input type="password" value={formData.target_minio_secret_key} onChange={(e) => updateField('target_minio_secret_key', e.target.value)} className={smallInputClass(isDark)} placeholder="••••••••" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bucket Name</label><input type="text" value={formData.target_minio_bucket} onChange={(e) => updateField('target_minio_bucket', e.target.value)} className={smallInputClass(isDark)} placeholder="my-bucket" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Region</label><input type="text" value={formData.target_minio_region} onChange={(e) => updateField('target_minio_region', e.target.value)} className={smallInputClass(isDark)} placeholder="us-east-1" /></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Object Path/Key</label><input type="text" value={formData.target_minio_object_path} onChange={(e) => updateField('target_minio_object_path', e.target.value)} className={smallInputClass(isDark)} placeholder="exports/data.csv" /><p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Object key to write (extension auto-added based on format)</p></div>
                                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Export Format</label><select value={formData.target_minio_export_format} onChange={(e) => updateField('target_minio_export_format', e.target.value)} className={smallInputClass(isDark)}><option value="csv">CSV</option><option value="json">JSON</option><option value="parquet">Parquet (JSON Lines)</option></select></div>
                                <div className="md:col-span-2"><label className={`flex items-center gap-2 text-sm cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}><input type="checkbox" checked={formData.target_minio_use_ssl} onChange={(e) => updateField('target_minio_use_ssl', e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500" />Use SSL/TLS (HTTPS)</label></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button type="submit" disabled={isSubmitting}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition disabled:opacity-50 shadow-lg shadow-purple-500/20 min-w-[120px]">
                        {isSubmitting ? 'Saving...' : (editingId ? 'Update Network' : 'Create Network')}
                    </button>
                    <button type="button" onClick={onCancel}
                        className={`px-6 py-2.5 rounded-xl transition ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
