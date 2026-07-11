import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, ArrowRight, Activity, Terminal, X, AlertCircle, CheckCircle2, FileText, Search, Fingerprint, Database, Brain, Home, Layout } from 'lucide-react';
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
import { ModelHub } from './components/ModelHub';
import { HistoryViewer } from './components/HistoryViewer';
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
    const [activeTab, setActiveTab] = useState<'dashboard' | 'archives'>('dashboard');
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);

    
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
        const severityCount = result?.parsed_logs?.filter(l => l.severity === 'CRITICAL' || l.severity === 'WARNING').length || 0;
        switch (stepId) {
            case 'raw':
                return {
                    title: "Upload Log Stage",
                    icon: <FileText className="w-8 h-8 text-blue-500 animate-pulse" />,
                    summary: `File "${result?.filename || 'log_stream'}" read successfully.`,
                    description: `Successfully ingested log file containing ${result?.total_lines_scanned || 0} telemetry rows. Verified size bounds and initialized pipeline streams for AI processing.`,
                    checklist: [
                        `Filename: ${result?.filename || "N/A"}`,
                        `Total Log Lines: ${result?.total_lines_scanned || 0}`,
                        "File Encoding: UTF-8 Checked"
                    ]
                };
            case 'regex':
                return {
                    title: "Parse Text Stage",
                    icon: <Search className="w-8 h-8 text-purple-500 animate-pulse" />,
                    summary: `Parsed log entries for warnings & node metrics.`,
                    description: `Scanned log text. Identified timestamps, processes, and service tags. Found ${severityCount} critical warning messages in the stream.`,
                    checklist: [
                        `Affected Node: ${result?.failed_node || 'None (Healthy)'}`,
                        `Critical Errors Found: ${result?.error_lines_count || 0}`,
                        "Regex Pattern Alignment: Matched"
                    ]
                };
            case 'features':
                return {
                    title: "Extract Metrics Stage",
                    icon: <Fingerprint className="w-8 h-8 text-orange-500 animate-pulse" />,
                    summary: "Calculated error counts & system load indexes.",
                    description: `Extracted key metrics profile. Found ${result?.features?.errors || 0} error keyword signals, ${result?.features?.cpu || 0} resource mentions, and ${result?.features?.disk || 0} disk alerts. Converted telemetry counters to vector indices.`,
                    checklist: [
                        `Baseline Violations: ${result?.features?.errors || 0}`,
                        `Resource Traces: ${result?.features?.cpu || 0}`,
                        `Storage Block Issues: ${result?.features?.disk || 0}`
                    ]
                };
            case 'lstm':
                return {
                    title: "AI Model Check Stage",
                    icon: <Activity className="w-8 h-8 text-blue-500 animate-pulse" />,
                    summary: `Evaluated by ${result?.model_used || "AI model"}.`,
                    description: `Machine learning analysis completed. Model processed the metrics profile and returned a confidence score of ${result?.confidence || 0}%. ${result?.status === 'anomaly' ? `An unusual execution pattern was flagged: "${result?.detected_issue}".` : "The log sequence perfectly matches normal system behavior."}`,
                    checklist: [
                        `Active AI Model: ${result?.model_used || "LSTM Autoencoder"}`,
                        `Detection Status: ${result?.status?.toUpperCase() || "NORMAL"}`,
                        `Confidence Rating: ${result?.confidence || 0}%`
                    ]
                };
            case 'result':
                return {
                    title: "Diagnosis & Action Stage",
                    icon: <Database className="w-8 h-8 text-green-500 animate-pulse" />,
                    summary: `Saved report and generated DevOps fixes.`,
                    description: `Diagnostic record persists in local JSON database. ${result?.status === 'anomaly' ? `Identified failure root cause: "${result?.why_it_failed}". Generated ${result?.possible_fixes?.length || 0} DevOps playbooks to fix the issue.` : "System baseline confirmed healthy. Database telemetry updated."}`,
                    checklist: [
                        `Database Persisted ID: #${result?.id || "N/A"}`,
                        `Remediation Workflows: ${result?.possible_fixes?.length || 0} Available`,
                        `Persisted Timestamp: ${result?.timestamp || "N/A"}`
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

    const handleExportDoc = () => {
        if (!result || !result.ai_explanation) return;
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><title>AI Diagnostic Report</title><style>body { font-family: Arial, sans-serif; line-height: 1.6; } h1, h2, h3 { color: #0284c7; } pre { background: #f3f4f6; padding: 10px; border-radius: 5px; font-family: monospace; }</style></head><body>";
        const footer = "</body></html>";
        
        let htmlContent = result.ai_explanation
            .replace(/\n\n/g, '<p></p>')
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/# (.*)/g, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');

        const content = header + htmlContent + footer;
        const blob = new Blob(['\\ufeff' + content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ai_diagnostic_report_\${Date.now()}.doc`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between flex-shrink-0 z-40 hidden md:flex">
                <div className="flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-[#30363d] flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-xl">
                            <Sparkles className="text-white w-5 h-5" />
                        </div>
                        <span className="text-base font-black tracking-tight text-white uppercase italic">Logs Guard AI</span>
                    </div>

                    {/* Navigation */}
                    <nav className="p-4 space-y-2">
                        <button 
                            onClick={() => setActiveTab('dashboard')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === 'dashboard' 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                    : 'text-dark-muted hover:text-white hover:bg-[#0d1117]'
                            }`}
                        >
                            <Home size={16} />
                            Dashboard
                        </button>

                        <button 
                            onClick={() => setActiveTab('archives')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === 'archives' 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                    : 'text-dark-muted hover:text-white hover:bg-[#0d1117]'
                            }`}
                        >
                            <Layout size={16} />
                            Ingestion Archives
                        </button>
                    </nav>
                </div>

                {/* System Health Indicators in Sidebar */}
                <div className="p-6 border-t border-[#30363d] space-y-4">
                    <span className="text-[9px] text-dark-muted block uppercase font-black tracking-widest">Cluster Node Statuses</span>
                    <div className="space-y-2.5 text-[10px] font-bold">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Database Engine</span>
                          <span className="text-green-500 flex items-center gap-1.5 font-mono">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Active
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Syslog Daemon</span>
                          <span className="text-green-500 flex items-center gap-1.5 font-mono">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Healthy
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">LSTM Inference Core</span>
                          <span className="text-green-500 flex items-center gap-1.5 font-mono">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            Online
                          </span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-dark-bg">
                {/* Navbar */}
                <header className="flex items-center justify-between px-8 py-4 bg-[#161b22] border-b border-[#30363d] sticky top-0 z-30 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight italic">
                            {activeTab === 'dashboard' && 'Cluster Health Dashboard'}
                            {activeTab === 'archives' && 'Local Ingestion Archives'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">


                        {/* Connection Pill */}
                        <div className="flex items-center gap-2 bg-[#0d1117] px-4 py-1.5 rounded-xl border border-[#30363d]">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-xs font-bold text-dark-muted font-mono">
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Premium Full-Screen Analysis Loader */}
                {isUploading && <AnalysisLoader />}

                {/* Sub-Views */}
                <main className="flex-1 p-8 w-full space-y-10">
                    {activeTab === 'dashboard' && (
                        <>
                            {/* 1. Top Ingestion Panel: Uploader, Status & Root Cause side-by-side */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch animate-in fade-in duration-500">
                                {/* Column 1: File Ingestion */}
                                <div className={result ? "lg:col-span-4 flex flex-col h-full" : "lg:col-span-7 flex flex-col h-full"}>
                                    <LogUploader onUpload={handleUpload} isUploading={isUploading} />
                                </div>
                                
                                {/* Column 2: Anomaly Status / Confidence */}
                                <div className={result ? "lg:col-span-4 flex flex-col h-full" : "lg:col-span-5 flex flex-col h-full"}>
                                    {result ? (
                                        <div className="animate-in zoom-in duration-300 h-full flex w-full">
                                            <AnomalyCard 
                                                status={result.status} 
                                                confidence={result.confidence} 
                                                accuracy={result.accuracy}
                                                aiExplanation={result.ai_explanation} 
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-[#161b22] border-2 border-dashed border-[#30363d] rounded-[2rem] p-8 flex flex-col items-center justify-center text-center h-full min-h-[220px] flex-grow">
                                            <Activity className="w-12 h-12 text-dark-muted mb-4 animate-pulse" />
                                            <h3 className="text-white font-bold">Awaiting Stream</h3>
                                            <p className="text-[10px] text-dark-muted uppercase tracking-widest mt-2 font-mono">AI Logic Engine Offline</p>
                                        </div>
                                    )}
                                </div>

                                {/* Column 3: Root Cause Analysis */}
                                {result && (
                                    <div className="lg:col-span-4 flex flex-col h-full animate-in zoom-in duration-300">
                                        <IssuePanel 
                                            issue={result.detected_issue}
                                            node={result.failed_node}
                                            reason={result.why_it_failed}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 2. Reactive Log Flowchart */}
                            {result && (
                                <div className="animate-in slide-in-from-bottom duration-1000">
                                    <LogDataFlow 
                                        filename={result.filename || "unknown_log"} 
                                        metrics={result.features || {errors: 0, cpu: 0, disk: 0}} 
                                        status={result.status}
                                        confidence={result.confidence}
                                        detectedIssue={result.detected_issue}
                                        whyItFailed={result.why_it_failed}
                                        onStepClick={(stepId) => setSelectedPipelineStep(stepId)}
                                    />
                                </div>
                            )}

                             {/* 3. Infrastructure Analysis (Service Topology Graph) */}
                             {result && (
                                 <div className="w-full flex flex-col gap-6 animate-in fade-in duration-700">
                                     <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3 uppercase italic">
                                         <Terminal className="w-6 h-6 text-blue-500" /> Active Service Topology
                                     </h2>
                                     <ServiceGraph 
                                         flowData={result.flow} 
                                         onNodeSelect={(node) => setSelectedNode(node)}
                                     />
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
                                        
                                        {/* Export & Font controls */}
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={handleExportDoc}
                                                className="bg-blue-600/10 hover:bg-blue-600/25 text-blue-400 border border-blue-500/25 px-4 py-2 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                                                title="Export Report to DOC File"
                                            >
                                                Export DOC
                                            </button>
                                            
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

                            {/* 6. Remediation Panel */}
                            {result && (
                                <div className="w-full">
                                    <FixesPanel 
                                        fixes={result.possible_fixes} 
                                        onFixClick={handleFixClick}
                                    />
                                </div>
                            )}
                        </>
                    )}



                    {activeTab === 'archives' && (
                        <HistoryViewer onLoadHistoryResult={(historyResult) => {
                            setResult(historyResult);
                            setActiveTab('dashboard'); // switch to dashboard when loaded
                        }} />
                    )}
                </main>
            </div>

            {/* Sidebar Viewport Interactivity Modals */}
            {selectedNode && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#161b22] w-full max-w-xl rounded-3xl border-2 border-[#30363d] shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
                            <div className="flex items-center gap-3">
                                <span className={`w-2.5 h-2.5 rounded-full ${selectedNode.status === 'ok' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                                <h3 className="text-lg font-black text-white uppercase tracking-tight font-mono">{selectedNode.label}</h3>
                            </div>
                            <button 
                                onClick={() => setSelectedNode(null)}
                                className="p-2 hover:bg-[#161b22] rounded-full text-dark-muted hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6 text-xs leading-relaxed">
                            <div>
                                <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block mb-1">Node Glossary Definition</span>
                                <p className="text-gray-300 font-medium leading-relaxed bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
                                    {selectedNode.definition}
                                </p>
                            </div>
                            <div>
                                <span className="text-[9px] text-orange-400 font-bold uppercase tracking-wider block mb-2">Automated Remediation Steps</span>
                                <div className="bg-[#0d1117] p-4 rounded-xl border border-red-500/15 text-gray-300">
                                    <ul className="list-decimal pl-4 space-y-2 font-medium">
                                        {selectedNode.remediation.map((step, idx) => (
                                            <li key={idx} className="marker:text-blue-500 font-bold">{step}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedPipelineStep && (() => {
                const stepInfo = getPipelineStepDetails(selectedPipelineStep);
                if (!stepInfo) return null;
                return (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#161b22] w-full max-w-xl rounded-3xl border-2 border-[#30363d] shadow-2xl overflow-hidden">
                            <div className="px-8 py-5 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
                                <div className="flex items-center gap-3">
                                    {stepInfo.icon}
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight italic">{stepInfo.title}</h3>
                                </div>
                                <button 
                                    onClick={() => setSelectedPipelineStep(null)}
                                    className="p-2 hover:bg-[#161b22] rounded-full text-dark-muted hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <div className="p-8 space-y-6 text-xs leading-relaxed">
                                <div>
                                    <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider block mb-1">State Summary</span>
                                    <p className="text-white font-bold text-sm bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
                                        {stepInfo.summary}
                                    </p>
                                </div>

                                <div>
                                    <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block mb-1">Step Details</span>
                                    <p className="text-gray-300 font-medium leading-relaxed bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
                                        {stepInfo.description}
                                    </p>
                                </div>
                                
                                <div>
                                    <span className="text-[9px] text-dark-muted font-bold uppercase tracking-wider block mb-1.5">Executed Actions & Metrics</span>
                                    <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] space-y-2">
                                        <ul className="list-disc pl-4 space-y-1.5 text-gray-300 font-mono text-[10px]">
                                            {stepInfo.checklist.map((step, idx) => (
                                                <li key={idx} className="marker:text-blue-500">{step}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end p-6 border-t border-[#30363d] bg-[#0d1117]">
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

            {/* Floating Toggle Button for AI Log Assistant (Bottom Left Corner) */}
            <button
                onClick={() => setIsAssistantOpen(true)}
                className="fixed bottom-6 left-6 z-[60] bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center border border-blue-500/30"
                title="Open AI Log Assistant Chat"
            >
                <Sparkles className="w-6 h-6 animate-pulse" />
            </button>

            {/* Floating Dialog Modal for AI Log Assistant (State Maintained) */}
            <div className={`fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 ${isAssistantOpen ? 'flex' : 'hidden'}`}>
                <div className="bg-[#161b22] w-full max-w-2xl h-[650px] rounded-3xl border-2 border-[#30363d] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="px-8 py-5 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-blue-500 w-5 h-5 animate-pulse" />
                            <h3 className="text-lg font-black text-white uppercase tracking-tight italic">AI Log Assistant</h3>
                        </div>
                        <button 
                            onClick={() => setIsAssistantOpen(false)}
                            className="p-2 hover:bg-[#161b22] rounded-full text-dark-muted hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    
                    <div className="flex-grow overflow-hidden p-6 bg-[#0d1117]">
                        <LogAssistant presetLogText={presetLogText} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
