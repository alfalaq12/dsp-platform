import { useEffect, useState } from 'react';
import { getTargetDBConfig, updateTargetDBConfig, testTargetDBConnection } from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';

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

    // Theme-aware classes
    const cardClass = isDark
        ? 'bg-slate-800/50 border-slate-700'
        : 'bg-white border-slate-200 shadow-sm';
    const inputClass = isDark
        ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400'
        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
    const labelClass = isDark ? 'text-slate-300' : 'text-slate-700 font-medium';
    const textClass = isDark ? 'text-white' : 'text-slate-900';
    const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            <div className="flex items-center justify-between">
                <h1 className={`text-2xl font-bold ${textClass}`}>Settings</h1>
            </div>

            {/* Target Database Configuration */}
            <div className={`rounded-xl p-6 border ${cardClass}`}>
                <h2 className={`text-lg font-semibold ${textClass} mb-4 flex items-center gap-2`}>
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    Target Database Configuration
                </h2>
                <p className={`text-sm mb-6 ${mutedClass}`}>
                    Configure the database where synced data will be stored.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Driver */}
                        <div>
                            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Database Driver</label>
                            <select
                                name="driver"
                                value={config.driver}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClass}`}
                            >
                                <option value="postgres">PostgreSQL</option>
                                <option value="mysql">MySQL</option>
                            </select>
                        </div>

                        {/* SSL Mode */}
                        <div>
                            <label className={`block text-sm font-medium ${labelClass} mb-1`}>SSL Mode</label>
                            <select
                                name="sslmode"
                                value={config.sslmode}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClass}`}
                            >
                                <option value="disable">Disable</option>
                                <option value="require">Require</option>
                                <option value="verify-full">Verify Full</option>
                            </select>
                        </div>

                        {/* Host */}
                        <div>
                            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Host</label>
                            <input
                                type="text"
                                name="host"
                                value={config.host}
                                onChange={handleChange}
                                placeholder="localhost or IP address"
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClass}`}
                            />
                        </div>

                        {/* Port */}
                        <div>
                            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Port</label>
                            <input
                                type="text"
                                name="port"
                                value={config.port}
                                onChange={handleChange}
                                placeholder="5432"
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClass}`}
                            />
                        </div>

                        {/* User */}
                        <div>
                            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Username</label>
                            <input
                                type="text"
                                name="user"
                                value={config.user}
                                onChange={handleChange}
                                placeholder="postgres"
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClass}`}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={config.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClass}`}
                            />
                        </div>

                        {/* Database Name */}
                        <div className="md:col-span-2">
                            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Database Name</label>
                            <input
                                type="text"
                                name="db_name"
                                value={config.db_name}
                                onChange={handleChange}
                                placeholder="dsp_sync"
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClass}`}
                            />
                        </div>
                    </div>

                    <div className={`flex justify-between items-center pt-4 border-t mt-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={isTesting}
                            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 ${isDark ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                }`}
                        >
                            {isTesting ? (
                                <>
                                    <div className="spinner w-4 h-4"></div>
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Test Connection
                                </>
                            )}
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <div className="spinner w-4 h-4"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Save Configuration
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Test Result */}
                {testResult && (
                    <div className={`mt-4 p-4 rounded-lg border ${testResult.success
                        ? isDark ? 'bg-emerald-900/30 border-emerald-700' : 'bg-emerald-50 border-emerald-200'
                        : isDark ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                            {testResult.success ? (
                                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <span className={`font-semibold ${testResult.success
                                ? isDark ? 'text-emerald-300' : 'text-emerald-700'
                                : isDark ? 'text-red-300' : 'text-red-700'
                                }`}>
                                {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                            </span>
                        </div>
                        {testResult.success ? (
                            <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                <p>Host: {testResult.host}:{testResult.port}</p>
                                <p>Database: {testResult.database}</p>
                            </div>
                        ) : (
                            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{testResult.error}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className={`rounded-xl p-4 border ${isDark ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h3 className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Cara Kerja</h3>
                        <p className={`text-sm mt-1 ${isDark ? 'text-blue-200/70' : 'text-blue-600'}`}>
                            Data dari database sumber akan diambil oleh agent dan dikirim ke Master server, kemudian dimasukkan ke database target yang dikonfigurasi di atas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
