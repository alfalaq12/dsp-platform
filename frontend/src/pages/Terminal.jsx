import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function Terminal() {
    const { isDark } = useTheme();
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState('');
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const outputRef = useRef(null);
    const inputRef = useRef(null);

    // Fetch connected agents
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await api.get('/agents/connected');
                const agentList = response.data?.connected_agents || response.data || [];
                setAgents(agentList);
                if (agentList.length > 0 && !selectedAgent) {
                    setSelectedAgent(agentList[0]);
                }
            } catch (error) {
                console.error('Failed to fetch agents:', error);
            }
        };
        fetchAgents();
        const interval = setInterval(fetchAgents, 10000);
        return () => clearInterval(interval);
    }, [selectedAgent]);

    // Auto-scroll to bottom of output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [history]);

    // Execute command
    const executeCommand = async () => {
        if (!command.trim() || !selectedAgent || isExecuting) return;

        const cmd = command.trim();
        setCommand('');
        setIsExecuting(true);

        // Add command to history
        setCommandHistory(prev => [...prev.slice(-50), cmd]);
        setHistoryIndex(-1);

        // Add command to output
        setHistory(prev => [...prev, {
            type: 'command',
            agent: selectedAgent,
            content: cmd,
            timestamp: new Date().toLocaleTimeString()
        }]);

        try {
            const response = await api.post(`/agents/${selectedAgent}/exec`, {
                command: cmd,
                timeout: 60
            });

            const data = response.data;
            setHistory(prev => [...prev, {
                type: data.success ? 'success' : 'error',
                agent: selectedAgent,
                content: data.output || data.error || 'No output',
                exitCode: data.exit_code,
                duration: data.duration,
                timestamp: new Date().toLocaleTimeString()
            }]);
        } catch (error) {
            setHistory(prev => [...prev, {
                type: 'error',
                agent: selectedAgent,
                content: error.response?.data?.error || error.message,
                timestamp: new Date().toLocaleTimeString()
            }]);
        } finally {
            setIsExecuting(false);
            inputRef.current?.focus();
        }
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeCommand();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCommand('');
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            setHistory([]);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Terminal Console</h1>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Execute commands on remote agents</p>
                </div>

                {/* Agent Selector */}
                <div className="flex items-center gap-3">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Agent:</span>
                    <select
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        className={`px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark
                                ? 'bg-gray-800 border border-gray-700 text-white'
                                : 'bg-white border border-gray-300 text-gray-900'
                            }`}
                    >
                        {agents.length === 0 ? (
                            <option value="">No agents connected</option>
                        ) : (
                            agents.map(agent => (
                                <option key={agent} value={agent}>{agent}</option>
                            ))
                        )}
                    </select>
                    <div className={`w-3 h-3 rounded-full ${agents.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
            </div>

            {/* Terminal Container - Always dark for authentic terminal look */}
            <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
                {/* Terminal Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="ml-4 text-gray-400 text-sm font-mono">
                        {selectedAgent ? `${selectedAgent}@dsp-agent` : 'Select an agent'}
                    </span>
                    <div className="flex-1"></div>
                    <button
                        onClick={() => setHistory([])}
                        className="text-gray-500 hover:text-gray-300 text-xs"
                    >
                        Clear (Ctrl+L)
                    </button>
                </div>

                {/* Terminal Output */}
                <div
                    ref={outputRef}
                    className="h-[500px] overflow-y-auto p-4 font-mono text-sm bg-gray-950"
                >
                    {history.length === 0 ? (
                        <div className="text-gray-500 italic">
                            <p>Welcome to DSP Terminal Console</p>
                            <p className="mt-2">• Select an agent from the dropdown above</p>
                            <p>• Type commands and press Enter to execute</p>
                            <p>• Use ↑/↓ arrows to navigate command history</p>
                            <p>• Press Ctrl+L to clear the screen</p>
                            <p className="mt-4 text-yellow-500">⚠️ Commands are executed on the remote agent's system. Use with caution.</p>
                        </div>
                    ) : (
                        history.map((item, index) => (
                            <div key={index} className="mb-3">
                                {item.type === 'command' ? (
                                    <div className="flex items-start gap-2">
                                        <span className="text-green-400 font-bold">$</span>
                                        <span className="text-white">{item.content}</span>
                                        <span className="text-gray-600 text-xs ml-auto">{item.timestamp}</span>
                                    </div>
                                ) : (
                                    <div className={`pl-4 ${item.type === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
                                        <pre className="whitespace-pre-wrap break-words">{item.content}</pre>
                                        {item.exitCode !== undefined && (
                                            <div className="text-xs text-gray-600 mt-1">
                                                Exit code: {item.exitCode} | Duration: {item.duration}ms
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Loading indicator */}
                    {isExecuting && (
                        <div className="flex items-center gap-2 text-blue-400">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Executing...</span>
                        </div>
                    )}
                </div>

                {/* Terminal Input */}
                <div className="flex items-center border-t border-gray-800 bg-gray-900">
                    <span className="px-4 text-green-400 font-mono font-bold">$</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={selectedAgent ? "Enter command..." : "Select an agent first"}
                        disabled={!selectedAgent || isExecuting}
                        className="flex-1 py-3 pr-4 bg-transparent text-white font-mono focus:outline-none disabled:opacity-50 placeholder-gray-600"
                        autoFocus
                    />
                    <button
                        onClick={executeCommand}
                        disabled={!command.trim() || !selectedAgent || isExecuting}
                        className="px-4 py-2 mr-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-sm transition-colors"
                    >
                        Run
                    </button>
                </div>
            </div>

            {/* Quick Commands */}
            <div className={`rounded-xl border p-4 ${isDark
                    ? 'bg-gray-900/50 border-gray-800'
                    : 'bg-white border-gray-200 shadow-sm'
                }`}>
                <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>Quick Commands</h3>
                <div className="flex flex-wrap gap-2">
                    {[
                        { label: 'pwd', cmd: 'pwd', os: 'unix' },
                        { label: 'ls -la', cmd: 'ls -la', os: 'unix' },
                        { label: 'whoami', cmd: 'whoami', os: 'all' },
                        { label: 'hostname', cmd: 'hostname', os: 'all' },
                        { label: 'date', cmd: 'date', os: 'all' },
                        { label: 'df -h', cmd: 'df -h', os: 'unix' },
                        { label: 'free -m', cmd: 'free -m', os: 'unix' },
                        { label: 'uptime', cmd: 'uptime', os: 'unix' },
                        { label: 'dir', cmd: 'dir', os: 'windows' },
                        { label: 'ipconfig', cmd: 'ipconfig', os: 'windows' },
                        { label: 'systeminfo', cmd: 'systeminfo', os: 'windows' },
                    ].map((item, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                setCommand(item.cmd);
                                inputRef.current?.focus();
                            }}
                            disabled={!selectedAgent}
                            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${isDark
                                    ? 'bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-600 text-gray-300 border-gray-700'
                                    : 'bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 border-gray-300'
                                }`}
                        >
                            {item.label}
                            <span className="ml-1 text-[10px]">
                                {item.os === 'unix' ? '🐧' : item.os === 'windows' ? '🪟' : ''}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Security Notice */}
            <div className={`rounded-xl border p-4 ${isDark
                    ? 'bg-yellow-900/20 border-yellow-800/50'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                        <h4 className={`font-medium ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`}>Security Notice</h4>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-yellow-800'}`}>
                            Commands are executed with the same privileges as the DSP Agent service. All commands are logged for audit purposes.
                            Only administrators have access to this feature.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
