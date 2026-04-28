import React from 'react';
import { BrainCircuit, Loader2, ShieldCheck, Search } from 'lucide-react';

const AnalysisLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0d1117]/90 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="relative flex flex-col items-center">
                {/* Outer Glow */}
                <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full animate-pulse" />
                
                {/* Neural Core Animation */}
                <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full animate-ping" />
                    <div className="absolute inset-2 border-2 border-blue-500/40 border-dashed rounded-full animate-[spin_4s_linear_infinite]" />
                    <div className="bg-blue-600 p-6 rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.5)] z-10">
                        <BrainCircuit className="w-12 h-12 text-white animate-pulse" />
                    </div>
                </div>

                <div className="text-center space-y-4">
                    <h2 className="text-3xl font-black text-white tracking-tighter italic uppercase">Neural Analysis in Progress</h2>
                    <div className="flex items-center justify-center gap-4 text-blue-500 font-bold tracking-widest text-[10px] uppercase">
                        <span className="flex items-center gap-2"><Search className="w-3 h-3" /> Parsing Patterns</span>
                        <span className="w-1.5 h-1.5 bg-blue-500/30 rounded-full" />
                        <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Running LSTM</span>
                        <span className="w-1.5 h-1.5 bg-blue-500/30 rounded-full" />
                        <span className="flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Auditing Health</span>
                    </div>
                    
                    <div className="w-64 h-1 bg-[#161b22] rounded-full mt-8 overflow-hidden mx-auto border border-[#30363d]">
                        <div className="h-full bg-blue-600 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
            `}</style>
        </div>
    );
};

export default AnalysisLoader;
