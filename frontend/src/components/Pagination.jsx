import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Professional Pagination Component
 * Designed for government enterprise applications
 */
function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    showItemsPerPage = true
}) {
    const { isDark } = useTheme();
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) pages.push('...');

            // Show pages around current
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }

            if (currentPage < totalPages - 2) pages.push('...');

            // Always show last page
            if (!pages.includes(totalPages)) pages.push(totalPages);
        }

        return pages;
    };

    if (totalItems === 0) return null;

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 rounded-xl border transition-colors ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
            {/* Items info and per page selector */}
            <div className={`flex items-center gap-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <span>
                    Menampilkan <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{startItem}</span> - <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{endItem}</span> dari <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalItems}</span> data
                </span>

                {showItemsPerPage && (
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">|</span>
                        <span>Per halaman:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                onItemsPerPageChange(Number(e.target.value));
                                onPageChange(1); // Reset to first page
                            }}
                            className={`px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                            <option value={500}>500</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
                {/* First page */}
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                    title="Halaman Pertama"
                >
                    <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Previous page */}
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                    title="Sebelumnya"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1 mx-2">
                    {getPageNumbers().map((page, idx) => (
                        page === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">...</span>
                        ) : (
                            <button
                                key={page}
                                onClick={() => onPageChange(page)}
                                className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition ${currentPage === page
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                    : (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                                    }`}
                            >
                                {page}
                            </button>
                        )
                    ))}
                </div>

                {/* Next page */}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                    title="Selanjutnya"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last page */}
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                    title="Halaman Terakhir"
                >
                    <ChevronsRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default Pagination;
