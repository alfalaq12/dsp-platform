import { Link } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';

const NotFound = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
            <div className="text-center max-w-md">
                {/* 404 Visual */}
                <div className="relative mb-8">
                    <div className="text-[150px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 leading-none select-none">
                        404
                    </div>
                    <div className="absolute inset-0 text-[150px] font-bold text-blue-500/10 blur-2xl leading-none select-none">
                        404
                    </div>
                </div>

                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-10 h-10 text-orange-400" />
                    </div>
                </div>

                {/* Message */}
                <h1 className="text-2xl font-bold text-white mb-3">
                    Halaman Tidak Ditemukan
                </h1>
                <p className="text-slate-400 mb-8">
                    Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
                </p>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"
                    >
                        <Home className="w-5 h-5" />
                        Kembali ke Dashboard
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all duration-300"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Halaman Sebelumnya
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
