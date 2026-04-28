import React, { useState } from 'react';
import { Wrench, Copy, Check, ShieldAlert, MessageCircle } from 'lucide-react';

interface FixesPanelProps {
    fixes: string[];
    onFixClick: (fix: string) => void;
}

const FixesPanel: React.FC<FixesPanelProps> = ({ fixes, onFixClick }) => {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const copyToClipboard = (e: React.MouseEvent, text: string, index: number) => {
        e.stopPropagation(); // Don't trigger the card click
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="bg-[#161b22] border-2 border-[#30363d] rounded-2xl p-8 h-full shadow-2xl transition-all hover:border-green-500/30">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-green-500/10 p-2 rounded-lg">
                        <Wrench className="text-green-500 w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">AI Suggested Remediation</h2>
                </div>
                {fixes.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                        <ShieldAlert className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">High Priority</span>
                    </div>
                )}
            </div>

            {fixes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fixes.map((fix, index) => (
                        <div 
                            key={index} 
                            onClick={() => onFixClick(fix)}
                            className="group relative flex items-center justify-between bg-[#0d1117] p-5 rounded-xl border border-[#30363d] hover:border-blue-500/50 hover:bg-[#161b22] transition-all duration-300 shadow-lg cursor-pointer"
                        >
                            <div className="flex items-start gap-4">
                                <span className="bg-[#30363d] text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg mt-0.5 group-hover:bg-blue-600 transition-colors">
                                    {index + 1}
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-dark-text leading-tight pr-12">{fix}</p>
                                    <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MessageCircle className="w-3 h-3" /> Click to explain deeper
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => copyToClipboard(e, fix, index)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white transition-all p-2 bg-[#1c2128] rounded-lg border border-[#30363d] z-10"
                                title="Copy Command"
                            >
                                {copiedIndex === index ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0d1117]/30 rounded-xl border-2 border-dashed border-[#30363d]">
                    <div className="bg-green-500/10 p-4 rounded-full mb-4">
                        <Check className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-dark-muted text-sm font-medium">No corrective actions required. System is stable.</p>
                </div>
            )}
        </div>
    );
};

export default FixesPanel;
