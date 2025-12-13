import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldCheck, Activity, Server, AlertCircle } from 'lucide-react';
import { login } from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';

function Login() {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { toasts, addToast, removeToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await login(formData);
            // Token is now handled by HttpOnly cookie
            localStorage.setItem('username', response.data.username);
            localStorage.setItem('role', response.data.role || 'viewer'); // Default to viewer if missing
            localStorage.setItem('lastActivity', Date.now().toString());
            addToast('Login successful!', 'success');
            setTimeout(() => navigate('/'), 500);
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Login failed';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Left Side - Branding & Visuals */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 to-blue-900 relative overflow-hidden text-white items-center justify-center p-12">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

                <div className="relative z-10 max-w-lg">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="p-3 bg-blue-500/20 rounded-xl backdrop-blur-sm border border-blue-400/30">
                            <Activity className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">DSP Platform</h1>
                    </div>

                    <h2 className="text-4xl font-bold mb-6 leading-tight">
                        Secure Data Synchronization for <span className="text-blue-400">Government Enterprise</span>
                    </h2>

                    <p className="text-slate-300 text-lg mb-10 leading-relaxed">
                        Centralized management for your data pipelines. Monitor, sync, and secure your infrastructure with real-time analytics.
                    </p>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <ShieldCheck className="w-6 h-6 text-emerald-400 mb-3" />
                            <h3 className="font-semibold mb-1">Enterprise Security</h3>
                            <p className="text-sm text-slate-400">Role-based access control and encrypted connections.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <Server className="w-6 h-6 text-purple-400 mb-3" />
                            <h3 className="font-semibold mb-1">Multi-Source Sync</h3>
                            <p className="text-sm text-slate-400">Seamless integration with PostgreSQL, MySQL, and APIs.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-24">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden flex justify-center mb-6">
                            <div className="p-3 bg-blue-600 rounded-xl">
                                <Activity className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900">Welcome Back</h2>
                        <p className="mt-2 text-slate-600">Please sign in to your account to continue.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 mt-8">
                        {/* Error Alert */}
                        {error && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border animate-shake ${isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-600'
                                }`}>
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Username
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all group-hover:border-blue-300 ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200'}`}
                                    placeholder="Enter your username"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12 group-hover:border-blue-300 ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200'}`}
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-sm text-slate-600 selection:bg-none">Remember me</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <Lock className="w-4 h-4" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-slate-50 text-slate-500">Secure Access</span>
                        </div>
                    </div>

                    <p className="text-center text-sm text-slate-500">
                        Restricted area. Authorized personnel only.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
