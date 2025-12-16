import { useState, useEffect, useRef } from 'react';
import { Key, Shield, CheckCircle, XCircle, Copy, Loader2, Clock, AlertTriangle, Terminal } from 'lucide-react';
import { getLicenseMachineId, getLicenseStatus, activateLicense } from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';

function Activation() {
    const { isDark } = useTheme();
    const { toasts, addToast, removeToast } = useToast();

    const [machineId, setMachineId] = useState('');
    const [licenseStatus, setLicenseStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActivating, setIsActivating] = useState(false);

    // Console state
    const [consoleCommand, setConsoleCommand] = useState('');
    const [consoleHistory, setConsoleHistory] = useState([
        { type: 'system', text: 'DSP License Console v1.0' },
        { type: 'system', text: 'Available commands:' },
        { type: 'info', text: '  #CANC              - Generate Machine ID' },
        { type: 'info', text: '  #CAHOST<code>      - Activate license' },
        { type: 'info', text: '  #CALST             - Check license status' },
        { type: 'info', text: '  #HELP              - Show available commands' },
        { type: 'system', text: '---' },
    ]);
    const consoleEndRef = useRef(null);

    useEffect(() => {
        loadLicenseStatus();
    }, []);

    // Auto-scroll console to bottom
    useEffect(() => {
        consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [consoleHistory]);

    const loadLicenseStatus = async () => {
        setIsLoading(true);
        try {
            const [machineRes, statusRes] = await Promise.all([
                getLicenseMachineId(),
                getLicenseStatus()
            ]);
            setMachineId(machineRes.data.machine_id);
            setLicenseStatus(statusRes.data);
        } catch (error) {
            console.error('Failed to load license status:', error);
            addToast('Failed to load license status', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const addConsoleOutput = (type, text) => {
        setConsoleHistory(prev => [...prev, { type, text }]);
    };

    const handleConsoleSubmit = async (e) => {
        e.preventDefault();
        const cmd = consoleCommand.trim().toUpperCase();

        if (!cmd) return;

        // Echo command
        addConsoleOutput('command', `> ${consoleCommand}`);
        setConsoleCommand('');

        // Process command
        if (cmd === '#CANC') {
            // Generate Machine ID
            addConsoleOutput('system', 'Generating Machine ID...');
            try {
                const response = await getLicenseMachineId();
                const mid = response.data.machine_id;
                setMachineId(mid);
                addConsoleOutput('success', `Machine ID: ${mid}`);
                addConsoleOutput('info', 'Copy this ID and send to your vendor for activation code.');
                // Auto-copy to clipboard
                navigator.clipboard.writeText(mid);
                addConsoleOutput('info', '✓ Copied to clipboard');
            } catch (error) {
                addConsoleOutput('error', `Error: ${error.response?.data?.error || error.message}`);
            }
        }
        else if (cmd.startsWith('#CAHOST')) {
            // Activate license
            const code = consoleCommand.trim().substring(7).trim(); // Remove #CAHOST prefix
            if (!code) {
                addConsoleOutput('error', 'Usage: #CAHOST<activation_code>');
                addConsoleOutput('info', 'Example: #CAHOSTDSP-2025-xxxxx-xxxxx');
                return;
            }

            addConsoleOutput('system', 'Validating activation code...');
            setIsActivating(true);

            try {
                const response = await activateLicense(code);
                if (response.data.success) {
                    addConsoleOutput('success', '✓ LICENSE ACTIVATED SUCCESSFULLY!');
                    addConsoleOutput('success', `Expires: ${new Date(response.data.expires_at).toLocaleDateString('id-ID')}`);
                    addConsoleOutput('success', `Days remaining: ${response.data.days_remaining}`);
                    addConsoleOutput('system', 'Logging out... Please login again.');
                    localStorage.setItem('license_active', 'true');
                    // Logout and redirect to login
                    setTimeout(() => {
                        localStorage.removeItem('username');
                        localStorage.removeItem('userRole');
                        window.location.href = '/login';
                    }, 2000);
                }
            } catch (error) {
                const errorMsg = error.response?.data?.error || 'Activation failed';
                addConsoleOutput('error', `✗ ${errorMsg}`);
            } finally {
                setIsActivating(false);
            }
        }
        else if (cmd === '#CALST') {
            // Check license status
            addConsoleOutput('system', 'Checking license status...');
            try {
                const response = await getLicenseStatus();
                const status = response.data;
                addConsoleOutput('info', `Status: ${status.status.toUpperCase()}`);
                addConsoleOutput('info', `Machine ID: ${status.machine_id}`);
                if (status.is_active) {
                    addConsoleOutput('success', `Expires: ${new Date(status.expires_at).toLocaleDateString('id-ID')}`);
                    addConsoleOutput('success', `Days remaining: ${status.days_remaining}`);
                } else {
                    addConsoleOutput('warning', status.message);
                }
                setLicenseStatus(status);
            } catch (error) {
                addConsoleOutput('error', `Error: ${error.response?.data?.error || error.message}`);
            }
        }
        else if (cmd === '#HELP') {
            addConsoleOutput('system', 'Available commands:');
            addConsoleOutput('info', '  #CANC              - Generate Machine ID');
            addConsoleOutput('info', '  #CAHOST<code>      - Activate license');
            addConsoleOutput('info', '  #CALST             - Check license status');
            addConsoleOutput('info', '  #HELP              - Show this help');
        }
        else if (cmd === '#CLEAR' || cmd === 'CLEAR') {
            setConsoleHistory([{ type: 'system', text: 'Console cleared. Type #HELP for commands.' }]);
        }
        else {
            addConsoleOutput('error', `Unknown command: ${cmd}`);
            addConsoleOutput('info', 'Type #HELP for available commands');
        }
    };

    const getConsoleLineClass = (type) => {
        switch (type) {
            case 'command': return 'text-cyan-400 font-bold';
            case 'success': return 'text-emerald-400';
            case 'error': return 'text-red-400';
            case 'warning': return 'text-amber-400';
            case 'info': return 'text-slate-400';
            case 'system': return 'text-purple-400';
            default: return 'text-slate-300';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Header */}
            <div className={`relative overflow-hidden rounded-2xl p-8 border ${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-900 border-slate-700/50' : 'bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 border-slate-200 shadow-lg'}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
                <div className="relative flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                        <Terminal className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>License Console</h1>
                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Execute commands to manage your license</p>
                    </div>
                </div>
            </div>

            {/* License Status Banner */}
            <div className={`rounded-xl border p-4 flex items-center justify-between ${licenseStatus?.is_active
                ? isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
                : isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                }`}>
                <div className="flex items-center gap-3">
                    {licenseStatus?.is_active ? (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                    ) : (
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                    )}
                    <div>
                        <p className={`font-semibold ${licenseStatus?.is_active ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {licenseStatus?.is_active ? 'License Active' : 'License Inactive'}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {licenseStatus?.message}
                        </p>
                    </div>
                </div>
                {licenseStatus?.is_active && (
                    <div className="text-right">
                        <p className={`text-sm font-semibold ${licenseStatus.days_remaining <= 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {licenseStatus.days_remaining} days left
                        </p>
                    </div>
                )}
            </div>

            {/* Console Terminal */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-900 border-slate-700'}`}>
                {/* Console Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-2 text-sm text-slate-400 font-mono">DSP License Console</span>
                </div>

                {/* Console Output */}
                <div className="h-80 overflow-y-auto p-4 font-mono text-sm space-y-1" style={{ backgroundColor: '#0d1117' }}>
                    {consoleHistory.map((line, i) => (
                        <div key={i} className={getConsoleLineClass(line.type)}>
                            {line.text}
                        </div>
                    ))}
                    <div ref={consoleEndRef} />
                </div>

                {/* Console Input */}
                <form onSubmit={handleConsoleSubmit} className="border-t border-slate-700">
                    <div className="flex items-center px-4 py-2" style={{ backgroundColor: '#0d1117' }}>
                        <span className="text-green-400 font-mono mr-2">$</span>
                        <input
                            type="text"
                            value={consoleCommand}
                            onChange={(e) => setConsoleCommand(e.target.value)}
                            placeholder="Type command... (e.g., #CANC)"
                            disabled={isActivating}
                            className="flex-1 bg-transparent text-slate-100 font-mono text-sm placeholder-slate-600 focus:outline-none"
                            autoFocus
                        />
                        {isActivating && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                    </div>
                </form>
            </div>

            {/* Quick Reference */}
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <Key className="w-4 h-4" />
                    Quick Commands
                </h3>
                <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                    <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-slate-900 text-cyan-400' : 'bg-slate-100 text-cyan-700'}`}>
                        #CANC
                        <span className={`block text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Get Machine ID</span>
                    </div>
                    <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-slate-900 text-emerald-400' : 'bg-slate-100 text-emerald-700'}`}>
                        #CAHOST&lt;code&gt;
                        <span className={`block text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Activate License</span>
                    </div>
                    <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-slate-900 text-purple-400' : 'bg-slate-100 text-purple-700'}`}>
                        #CALST
                        <span className={`block text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Check Status</span>
                    </div>
                    <div className={`px-3 py-2 rounded-lg ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
                        #HELP
                        <span className={`block text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Show Help</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Activation;
