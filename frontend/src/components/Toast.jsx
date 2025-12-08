import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

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
    if (!toasts?.length) return null;

    const getIcon = (type) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
            case 'error': return <XCircle className="w-5 h-5 text-red-400" />;
            case 'warning': return <AlertCircle className="w-5 h-5 text-amber-400" />;
            default: return <AlertCircle className="w-5 h-5 text-blue-400" />;
        }
    };

    const getStyles = (type) => {
        switch (type) {
            case 'success': return 'bg-emerald-500/10 border-emerald-500/50 text-emerald-100';
            case 'error': return 'bg-red-500/10 border-red-500/50 text-red-100';
            case 'warning': return 'bg-amber-500/10 border-amber-500/50 text-amber-100';
            default: return 'bg-blue-500/10 border-blue-500/50 text-blue-100';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[100] space-y-3">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`toast-slide-in flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl min-w-[300px] max-w-[400px] ${getStyles(toast.type)}`}
                >
                    {getIcon(toast.type)}
                    <span className="flex-1 text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="p-1 hover:bg-white/10 rounded-lg transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

// Confirmation Modal Component
export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', isLoading = false }) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl w-full max-w-md p-6 modal-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-red-500/20 rounded-xl">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-panda-text">{title}</h3>
                        <p className="text-sm text-panda-text-muted">{message}</p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-panda-dark-300 hover:bg-panda-dark-400 text-panda-text rounded-xl transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading && <span className="spinner-border"></span>}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

// View Detail Modal Component
export function ViewModal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-panda-dark-100 border border-panda-dark-300 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden modal-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-panda-dark-300">
                    <h2 className="text-xl font-bold text-panda-text">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-panda-dark-300 rounded-lg transition"
                    >
                        <X className="w-5 h-5 text-panda-text-muted" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default { useToast, ToastContainer, ConfirmModal, ViewModal };
