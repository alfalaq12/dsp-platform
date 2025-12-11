import { useEffect, useState } from 'react';
import { getTargetDBConfig, updateTargetDBConfig, testTargetDBConnection } from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';

function Settings() {
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
                <h1 className="text-2xl font-bold text-white">Settings</h1>
            </div>

            {/* Target Database Configuration */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    Target Database Configuration
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                    Configure the database where synced data will be stored. This is the central database on your Master server.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Driver */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Database Driver</label>
                            <select
                                name="driver"
                                value={config.driver}
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="postgres">PostgreSQL</option>
                                <option value="mysql">MySQL</option>
                            </select>
                        </div>

                        {/* SSL Mode */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">SSL Mode</label>
                            <select
                                name="sslmode"
                                value={config.sslmode}
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="disable">Disable</option>
                                <option value="require">Require</option>
                                <option value="verify-full">Verify Full</option>
                            </select>
                        </div>

                        {/* Host */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Host</label>
                            <input
                                type="text"
                                name="host"
                                value={config.host}
                                onChange={handleChange}
                                placeholder="localhost or IP address"
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>

                        {/* Port */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Port</label>
                            <input
                                type="text"
                                name="port"
                                value={config.port}
                                onChange={handleChange}
                                placeholder="5432"
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>

                        {/* User */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                            <input
                                type="text"
                                name="user"
                                value={config.user}
                                onChange={handleChange}
                                placeholder="postgres"
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={config.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>

                        {/* Database Name */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Database Name</label>
                            <input
                                type="text"
                                name="db_name"
                                value={config.db_name}
                                onChange={handleChange}
                                placeholder="dsp_sync"
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-700 mt-4">
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={isTesting}
                            className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
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
                            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
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
                    <div className={`mt-4 p-4 rounded-lg border ${testResult.success ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-red-900/30 border-red-700/50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {testResult.success ? (
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <span className={`font-semibold ${testResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                                {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                            </span>
                            {testResult.duration && (
                                <span className="text-gray-400 text-sm">({testResult.duration}ms)</span>
                            )}
                        </div>
                        {testResult.success ? (
                            <div className="text-sm text-gray-300 space-y-1">
                                <p><span className="text-gray-500">Host:</span> {testResult.host}:{testResult.port}</p>
                                <p><span className="text-gray-500">Database:</span> {testResult.database}</p>
                                {testResult.version && (
                                    <p className="text-xs text-gray-500 break-all">{testResult.version}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-red-300">{testResult.error}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h3 className="text-blue-300 font-medium">How it works</h3>
                        <p className="text-blue-200/70 text-sm mt-1">
                            Cara kerjanya
                            Saat Anda menjalankan tugas sinkronisasi, data dari basis data sumber penyewa diambil oleh agen dan dikirim ke server Master. Master kemudian memasukkan data ini ke dalam basis data target yang dikonfigurasi di atas. Setiap Jaringan (agen) dapat memiliki konfigurasi basis data sumbernya sendiri.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
