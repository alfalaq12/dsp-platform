import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// Toast Context for global use
export const useToast = () => {
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'success', duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return { toasts, addToast, removeToast };
};

// Toast Container Component
export function ToastContainer({ toasts, removeToast }) {
    const { isDark } = useTheme();

    if (!toasts?.length) return null;

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />;
            case 'error': return <XCircle className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />;
            case 'warning': return <AlertCircle className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />;
            default: return <AlertCircle className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />;
        }
    };

    const getStyles = (type) => {
        if (isDark) {
            switch (type) {
                case 'success': return 'bg-emerald-500/10 border-emerald-500/50 text-emerald-100';
                case 'error': return 'bg-red-500/10 border-red-500/50 text-red-100';
                case 'warning': return 'bg-amber-500/10 border-amber-500/50 text-amber-100';
                default: return 'bg-blue-500/10 border-blue-500/50 text-blue-100';
            }
        } else {
            switch (type) {
                case 'success': return 'bg-white border-emerald-200 text-emerald-800 shadow-lg shadow-emerald-500/10';
                case 'error': return 'bg-white border-red-200 text-red-800 shadow-lg shadow-red-500/10';
                case 'warning': return 'bg-white border-amber-200 text-amber-800 shadow-lg shadow-amber-500/10';
                default: return 'bg-white border-blue-200 text-blue-800 shadow-lg shadow-blue-500/10';
            }
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[100] space-y-3">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`toast-slide-in flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md min-w-[300px] max-w-[400px] ${getStyles(toast.type)}`}
                >
                    {getIcon(toast.type)}
                    <span className="flex-1 text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className={`p-1 rounded-lg transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

// Confirmation Modal Component
// Confirmation Modal Component
export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', isLoading = false, variant = 'danger', showCancel = true }) {
    const { isDark } = useTheme();
    if (!isOpen) return null;

    const getStyles = () => {
        switch (variant) {
            case 'warning':
                return {
                    iconBg: 'bg-amber-500/20',
                    iconColor: 'text-amber-400',
                    btnBg: 'bg-amber-600 hover:bg-amber-700',
                    icon: <AlertCircle className="w-6 h-6 text-amber-400" />
                };
            case 'info':
                return {
                    iconBg: 'bg-blue-500/20',
                    iconColor: 'text-blue-400',
                    btnBg: 'bg-blue-600 hover:bg-blue-700',
                    icon: <AlertCircle className="w-6 h-6 text-blue-400" />
                };
            case 'danger':
            default:
                return {
                    iconBg: 'bg-red-500/20',
                    iconColor: 'text-red-400',
                    btnBg: 'bg-red-600 hover:bg-red-700',
                    icon: <AlertCircle className="w-6 h-6 text-red-400" />
                };
        }
    };

    const styles = getStyles();

    return createPortal(
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className={`rounded-2xl w-full max-w-md p-6 modal-scale-in border ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-2xl'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className={`p-3 rounded-xl ${styles.iconBg}`}>
                        {styles.icon}
                    </div>
                    <div>
                        <h3 className={`text-lg font-semibold ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{title}</h3>
                        <p className={`text-sm ${isDark ? 'text-panda-text-muted' : 'text-slate-500'}`}>{message}</p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    {showCancel && (
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className={`flex-1 px-4 py-2.5 rounded-xl transition disabled:opacity-50 ${isDark ? 'bg-panda-dark-300 hover:bg-panda-dark-400 text-panda-text' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-2.5 text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 ${styles.btnBg}`}
                    >
                        {isLoading && <span className="spinner-border"></span>}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// View Detail Modal Component
export function ViewModal({ isOpen, onClose, title, children }) {
    const { isDark } = useTheme();
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className={`rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden modal-scale-in border ${isDark ? 'bg-panda-dark-100 border-panda-dark-300' : 'bg-white border-slate-200 shadow-2xl'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-panda-dark-300' : 'border-slate-100'}`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-panda-text' : 'text-slate-900'}`}>{title}</h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-panda-dark-300 text-panda-text-muted' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default { useToast, ToastContainer, ConfirmModal, ViewModal };
