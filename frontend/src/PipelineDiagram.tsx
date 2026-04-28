import React from 'react';
import { Upload, Cpu, Brain, Database, LineChart, ShieldCheck } from 'lucide-react';

const PipelineDiagram: React.FC = () => {
    const stages = [
        { id: 1, name: "Log Source", sub: "Frontend Upload", icon: <Upload className="w-6 h-6" />, color: "blue" },
        { id: 2, name: "Ingestion", sub: "FastAPI Gateway", icon: <ShieldCheck className="w-6 h-6" />, color: "purple" },
        { id: 3, name: "Pre-processing", sub: "Feature Extraction", icon: <Cpu className="w-6 h-6" />, color: "orange" },
        { id: 4, name: "LSTM Analysis", sub: "Inference Engine", icon: <Brain className="w-6 h-6" />, color: "red" },
        { id: 5, name: "Persistence", sub: "Postgres/Logs", icon: <Database className="w-6 h-6" />, color: "green" },
        { id: 6, name: "Visualization", sub: "React Dashboard", icon: <LineChart className="w-6 h-6" />, color: "indigo" },
    ];

    return (
        <div className="bg-[#161b22] border-2 border-[#30363d] rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">System Data Pipeline Architecture</h2>
                    <p className="text-xs text-dark-muted mt-1 uppercase tracking-widest font-bold">End-to-End Log Lifecycle</p>
                </div>
                <div className="px-4 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] text-blue-500 font-bold uppercase tracking-widest">
                    Live Data Flow
                </div>
            </div>

            <div className="relative flex items-center justify-between gap-4 py-8">
                {/* Horizontal Line Background */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-green-500/20 -translate-y-1/2 z-0" />

                {stages.map((stage, index) => (
                    <div key={stage.id} className="relative z-10 flex flex-col items-center group">
                        {/* Stage Node */}
                        <div className={`w-16 h-16 rounded-2xl bg-[#0d1117] border-2 border-[#30363d] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:border-${stage.color}-500 shadow-xl`}>
                            <div className={`text-${stage.color}-500 transition-transform group-hover:rotate-12`}>
                                {stage.icon}
                            </div>
                        </div>
                        
                        {/* Connector Arrow (Except for last) */}
                        {index < stages.length - 1 && (
                            <div className="absolute top-1/2 -right-8 -translate-y-1/2 text-dark-muted animate-pulse hidden lg:block">
                                <span className="text-xl">→</span>
                            </div>
                        )}

                        <div className="mt-4 text-center">
                            <p className="text-[11px] font-black text-white uppercase tracking-tighter">{stage.name}</p>
                            <p className="text-[9px] text-dark-muted font-bold whitespace-nowrap">{stage.sub}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PipelineDiagram;
