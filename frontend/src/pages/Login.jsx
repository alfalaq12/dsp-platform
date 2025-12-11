import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { login } from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';

function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { toasts, addToast, removeToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await login(formData);
            // Token is now handled by HttpOnly cookie
            localStorage.setItem('username', response.data.username);
            localStorage.setItem('role', response.data.role || 'viewer'); // Default to viewer if missing
            localStorage.setItem('lastActivity', Date.now().toString());
            addToast('Login successful!', 'success');
            setTimeout(() => navigate('/'), 500);
        } catch (err) {
            addToast(err.response?.data?.error || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-panda-dark flex">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Left Side - Login Form */}
            <div className="w-full lg:w-1/2 flex flex-col p-6 sm:p-8 lg:p-12">
                {/* Login Form */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-md">
                        <div className="mb-8">
                            <h2 className="text-3xl sm:text-4xl font-bold text-gold-gradient italic mb-3">
                                WELCOME BACK!
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-panda-text mb-3">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-6 py-4 panda-input text-panda-text placeholder-panda-text-dark"
                                    placeholder="example@gmail.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-panda-text mb-3">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-6 py-4 panda-input text-panda-text placeholder-panda-text-dark pr-12"
                                        placeholder="••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-panda-text-muted hover:text-panda-gold transition"
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
                                        className="w-4 h-4 rounded border-panda-gold-muted bg-panda-dark-100 text-panda-gold focus:ring-panda-gold focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-panda-text-muted">Remember me</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 panda-btn text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Right Side - Decorative */}
            <div className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute inset-0 bg-gradient-to-br from-panda-dark via-panda-dark-100 to-panda-dark"></div>

                {/* Yellow circle background */}
                <div className="absolute w-80 h-80 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 opacity-90 blur-sm"></div>

                {/* Decorative content */}
                <div className="relative z-10 text-center">
                    <div className="w-72 h-72 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-2xl">
                        <div className="text-center">
                            <div className="text-6xl mb-2">🔐</div>
                            <p className="text-panda-dark font-bold text-xl">DSP Platform</p>
                            <p className="text-panda-dark-300 text-sm">Data Sync</p>
                        </div>
                    </div>
                </div>

                {/* DSP text icons */}
                <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                    {['D', 'S', 'P'].map((letter, i) => (
                        <div
                            key={letter}
                            className="w-10 h-10 rounded-full border-2 border-panda-gold flex items-center justify-center text-panda-gold hover:bg-panda-gold hover:text-panda-dark transition cursor-pointer font-bold"
                        >
                            {letter}
                        </div>
                    ))}
                </div>

                {/* Decorative lines */}
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                        d="M0,50 Q25,30 50,50 T100,50"
                        stroke="#CCA700"
                        strokeWidth="0.2"
                        fill="none"
                    />
                    <path
                        d="M0,60 Q25,40 50,60 T100,60"
                        stroke="#CCA700"
                        strokeWidth="0.2"
                        fill="none"
                    />
                    <path
                        d="M0,70 Q25,50 50,70 T100,70"
                        stroke="#CCA700"
                        strokeWidth="0.2"
                        fill="none"
                    />
                </svg>
            </div>
        </div>
    );
}

export default Login;
