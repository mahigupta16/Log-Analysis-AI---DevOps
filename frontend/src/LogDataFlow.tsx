import React from 'react';
import { FileText, Search, Database, Fingerprint, Activity, ArrowRight, AlertTriangle } from 'lucide-react';

interface LogDataFlowProps {
    filename: string;
    metrics: { errors: number; cpu: number; disk: number };
}

const LogDataFlow: React.FC<LogDataFlowProps> = ({ filename, metrics }) => {
    const hasErrors = metrics.errors > 0;
    const hasHighCpu = metrics.cpu > 5;
    const hasDiskIssues = metrics.disk > 5;

    const steps = [
        { 
            id: 'raw', 
            name: "Raw Ingestion", 
            detail: filename || "log_file.txt", 
            icon: <FileText className="w-6 h-6" />, 
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            glow: "shadow-blue-500/10"
        },
        { 
            id: 'regex', 
            name: "Regex Parsing", 
            detail: "Pattern Matching", 
            icon: <Search className="w-6 h-6" />, 
            color: "text-purple-500",
            bg: "bg-purple-500/10",
            glow: "shadow-purple-500/10"
        },
        { 
            id: 'features', 
            name: "Feature Matrix", 
            detail: `E:${metrics.errors} | C:${metrics.cpu} | D:${metrics.disk}`, 
            icon: hasErrors ? <AlertTriangle className="w-6 h-6" /> : <Fingerprint className="w-6 h-6" />, 
            color: hasErrors ? "text-red-500" : "text-orange-500",
            bg: hasErrors ? "bg-red-500/10" : "bg-orange-500/10",
            glow: hasErrors ? "shadow-red-500/30" : "shadow-orange-500/10",
            animate: hasErrors ? "animate-pulse border-red-500/50" : ""
        },
        { 
            id: 'lstm', 
            name: "LSTM Inference", 
            detail: "Neural Decision", 
            icon: <Activity className="w-6 h-6" />, 
            color: hasErrors ? "text-red-500" : "text-blue-500",
            bg: hasErrors ? "bg-red-500/10" : "bg-blue-500/10",
            glow: hasErrors ? "shadow-red-500/20" : "shadow-blue-500/10"
        },
        { 
            id: 'result', 
            name: "Audit Success", 
            detail: "Data Persisted", 
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
            
            <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter italic uppercase">Live Log Extraction Pipeline</h2>
                    <p className="text-[10px] text-dark-muted font-bold uppercase tracking-[0.4em] mt-2">Proprietary LSTM Data Processing Model</p>
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

            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center gap-6 group">
                            <div className={`w-24 h-24 rounded-3xl ${step.bg} border-2 border-[#30363d] flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-2xl ${step.glow} ${step.animate}`}>
                                <div className={`${step.color} transition-transform group-hover:rotate-6`}>
                                    {step.icon}
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-white uppercase tracking-tight">{step.name}</p>
                                <div className="mt-2 inline-block bg-[#0d1117] px-3 py-1.5 rounded-lg border border-[#30363d] shadow-inner">
                                    <p className={`text-[10px] font-mono font-bold ${step.id === 'features' && hasErrors ? 'text-red-500' : 'text-dark-muted'}`}>
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
        </div>
    );
};

export default LogDataFlow;
