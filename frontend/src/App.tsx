import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, ArrowRight, Activity, Terminal, X, AlertCircle, CheckCircle2, FileText, Search, Fingerprint, Database } from 'lucide-react';
import Navbar from './Navbar';
import LogUploader from './LogUploader';
import AnomalyCard from './AnomalyCard';
import IssuePanel from './IssuePanel';
import FixesPanel from './FixesPanel';
import ServiceGraph from './ServiceGraph';
import HistoryTimeline from './HistoryTimeline';
import LogDataFlow from './LogDataFlow';
import ChatWindow from './ChatWindow';
import AnalysisLoader from './AnalysisLoader';
import { LogAssistant } from './components/LogAssistant';
import { AnomalyResponse, HistoryItem } from './types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const App: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<AnomalyResponse | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [externalChatMsg, setExternalChatMsg] = useState<string | undefined>(undefined);
    const [isDiagnosticExpanded, setIsDiagnosticExpanded] = useState(false);
    const [diagnosticFontSize, setDiagnosticFontSize] = useState(14);
    
    // Viewport-level interactive modals state
    const [selectedNode, setSelectedNode] = useState<{
        label: string;
        status: string;
        desc: string;
        definition: string;
        remediation: string[];
    } | null>(null);
    const [selectedPipelineStep, setSelectedPipelineStep] = useState<string | null>(null);

    // Filter, Search and Selected Telemetry Log states
    const [logFilter, setLogFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [presetLogText, setPresetLogText] = useState('');
    const [selectedTableLogLine, setSelectedTableLogLine] = useState<{
        line: number;
        severity: string;
        component: string;
        content: string;
    } | null>(null);

    const getOfflineLogDiagnostics = (messageText: string) => {
        const msg = messageText.toLowerCase();
        if (msg.includes("remaining connection slots") || msg.includes("connection limit exceeded") || msg.includes("max_connections")) {
            return {
                explanation: "The database system has run out of connection slots. PostgreSQL caps active database connections using the 'max_connections' config option. When client connections spike (or database sockets fail to close), the system blocks new queries, reserving remaining slots exclusively for admins.",
                remediations: [
                    "Identify and terminate idle db transactions: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';",
                    "Configure database pool handlers like PgBouncer to buffer/recycle open database socket descriptors.",
                    "Temporarily elevate max connection parameters: ALTER SYSTEM SET max_connections = 250; followed by database reload."
                ]
            };
        } else if (msg.includes("no space left on device") || msg.includes("storage full") || msg.includes("disk space exhaustion")) {
            return {
                explanation: "The storage block partition is 100% full. Because block storage bounds are exhausted, the daemon fails to commit writes, causing operational errors, file descriptor crashes, and database locking logs.",
                remediations: [
                    "Locate heavy directories eating local memory blocks using: du -sh /var/log/* | sort -h",
                    "Clear system caches and obsolete package pools: apt-get clean && journalctl --vacuum-size=100M",
                    "Purge rotated compressed logs (.gz files) under /var/log to regain emergency storage space."
                ]
            };
        } else if (msg.includes("failed password") || msg.includes("invalid user") || msg.includes("unauthorized access")) {
            return {
                explanation: "An SSH secure login attempt failed with incorrect credentials. Repeated auth failures from unknown external IPs point to automated brute-force scripts targeting common port 22 access gates.",
                remediations: [
                    "Ban the brute-force source IP using kernel firewall parameters: iptables -A INPUT -s <Attacker_IP> -j DROP",
                    "Install and enable fail2ban daemon to automatically lock malicious brute-force connections.",
                    "Strengthen sshd_config parameters: set PasswordAuthentication to 'no' and bind authentication strictly to private RSA/Ed25519 keys."
                ]
            };
        } else if (msg.includes("fsck") || msg.includes("deleted inode") || msg.includes("block recovery")) {
            return {
                explanation: "The system is executing storage block recovery checks or scanning storage tables for corrupt directory links. This warning usually happens after unexpected kernel panics, abrupt power resets, or disk hardware block damage.",
                remediations: [
                    "Execute fsck checks on safe unmounted block locations: fsck -f /dev/sda1",
                    "Review active kernel logs for disk write-block sector errors: dmesg | grep -E 'Buffer I/O error|disk'",
                    "Schedule volume snapshots or check hard disk driver SMART metrics to verify storage hardware reliability."
                ]
            };
        } else if (msg.includes("connection refused") || msg.includes("dial tcp") || msg.includes("socket: connection refused")) {
            return {
                explanation: "The network handshake failed because the target server port is not active or binding connections. This indicates either the service process daemon is stopped or local firewall policies are dropping target tcp packages.",
                remediations: [
                    "Confirm the target service daemon is active and running: systemctl status <service_name>",
                    "Scan current network bindings to ensure the daemon is listening on the correct IP/port: ss -tulpn | grep <port>",
                    "Review local iptables or ufw rules to ensure traffic flows freely through port gates."
                ]
            };
        } else if (msg.includes("oom-killer") || msg.includes("out of memory") || msg.includes("cannot allocate memory")) {
            return {
                explanation: "The host has run out of physical memory (RAM). The Linux kernel Out-Of-Memory (OOM) Killer was invoked to force terminate heavy processes (typically Java processes, database engines, or microservices) to save the OS kernel from crashing.",
                remediations: [
                    "Review syslog entries to check which process was killed: dmesg -T | grep -i oom",
                    "Verify free host memory bounds: free -h",
                    "Add host swap files or configure memory limit boundaries inside daemon config files."
                ]
            };
        }
        return {
            explanation: "Standard system telemetry message. Analysis does not detect immediate crashes, but log details should be cross-referenced with related network services and host resource parameters.",
            remediations: [
                "Scan active systemd journals around this log line timestamp: journalctl -u syslog --since '5 minutes ago'",
                "Check server load averages and disk usage matrices.",
                "Forward the raw log text to our AI Log Assistant for full contextual root-cause diagnostics."
            ]
        };
    };

    const getPipelineStepDetails = (stepId: string) => {
        switch (stepId) {
            case 'raw':
                return {
                    title: "Raw Ingestion Stage",
                    icon: <FileText className="w-8 h-8 text-blue-500 animate-pulse" />,
                    summary: "Streaming files ingestion and sanity checking.",
                    description: "The raw ingestion layer acts as the entrance gate for log streaming. It accepts files and system stream feeds in plain text format, validating the file structure and checking metadata integrity (e.g., filename, size, format) before sending it further down the ingestion chain.",
                    checklist: [
                        "Validates UTF-8 character encoding standards across all ingested bytes.",
                        "Inspects file size boundaries to prevent memory overflow attacks.",
                        "Initializes file pointers and stream telemetry pipelines."
                    ]
                };
            case 'regex':
                return {
                    title: "Regex Parsing Stage",
                    icon: <Search className="w-8 h-8 text-purple-500 animate-pulse" />,
                    summary: "Concurrent text extraction and log line tokenisation.",
                    description: "This stage runs highly optimized, concurrent regular expression engines to parse unstructured logs. It parses timestamps, process IDs, log levels (e.g., INFO, WARN, CRITICAL), hostnames, and extracts details to structure the unstructured text stream.",
                    checklist: [
                        "Identifies severity strings and standardizes them as unified tokens.",
                        "Parses ISO and system timestamp formats into standard datetimes.",
                        "Isolates kernel sub-components and network port IDs."
                    ]
                };
            case 'features':
                return {
                    title: "Feature Matrix Stage",
                    icon: <Fingerprint className="w-8 h-8 text-orange-500 animate-pulse" />,
                    summary: "Vectorised feature scaling and statistics matrix.",
                    description: "Converted log objects are vectorised into structured feature sets. It maps specific pattern frequencies, error density thresholds, memory footprint parameters, and CPU metrics into a multi-dimensional array representing the system state at that timestamp.",
                    checklist: [
                        "Normalizes numerical parameters using standard min-max scaling.",
                        "Builds the dense matrix representation for deep learning inference.",
                        "Triggers safety alerts if single-line severity exceeds crash limits."
                    ]
                };
            case 'lstm':
                return {
                    title: "LSTM Neural Inference Stage",
                    icon: <Activity className="w-8 h-8 text-blue-500 animate-pulse" />,
                    summary: "Recurrent neural network evaluation of system health.",
                    description: "The vectorised input is processed through a pre-trained deep learning LSTM network. It analyzes sequence patterns over time to find temporal anomalies, identify hidden service crashes, and detect multi-node dependency errors that are invisible to static rule analyzers.",
                    checklist: [
                        "Scores sequence matrices against historical normal state vectors.",
                        "Flags temporal drift anomalies where state sequence is out of order.",
                        "Calculates neural confidence metrics to filter out false alarms."
                    ]
                };
            case 'result':
                return {
                    title: "Audit Success / Persistence Stage",
                    icon: <Database className="w-8 h-8 text-green-500 animate-pulse" />,
                    summary: "Result publication and telemetry database writing.",
                    description: "The inference outputs are compiled into detailed diagnostic metrics. Operational logs are persisted into audit databases, notifications are dispatched, and the pipeline resumes standby mode to wait for the next telemetry packet.",
                    checklist: [
                        "Persists labeled logs and node anomalies in indexed storage.",
                        "Updates dashboard UI state with live topology node statuses.",
                        "Triggers webhook callbacks for automated remediation steps."
                    ]
                };
            default:
                return null;
        }
    };

    useEffect(() => {
        const checkStatus = async () => {
            try {
                await axios.get('http://localhost:5000/');
                setIsConnected(true);
            } catch (err) {
                setIsConnected(false);
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleUpload = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Artificial delay for premium loader experience (optional, but requested for the "feel")
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const response = await axios.post<AnomalyResponse>('http://localhost:5000/predict', formData);
            setResult(response.data);
            
            const newItem: HistoryItem = {
                timestamp: new Date().toLocaleTimeString(),
                filename: file.name,
                status: response.data.status,
                confidence: response.data.confidence
            };
            setHistory(prev => [newItem, ...prev].slice(0, 5));
        } catch (err) {
            console.error("Upload failed", err);
            alert("Error connecting to backend API. Please ensure FastAPI is running.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFixClick = (fix: string) => {
        setExternalChatMsg(`I'm looking at the suggested fix: "${fix}". Can you explain in more detail exactly how I should implement this and why it helps?`);
        setIsChatOpen(true);
        setTimeout(() => setExternalChatMsg(undefined), 100);
    };

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text pb-12 overflow-x-hidden">
            <Navbar isConnected={isConnected} />

            {/* Premium Full-Screen Analysis Loader */}
            {isUploading && <AnalysisLoader />}

            <main className="max-w-[98%] mx-auto px-4 lg:px-8 py-8 space-y-10">
                
                {/* 1. Top Grid: Ingestion & AI Log Assistant */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
                    {/* Left: File Ingestion & Anomaly Card */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <LogUploader onUpload={handleUpload} isUploading={isUploading} />
                        
                        {result ? (
                            <div className="animate-in zoom-in duration-300">
                                <AnomalyCard status={result.status} confidence={result.confidence} aiExplanation={result.ai_explanation} />
                            </div>
                        ) : (
                            <div className="bg-[#161b22] border-2 border-dashed border-[#30363d] rounded-[2rem] p-8 flex flex-col items-center justify-center text-center flex-1 min-h-[220px]">
                                <Activity className="w-12 h-12 text-dark-muted mb-4 animate-pulse" />
                                <h3 className="text-white font-bold">Awaiting Stream</h3>
                                <p className="text-[10px] text-dark-muted uppercase tracking-widest mt-2 font-mono">LSTM Neural Core Offline</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Right: AI Log Assistant */}
                    <div className="lg:col-span-5 h-[580px]">
                        <LogAssistant presetLogText={presetLogText} />
                    </div>
                </div>

                {/* 2. Reactive Log Flowchart */}
                {result && (
                    <div className="animate-in slide-in-from-bottom duration-1000">
                        <LogDataFlow 
                            filename={result.filename || "unknown_log"} 
                            metrics={result.features || {errors: 0, cpu: 0, disk: 0}} 
                            onStepClick={(stepId) => setSelectedPipelineStep(stepId)}
                        />
                    </div>
                )}

                {/* 3. Infrastructure Analysis */}
                {result && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in fade-in duration-700">
                        <div className="xl:col-span-4">
                            <IssuePanel 
                                issue={result.detected_issue}
                                node={result.failed_node}
                                reason={result.why_it_failed}
                            />
                        </div>
                        <div className="xl:col-span-8 flex flex-col gap-6">
                            <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3 uppercase italic">
                                <Terminal className="w-6 h-6 text-blue-500" /> Active Service Topology
                            </h2>
                            <ServiceGraph 
                                flowData={result.flow} 
                                onNodeSelect={(node) => setSelectedNode(node)}
                            />
                        </div>
                    </div>
                )}

                {/* 4. AI Automated Diagnostic Card (Full Width) */}
                {result && result.status === 'anomaly' && result.ai_explanation && (
                    <div className="bg-[#161b22] border-2 border-gray-700/50 rounded-[2rem] p-8 lg:p-10 shadow-2xl transition-all hover:border-blue-500/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[#30363d] pb-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-500/10 p-3.5 rounded-2xl">
                                    <Sparkles className="text-blue-500 w-8 h-8 animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">AI Automated Diagnostic Report</h3>
                                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest mt-1">Generated by Gemini-2.5-Flash Core</p>
                                </div>
                            </div>
                            
                            {/* Font size adjustment panel */}
                            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] px-4 py-2 rounded-2xl text-xs text-dark-muted font-bold">
                                <span>Font:</span>
                                <button 
                                    onClick={() => setDiagnosticFontSize(prev => Math.max(12, prev - 2))} 
                                    className="hover:text-white px-2 font-mono text-sm active:scale-95 transition-transform"
                                    title="Decrease Font Size"
                                >
                                    A-
                                </button>
                                <span className="text-white bg-[#161b22] px-2 py-0.5 rounded border border-[#30363d] min-w-8 text-center">{diagnosticFontSize}px</span>
                                <button 
                                    onClick={() => setDiagnosticFontSize(prev => Math.min(24, prev + 2))} 
                                    className="hover:text-white px-2 font-mono text-sm active:scale-95 transition-transform"
                                    title="Increase Font Size"
                                >
                                    A+
                                </button>
                            </div>
                        </div>

                        {/* Expandable Markdown Body */}
                        <div className="relative">
                            <div 
                                className={`text-gray-300 prose prose-invert max-w-none prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-gray-800 leading-relaxed transition-all duration-500 overflow-hidden ${isDiagnosticExpanded ? 'max-h-[5000px]' : 'max-h-64'}`}
                                style={{ fontSize: `${diagnosticFontSize}px` }}
                            >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {result.ai_explanation}
                                </ReactMarkdown>
                            </div>
                            
                            {/* Bottom Fade Gradient for Collapsed View */}
                            {!isDiagnosticExpanded && (
                                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#161b22] to-transparent pointer-events-none" />
                            )}
                        </div>

                        {/* Read More Expander Trigger */}
                        <div className="mt-6 flex justify-center border-t border-[#30363d] pt-4">
                            <button 
                                onClick={() => setIsDiagnosticExpanded(!isDiagnosticExpanded)}
                                className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/25 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95"
                            >
                                {isDiagnosticExpanded ? "Show Less" : "Read More"}
                            </button>
                        </div>
                    </div>
                )}

                {/* 5. Parsed Logs Table */}
                {result && result.parsed_logs && (() => {
                    const allLogs = result.parsed_logs || [];
                    
                    // Count severity statuses
                    const countAll = allLogs.length;
                    const countCritical = allLogs.filter(l => l.severity === 'CRITICAL').length;
                    const countWarning = allLogs.filter(l => l.severity === 'WARNING').length;
                    const countInfo = allLogs.filter(l => l.severity === 'INFO').length;

                    // Filter logs
                    const filteredLogs = allLogs.filter(log => {
                        const matchesFilter = logFilter === 'ALL' || log.severity === logFilter;
                        const matchesSearch = log.content.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                                              (log.component && log.component.toLowerCase().includes(logSearchQuery.toLowerCase()));
                        return matchesFilter && matchesSearch;
                    });

                    // Export CSV handler
                    const handleExportCSV = () => {
                        if (filteredLogs.length === 0) return;
                        const csvContent = [
                            ["Line", "Severity", "Component", "Message"],
                            ...filteredLogs.map(log => [log.line, log.severity, log.component, log.content])
                        ].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
                        
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.setAttribute("href", url);
                        link.setAttribute("download", `parsed_logs_${Date.now()}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    };

                    const offlineDiag = selectedTableLogLine ? getOfflineLogDiagnostics(selectedTableLogLine.content) : null;

                    return (
                        <div className="space-y-6">
                            <div className="bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] p-8 lg:p-10 shadow-2xl">
                                
                                {/* Header with Telemetry Summary */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-[#30363d] pb-6">
                                    <div>
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">Detailed Log Stream Parsing</h3>
                                        <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest mt-1">Interactive Log Stream Telemetry</p>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="bg-[#0d1117] px-4 py-2 rounded-xl border border-[#30363d] text-center min-w-24">
                                            <span className="text-[8px] text-dark-muted font-bold uppercase block">Lines Scanned</span>
                                            <span className="text-sm text-white font-mono font-bold">{result.total_lines_scanned || 0}</span>
                                        </div>
                                        <div className="bg-[#0d1117] px-4 py-2 rounded-xl border border-[#30363d] text-center min-w-24">
                                            <span className="text-[8px] text-dark-muted font-bold uppercase block">Errors Found</span>
                                            <span className="text-sm text-red-500 font-mono font-bold">{result.error_lines_count || 0}</span>
                                        </div>
                                        <button 
                                            onClick={handleExportCSV}
                                            className="bg-blue-600/10 hover:bg-blue-600/25 text-blue-400 border border-blue-500/25 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2"
                                            title="Export Filtered Logs as CSV"
                                        >
                                            Export CSV
                                        </button>
                                    </div>
                                </div>

                                {/* Controls: Search and Severity Filters */}
                                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6 bg-[#0d1117] p-4 rounded-2xl border border-[#30363d]">
                                    {/* Severity Tabs */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button 
                                            onClick={() => setLogFilter('ALL')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${logFilter === 'ALL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-[#161b22] text-dark-muted border border-[#30363d] hover:text-white'}`}
                                        >
                                            All ({countAll})
                                        </button>
                                        <button 
                                            onClick={() => setLogFilter('CRITICAL')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${logFilter === 'CRITICAL' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-[#161b22] text-dark-muted border border-[#30363d] hover:text-white'}`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                            Critical ({countCritical})
                                        </button>
                                        <button 
                                            onClick={() => setLogFilter('WARNING')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${logFilter === 'WARNING' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20' : 'bg-[#161b22] text-dark-muted border border-[#30363d] hover:text-white'}`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                            Warning ({countWarning})
                                        </button>
                                        <button 
                                            onClick={() => setLogFilter('INFO')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${logFilter === 'INFO' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-[#161b22] text-dark-muted border border-[#30363d] hover:text-white'}`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            Info ({countInfo})
                                        </button>
                                    </div>

                                    {/* Text Search Input */}
                                    <div className="flex-1 max-w-sm">
                                        <input 
                                            type="text"
                                            value={logSearchQuery}
                                            onChange={(e) => setLogSearchQuery(e.target.value)}
                                            placeholder="Search log message or component..."
                                            className="w-full bg-[#161b22] text-white placeholder-gray-500 rounded-xl px-4 py-2 text-xs border border-[#30363d] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Logs Table */}
                                <div className="overflow-x-auto rounded-xl border border-[#30363d] max-h-96 scrollbar-thin scrollbar-thumb-gray-600 bg-[#0d1117]">
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-[#161b22] border-b border-[#30363d] text-[10px] text-dark-muted uppercase font-bold tracking-widest">
                                                <th className="py-4 px-6 w-20">Line</th>
                                                <th className="py-4 px-6 w-28 text-center">Severity</th>
                                                <th className="py-4 px-6 w-36">Component</th>
                                                <th className="py-4 px-6 w-auto">Log Message</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#30363d]/40 font-mono text-xs">
                                            {filteredLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center text-dark-muted">
                                                        No log lines match the active search and filter constraints.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredLogs.map((log, i) => {
                                                    const isCritical = log.severity === 'CRITICAL';
                                                    const isWarning = log.severity === 'WARNING';
                                                    const isSelected = selectedTableLogLine?.line === log.line;
                                                    
                                                    let sevColor = "bg-green-500/10 text-green-500 border border-green-500/20";
                                                    let textColor = "text-gray-400";
                                                    if (isCritical) {
                                                        sevColor = "bg-red-500/10 text-red-500 border border-red-500/20";
                                                        textColor = "text-red-200 font-bold bg-red-950/20";
                                                    } else if (isWarning) {
                                                        sevColor = "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20";
                                                        textColor = "text-yellow-100 font-medium bg-yellow-950/10";
                                                    }

                                                    return (
                                                        <tr 
                                                            key={i} 
                                                            onClick={() => {
                                                                setSelectedTableLogLine(log);
                                                                setPresetLogText(log.content);
                                                            }}
                                                            className={`transition-colors cursor-pointer hover:bg-blue-600/10 ${isCritical ? 'bg-red-950/5' : ''} ${isSelected ? 'bg-blue-500/20 border-l-2 border-blue-500' : ''}`}
                                                            title="Click to view detailed diagnostics and query AI Log Assistant"
                                                        >
                                                            <td className="py-3 px-6 text-dark-muted font-bold">{log.line}</td>
                                                            <td className="py-3 px-6 text-center">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${sevColor}`}>
                                                                    {log.severity}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-6 text-blue-400 font-semibold truncate">{log.component}</td>
                                                            <td className={`py-3 px-6 truncate font-medium ${textColor}`} title={log.content}>
                                                                {log.content}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Detailed Log Line Diagnostic Audit Card */}
                            {selectedTableLogLine && offlineDiag && (
                                <div className="bg-[#161b22] border-2 border-blue-500/30 rounded-[2rem] p-8 lg:p-10 shadow-2xl animate-in slide-in-from-top duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[#30363d] pb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-600/10 p-3 rounded-2xl border border-blue-500/20">
                                                <Terminal className="text-blue-400 w-6 h-6 animate-pulse" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-white uppercase tracking-tight italic">Log Line Diagnostics</h4>
                                                <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest mt-0.5">
                                                    Detailed audit analysis for line #{selectedTableLogLine.line}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                selectedTableLogLine.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                selectedTableLogLine.severity === 'WARNING' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                                                'bg-green-500/10 text-green-500 border border-green-500/20'
                                            }`}>
                                                {selectedTableLogLine.severity}
                                            </span>
                                            <span className="text-xs text-blue-400 font-bold bg-[#0d1117] border border-[#30363d] px-3 py-1 rounded-xl">
                                                {selectedTableLogLine.component}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-xs font-medium leading-relaxed mb-6">
                                        {/* Raw message block */}
                                        <div className="lg:col-span-12">
                                            <span className="text-[9px] text-dark-muted font-bold uppercase tracking-wider block mb-1.5">Raw Telemetry Log Message</span>
                                            <pre className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] font-mono text-xs text-white whitespace-pre-wrap break-all select-all">
                                                {selectedTableLogLine.content}
                                            </pre>
                                        </div>

                                        {/* Explanation */}
                                        <div className="lg:col-span-6 space-y-2">
                                            <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block">Incident Explanation</span>
                                            <p className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] text-gray-300 leading-relaxed text-xs">
                                                {offlineDiag.explanation}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="lg:col-span-6 space-y-2">
                                            <span className="text-[9px] text-orange-400 font-bold uppercase tracking-wider block">Suggested Remediation Actions</span>
                                            <div className="bg-[#0d1117] p-4 rounded-xl border border-red-500/15 text-gray-300">
                                                <ul className="list-decimal pl-4 space-y-2">
                                                    {offlineDiag.remediations.map((step, idx) => (
                                                        <li key={idx} className="marker:text-blue-500 text-xs font-bold leading-normal">{step}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#30363d]">
                                        <p className="text-[10px] text-dark-muted font-medium italic">
                                            Tip: Click 'Query AI Log Assistant' to sync this log and chat about custom resolutions.
                                        </p>
                                        
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => {
                                                    // Scroll to the LogAssistant at the top
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center gap-1.5"
                                            >
                                                Query AI Log Assistant
                                            </button>
                                            <button 
                                                onClick={() => setSelectedTableLogLine(null)}
                                                className="bg-[#0d1117] hover:bg-[#161b22] text-dark-text border border-[#30363d] px-6 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* 6. Remediation Grid */}
                {result && (
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
                        <div className="xl:col-span-3">
                            <FixesPanel 
                                fixes={result.possible_fixes} 
                                onFixClick={handleFixClick}
                            />
                        </div>
                        <div>
                            <HistoryTimeline history={history} />
                        </div>
                    </div>
                )}

                {!result && !isUploading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/10 blur-[40px] animate-pulse" />
                            <div className="relative bg-[#161b22] p-6 rounded-[2rem] border border-[#30363d] shadow-2xl">
                                <Sparkles className="w-10 h-10 text-blue-500" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-black text-white tracking-tighter italic uppercase">AI Neural Auditor Panel</h2>
                            <p className="text-dark-muted max-w-md mx-auto font-medium text-xs leading-relaxed">
                                Ready to analyze live system nodes. Drag & drop or browse a system log above to activate topological analysis.
                            </p>
                        </div>
                    </div>
                )}
            </main>

            {/* Viewport-Fixed Node Diagnostics Modal Backdrop */}
            {selectedNode && (
                <div 
                    className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedNode(null)}
                >
                    <div 
                        className="bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] max-w-md w-full p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button 
                            onClick={() => setSelectedNode(null)}
                            className="absolute top-6 right-6 text-dark-muted hover:text-white p-2 hover:bg-[#30363d] rounded-full transition-colors animate-in"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        
                        {/* Title & Status */}
                        <div className="flex items-center gap-4 border-b border-[#30363d] pb-4">
                            <div className={`p-3 rounded-2xl ${selectedNode.status === 'ok' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                                {selectedNode.status === 'ok' ? (
                                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                                ) : (
                                    <AlertCircle className="w-6 h-6 text-red-500 animate-pulse" />
                                )}
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-white font-mono">{selectedNode.label}</h4>
                                <p className={`text-[9px] font-black uppercase tracking-wider ${selectedNode.status === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
                                    {selectedNode.status === 'ok' ? 'System Operational' : 'Critical Warning / Error'}
                                </p>
                            </div>
                        </div>

                        {/* Detailed Explanations */}
                        <div className="space-y-4 text-xs font-medium leading-relaxed">
                            <div>
                                <span className="text-[9px] text-dark-muted font-bold uppercase tracking-wider block mb-1.5">Component Definition</span>
                                <p className="bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d] text-gray-300">
                                    {selectedNode.definition}
                                </p>
                            </div>
                            
                            <div>
                                <span className="text-[9px] text-dark-muted font-bold uppercase tracking-wider block mb-1.5">Live Log Status</span>
                                <p className="bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d] font-mono text-dark-text max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
                                    {selectedNode.desc}
                                </p>
                            </div>
                            
                            {selectedNode.status !== 'ok' && selectedNode.remediation && selectedNode.remediation.length > 0 && (
                                <div>
                                    <span className="text-[9px] text-orange-400 font-bold uppercase tracking-wider block mb-1.5">Remediation Checklist</span>
                                    <div className="bg-[#0d1117] p-4 rounded-xl border border-red-500/15 space-y-2 text-gray-300">
                                        <ul className="list-decimal pl-4 space-y-1.5 text-dark-text font-bold">
                                            {selectedNode.remediation.map((step, idx) => (
                                                <li key={idx} className="marker:text-blue-500">{step}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-[#30363d]">
                            <button 
                                onClick={() => setSelectedNode(null)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Viewport-Fixed Pipeline Step Info Modal Backdrop */}
            {selectedPipelineStep && (() => {
                const stepInfo = getPipelineStepDetails(selectedPipelineStep);
                if (!stepInfo) return null;
                return (
                    <div 
                        className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setSelectedPipelineStep(null)}
                    >
                        <div 
                            className="bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] max-w-lg w-full p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-left"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close button */}
                            <button 
                                onClick={() => setSelectedPipelineStep(null)}
                                className="absolute top-6 right-6 text-dark-muted hover:text-white p-2 hover:bg-[#30363d] rounded-full transition-colors animate-in"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            
                            {/* Title & Icon */}
                            <div className="flex items-center gap-4 border-b border-[#30363d] pb-4">
                                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                    {stepInfo.icon}
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-tight italic">{stepInfo.title}</h4>
                                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest mt-0.5">
                                        {stepInfo.summary}
                                    </p>
                                </div>
                            </div>

                            {/* Detailed Description */}
                            <div className="space-y-4 text-xs font-medium leading-relaxed text-gray-300">
                                <div>
                                    <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block mb-1.5">Pipeline Core Function</span>
                                    <p className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] text-gray-300 text-xs">
                                        {stepInfo.description}
                                    </p>
                                </div>
                                
                                <div>
                                    <span className="text-[9px] text-dark-muted font-bold uppercase tracking-wider block mb-1.5">Executed Actions & Metrics</span>
                                    <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] space-y-2">
                                        <ul className="list-disc pl-4 space-y-1.5 text-gray-300">
                                            {stepInfo.checklist.map((step, idx) => (
                                                <li key={idx} className="marker:text-blue-500">{step}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-[#30363d]">
                                <button 
                                    onClick={() => setSelectedPipelineStep(null)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <ChatWindow 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                logContext={result?.raw_log || ''}
                anomalyDetails={result}
                externalMessage={externalChatMsg}
            />
        </div>
    );
};

export default App;
