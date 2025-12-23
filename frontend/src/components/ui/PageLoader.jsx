import { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * PageLoader - Full page loading component with smooth animations
 * Used as Suspense fallback for lazy-loaded pages
 * Supports both light and dark themes
 */
const PageLoader = () => {
    const { isDark } = useTheme();
    const [progress, setProgress] = useState(0);
    const [dots, setDots] = useState('');

    // Smooth progress animation
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return prev; // Cap at 90% until actual load
                return prev + Math.random() * 10;
            });
        }, 300);

        return () => clearInterval(interval);
    }, []);

    // Animated dots
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md ${isDark
                ? 'bg-slate-900/80'
                : 'bg-white/80'
            }`}>
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse ${isDark ? 'bg-blue-500/10' : 'bg-blue-400/20'
                    }`} style={{ animationDuration: '3s' }} />
                <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse ${isDark ? 'bg-purple-500/10' : 'bg-purple-400/15'
                    }`} style={{ animationDuration: '4s', animationDelay: '1s' }} />
            </div>

            {/* Main loader container */}
            <div className="relative flex flex-col items-center gap-8 p-8">
                {/* Logo / Icon with smooth pulse */}
                <div className="relative">
                    {/* Outer ring - slow rotation */}
                    <div className={`w-24 h-24 rounded-full border-4 border-t-blue-500 border-r-blue-400/50 ${isDark ? 'border-slate-700/50' : 'border-slate-300/50'
                        }`} style={{ animation: 'spin 2s linear infinite' }} />

                    {/* Inner ring - reverse rotation */}
                    <div className={`absolute inset-2 rounded-full border-4 border-b-purple-500 border-l-purple-400/50 ${isDark ? 'border-slate-700/30' : 'border-slate-300/30'
                        }`} style={{ animation: 'spin 3s linear infinite reverse' }} />

                    {/* Center dot with glow */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg shadow-blue-500/50"
                            style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                    </div>
                </div>

                {/* Text */}
                <div className="text-center">
                    <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        Memuat<span className="inline-block w-8 text-left">{dots}</span>
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Mohon tunggu sebentar
                    </p>
                </div>

                {/* Progress bar */}
                <div className={`w-64 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700/50' : 'bg-slate-200'
                    }`}>
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
                        style={{
                            width: `${progress}%`,
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 2s linear infinite'
                        }}
                    />
                </div>
            </div>

            {/* Custom keyframes */}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
};

/**
 * CardSkeleton - Skeleton placeholder for dashboard cards
 */
const CardSkeleton = ({ count = 4 }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-6">
                    <div className="h-4 bg-slate-700 rounded w-1/2 mb-4 animate-pulse"
                        style={{ animationDelay: `${i * 150}ms`, animationDuration: '1.5s' }} />
                    <div className="h-8 bg-slate-700 rounded w-3/4 mb-2 animate-pulse"
                        style={{ animationDelay: `${i * 150 + 100}ms`, animationDuration: '1.5s' }} />
                    <div className="h-3 bg-slate-700 rounded w-1/3 animate-pulse"
                        style={{ animationDelay: `${i * 150 + 200}ms`, animationDuration: '1.5s' }} />
                </div>
            ))}
        </div>
    );
};

/**
 * TableSkeleton - Skeleton placeholder for data tables
 */
const TableSkeleton = ({ rows = 5 }) => {
    return (
        <div className="p-6">
            {/* Header skeleton */}
            <div className="flex justify-between items-center mb-6">
                <div className="h-8 bg-slate-700 rounded w-48 animate-pulse" style={{ animationDuration: '1.5s' }} />
                <div className="h-10 bg-slate-700 rounded w-32 animate-pulse" style={{ animationDuration: '1.5s' }} />
            </div>

            {/* Table skeleton */}
            <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="flex gap-4 p-4 border-b border-slate-700">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-4 bg-slate-700 rounded flex-1 animate-pulse"
                            style={{ animationDuration: '1.5s' }} />
                    ))}
                </div>

                {/* Table rows */}
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 border-b border-slate-700/50">
                        {[1, 2, 3, 4, 5].map((j) => (
                            <div
                                key={j}
                                className="h-4 bg-slate-700 rounded flex-1 animate-pulse"
                                style={{
                                    animationDelay: `${(i * 5 + j) * 50}ms`,
                                    animationDuration: '1.5s'
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export { PageLoader, CardSkeleton, TableSkeleton };
export default PageLoader;
