import { useEffect, useState } from 'react';
import { getTargetDBConfig, updateTargetDBConfig, testTargetDBConnection } from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { Shield, Database, Save, RefreshCw, CheckCircle, Server, AlertCircle, Info, Play, Settings as SettingsIcon } from 'lucide-react';

function Settings() {
    const { isDark } = useTheme();
    const { toasts, addToast, removeToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [config, setConfig] = useState({
        driver: 'postgres',
        host: '',
        port: '5432',
        user: '',
        password: '',
        db_name: '',
        sslmode: 'disable'
    });

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setIsLoading(true);
            const response = await getTargetDBConfig();
            setConfig({
                driver: response.data.target_db_driver || 'postgres',
                host: response.data.target_db_host || '',
                port: response.data.target_db_port || '5432',
                user: response.data.target_db_user || '',
                password: response.data.target_db_password || '',
                db_name: response.data.target_db_name || '',
                sslmode: response.data.target_db_sslmode || 'disable'
            });
        } catch (error) {
            console.error('Failed to load config:', error);
            addToast('Failed to load settings', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            await updateTargetDBConfig(config);
            addToast('Target database configuration saved!', 'success');
        } catch (error) {
            console.error('Failed to save config:', error);
            addToast('Failed to save settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleTest = async () => {
        if (!config.host) {
            addToast('Please enter host address first', 'warning');
            return;
        }
        try {
            setIsTesting(true);
            setTestResult(null);
            const response = await testTargetDBConnection(config);
            setTestResult(response.data);
            if (response.data.success) {
                addToast('Connection successful!', 'success');
            } else {
                addToast('Connection failed: ' + response.data.error, 'error');
            }
        } catch (error) {
            console.error('Test failed:', error);
            setTestResult({ success: false, error: error.message });
            addToast('Test failed: ' + error.message, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    // Unified Input Styles
    const inputClass = `w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark
        ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500'
        : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
        }`;

    const labelClass = `block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Premium Page Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 border-slate-200/60 shadow-lg'}`}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-teal-500/10 rounded-full blur-3xl"></div>

                <div className="relative">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700'}`}>
                        <SettingsIcon className="w-3 h-3" />
                        System Administration
                    </div>
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Platform Settings</h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Configure global system preferences and database connections</p>
                </div>
            </div>

            {/* Target Database Configuration */}
            <div className={`rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                <div className={`px-8 py-6 border-b flex items-center gap-3 ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/80'}`}>
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Target Database Configuration
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Configure where synced data will be stored
                        </p>
                    </div>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Driver */}
                            <div>
                                <label className={labelClass}>Database Driver</label>
                                <div className="relative">
                                    <Server className={`absolute left-4 top-3.5 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                    <select
                                        name="driver"
                                        value={config.driver}
                                        onChange={handleChange}
                                        className={`${inputClass} pl-12 appearance-none`}
                                    >
                                        <option value="postgres">PostgreSQL</option>
                                        <option value="mysql">MySQL</option>
                                        <option value="sqlserver">SQL Server (MSSQL)</option>
                                        <option value="oracle">Oracle</option>
                                    </select>
                                </div>
                            </div>

                            {/* SSL Mode */}
                            <div>
                                <label className={labelClass}>SSL Mode</label>
                                <div className="relative">
                                    <Shield className={`absolute left-4 top-3.5 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                    <select
                                        name="sslmode"
                                        value={config.sslmode}
                                        onChange={handleChange}
                                        className={`${inputClass} pl-12 appearance-none`}
                                    >
                                        <option value="disable">Disable</option>
                                        <option value="require">Require</option>
                                        <option value="verify-full">Verify Full</option>
                                    </select>
                                </div>
                            </div>

                            {/* Host */}
                            <div>
                                <label className={labelClass}>Host</label>
                                <input
                                    type="text"
                                    name="host"
                                    value={config.host}
                                    onChange={handleChange}
                                    placeholder="localhost or IP address"
                                    className={inputClass}
                                />
                            </div>

                            {/* Port */}
                            <div>
                                <label className={labelClass}>Port</label>
                                <input
                                    type="text"
                                    name="port"
                                    value={config.port}
                                    onChange={handleChange}
                                    placeholder="5432"
                                    className={inputClass}
                                />
                            </div>

                            {/* User */}
                            <div>
                                <label className={labelClass}>Username</label>
                                <input
                                    type="text"
                                    name="user"
                                    value={config.user}
                                    onChange={handleChange}
                                    placeholder="postgres"
                                    className={inputClass}
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className={labelClass}>Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={config.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className={inputClass}
                                />
                            </div>

                            {/* Database Name */}
                            <div className="md:col-span-2">
                                <label className={labelClass}>Database Name</label>
                                <input
                                    type="text"
                                    name="db_name"
                                    value={config.db_name}
                                    onChange={handleChange}
                                    placeholder="dsp_sync"
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        {/* Test Result Display */}
                        {testResult && (
                            <div className={`p-4 rounded-xl border flex items-start gap-3 modal-scale-in ${testResult.success
                                ? isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                <div className={`p-1.5 rounded-full mt-0.5 ${testResult.success
                                    ? isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
                                    : isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                                    {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold flex items-center gap-2">
                                        {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                                    </h4>
                                    {testResult.success && (
                                        <div className={`text-sm mt-1 opacity-80 font-mono`}>
                                            <p>Host: {testResult.host}:{testResult.port}</p>
                                            <p>Database: {testResult.database}</p>
                                        </div>
                                    )}
                                    {!testResult.success && (
                                        <p className="text-sm mt-1 opacity-90">{testResult.error}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className={`flex flex-col sm:flex-row justify-end items-center gap-4 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <button
                                type="button"
                                onClick={handleTest}
                                disabled={isTesting}
                                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                            >
                                {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                {isTesting ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Info Box */}
            <div className={`rounded-2xl p-6 border ${isDark ? 'bg-blue-900/10 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>Cara Kerja</h3>
                        <p className={`text-base leading-relaxed ${isDark ? 'text-blue-200/70' : 'text-blue-700/80'}`}>
                            Data dari database sumber akan diambil oleh agent dan dikirim ke Master server, kemudian dimasukkan ke database target yang dikonfigurasi di atas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
