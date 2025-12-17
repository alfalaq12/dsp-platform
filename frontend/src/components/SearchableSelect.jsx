import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * SearchableSelect - A searchable dropdown component
 * @param {Object} props
 * @param {Array} props.options - Array of {id, name, ...rest}
 * @param {string} props.value - Selected value (id)
 * @param {Function} props.onChange - Callback when value changes
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.required - Required field
 * @param {string} props.displayField - Field name to display (default: 'name')
 * @param {string} props.subField - Optional secondary field to display
 */
function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Select...',
    required = false,
    displayField = 'name',
    subField = null,
}) {
    const { isDark } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Find selected option
    const selectedOption = options.find(opt => String(opt.id) === String(value));

    // Filter options based on search - memoized for performance
    const filteredOptions = useMemo(() =>
        options.filter(opt =>
            opt[displayField]?.toLowerCase().includes(search.toLowerCase()) ||
            (subField && opt[subField]?.toLowerCase().includes(search.toLowerCase()))
        ), [options, search, displayField, subField]
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (option) => {
        onChange({ target: { value: String(option.id) } });
        setIsOpen(false);
        setSearch('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange({ target: { value: '' } });
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-3 border rounded-xl flex items-center justify-between transition
                    ${isDark
                        ? 'bg-slate-900/50 border-slate-700 text-white hover:border-slate-600'
                        : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                    }
                    ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
                `}
            >
                <span className={selectedOption ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}>
                    {selectedOption ? selectedOption[displayField] : placeholder}
                </span>
                <div className="flex items-center gap-1">
                    {value && (
                        <span
                            onClick={handleClear}
                            className={`p-1 rounded-full hover:bg-slate-600/50 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}
                        >
                            <X className="w-4 h-4" />
                        </span>
                    )}
                    <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                </div>
            </button>

            {/* Hidden input for form validation */}
            <input
                type="hidden"
                value={value || ''}
                required={required}
            />

            {/* Dropdown Panel */}
            {isOpen && (
                <div className={`absolute z-50 w-full mt-2 rounded-xl border shadow-2xl overflow-hidden
                    ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}
                `}>
                    {/* Search Input */}
                    <div className={`p-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className="relative">
                            <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search..."
                                className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border
                                    ${isDark
                                        ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
                                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                                    } focus:outline-none
                                `}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-64 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                No results found
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option)}
                                    className={`w-full px-4 py-3 flex items-center justify-between text-left transition
                                        ${String(option.id) === String(value)
                                            ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700'
                                            : isDark ? 'hover:bg-slate-700 text-white' : 'hover:bg-slate-50 text-slate-900'
                                        }
                                    `}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{option[displayField]}</span>
                                        {subField && option[subField] && (
                                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {option[subField]}
                                            </span>
                                        )}
                                    </div>
                                    {String(option.id) === String(value) && (
                                        <Check className="w-4 h-4 text-blue-500" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer showing count */}
                    <div className={`px-4 py-2 text-xs border-t ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                        {filteredOptions.length} of {options.length} items
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(SearchableSelect);
