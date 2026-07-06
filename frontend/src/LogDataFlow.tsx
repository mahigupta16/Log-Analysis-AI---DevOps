import React from 'react';
import { FileText, Search, Database, Fingerprint, Activity, ArrowRight, AlertTriangle, Info, HelpCircle } from 'lucide-react';

interface LogDataFlowProps {
    filename: string;
    metrics: { errors: number; cpu: number; disk: number };
    status: 'normal' | 'anomaly';
    confidence: number;
    detectedIssue: string;
    whyItFailed: string;
    onStepClick?: (stepId: string) => void;
}

const LogDataFlow: React.FC<LogDataFlowProps> = ({ 
    filename, 
    metrics, 
    status, 
    confidence, 
    detectedIssue, 
    whyItFailed, 
    onStepClick 
}) => {
    const hasErrors = status === 'anomaly';

    const steps = [
        { 
            id: 'raw', 
            name: "Upload Log", 
            detail: filename || "No file uploaded", 
            icon: <FileText className="w-6 h-6" />, 
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            glow: "shadow-blue-500/10"
        },
        { 
            id: 'regex', 
            name: "Parse Text", 
            detail: "Separating timestamps & tags", 
            icon: <Search className="w-6 h-6" />, 
            color: "text-purple-500",
            bg: "bg-purple-500/10",
            glow: "shadow-purple-500/10"
        },
        { 
            id: 'features', 
            name: "Extract Metrics", 
            detail: hasErrors ? `Found error flags` : "Metrics normal", 
            icon: hasErrors ? <AlertTriangle className="w-6 h-6" /> : <Fingerprint className="w-6 h-6" />, 
            color: hasErrors ? "text-red-500" : "text-orange-500",
            bg: hasErrors ? "bg-red-500/10" : "bg-orange-500/10",
            glow: hasErrors ? "shadow-red-500/30" : "shadow-orange-500/10",
            animate: hasErrors ? "animate-pulse border-red-500/50" : ""
        },
        { 
            id: 'lstm', 
            name: "AI Model Check", 
            detail: hasErrors ? `${confidence}% Confidence Anomaly` : "Pattern Normal", 
            icon: <Activity className="w-6 h-6" />, 
            color: hasErrors ? "text-red-500" : "text-blue-500",
            bg: hasErrors ? "bg-red-500/10" : "bg-blue-500/10",
            glow: hasErrors ? "shadow-red-500/20" : "shadow-blue-500/10"
        },
        { 
            id: 'result', 
            name: "Diagnosis & Action", 
            detail: hasErrors ? "Remediations Ready" : "System Safe", 
            icon: <Database className="w-6 h-6" />, 
            color: "text-green-500",
            bg: "bg-green-500/10",
            glow: "shadow-green-500/10"
        }
    ];

    return (
        <div className="bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] p-12 shadow-2xl relative overflow-hidden transition-all duration-1000">
            {/* Dynamic Background Glow */}
            <div className={`absolute top-0 right-0 w-96 h-96 blur-[150px] -translate-y-1/2 translate-x-1/2 transition-all duration-1000 
                ${hasErrors ? 'bg-red-500/10' : 'bg-blue-500/10'}`} />
            
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter italic uppercase flex items-center gap-2">
                        DevOps AI Log Analysis Flowchart
                    </h2>
                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-[0.2em] mt-2">
                        Visual explanation of how the log was parsed and checked
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="bg-[#0d1117] px-6 py-3 rounded-2xl border border-[#30363d] flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-dark-muted font-bold uppercase">Processing File</span>
                            <span className="text-xs text-blue-500 font-mono font-bold tracking-tight">{filename}</span>
                        </div>
                    </div>
                    <div className="bg-[#0d1117] px-6 py-3 rounded-2xl border border-[#30363d] flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasErrors ? 'bg-red-400' : 'bg-green-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${hasErrors ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        </span>
                        <span className="text-[10px] text-white font-black tracking-[0.2em] uppercase">
                            {hasErrors ? 'Anomaly Detected' : 'Stream Active'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Pipeline Step Circles */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-12">
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <div 
                            onClick={() => onStepClick && onStepClick(step.id)}
                            className="flex flex-col items-center gap-6 group cursor-pointer"
                            title="Click step for database details"
                        >
                            <div className={`w-24 h-24 rounded-3xl ${step.bg} border-2 border-[#30363d] group-hover:border-blue-500/80 flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-2xl ${step.glow} ${step.animate}`}>
                                <div className={`${step.color} transition-transform group-hover:rotate-6`}>
                                    {step.icon}
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">{step.name}</p>
                                <div className="mt-2 inline-block bg-[#0d1117] px-3 py-1.5 rounded-lg border border-[#30363d] shadow-inner group-hover:border-blue-500/30 transition-colors">
                                    <p className={`text-[9px] font-mono font-bold ${step.id === 'features' && hasErrors ? 'text-red-500' : 'text-dark-muted'}`}>
                                        {step.detail}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`rotate-90 lg:rotate-0 transition-colors duration-1000 ${hasErrors && index >= 2 ? 'text-red-500/40' : 'text-dark-muted/40'}`}>
                                <ArrowRight className="w-8 h-8" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Simple-Terms Detailed Analysis Explanation Panel */}
            <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#30363d] pb-3">
                    <Info size={16} className="text-blue-400" />
                    <span className="text-xs font-black uppercase text-white tracking-wider">How was this log analyzed? (Simple Terms Explanation)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-300 font-medium">
                    <div className="space-y-1.5">
                        <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest block">1. Reading & Parsing</span>
                        <p className="leading-relaxed">
                            The raw text was scanned line by line. Our parsing engine isolated the timestamps, log levels (INFO/WARNING/CRITICAL), and the operating components (like SSHD, systemd, or Postgres) so they could be structured into a table.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest block">2. Feature Counting</span>
                        <p className="leading-relaxed">
                            The engine extracted features (like occurrence counts of write failures, authentication mismatches, or resource warnings). The AI classifier processed these metrics to determine whether the behavior matches normal operations or deviates significantly.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <span className="text-[10px] text-green-400 font-black uppercase tracking-widest block">3. Root Cause Diagnosis</span>
                        <p className="leading-relaxed">
                            {hasErrors ? (
                                <span>
                                    <strong>Anomaly Flagged!</strong> The classifier verified an abnormal pattern (<strong>{detectedIssue}</strong>). The failure reason is: <em>"{whyItFailed}"</em>. DevOps remediation workflows have been generated to repair the node.
                                </span>
                            ) : (
                                <span>
                                    <strong>All Clear.</strong> The AI evaluated the logs and confirmed they follow the healthy system baseline. No event sequence patterns matched known failure codes. Node operations are normal.
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogDataFlow;
