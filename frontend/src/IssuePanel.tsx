import React from 'react';
import { Info, Server, Search, Terminal } from 'lucide-react';

interface IssuePanelProps {
    issue: string;
    node: string;
    reason: string;
}

const IssuePanel: React.FC<IssuePanelProps> = ({ issue, node, reason }) => {
    return (
        <div className="bg-[#161b22] border-2 border-[#30363d] rounded-2xl p-5 h-full w-full shadow-2xl transition-all hover:border-blue-500/30 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-500/10 p-1.5 rounded-lg">
                        <Terminal className="text-blue-500 w-5 h-5" />
                    </div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Root Cause</h2>
                </div>
                <span className="text-[8px] bg-blue-500/10 text-blue-500 font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-blue-500/20">
                    AI Insights
                </span>
            </div>

            <div className="space-y-3">
                <div className="group">
                    <label className="text-[8px] font-black text-dark-muted uppercase tracking-wider block mb-1.5 group-hover:text-blue-400 transition-colors">Primary Incident</label>
                    <div className="text-white text-xs font-bold bg-[#0d1117] p-3 rounded-xl border border-[#30363d] shadow-inner leading-normal">
                        {issue || 'No issues detected'}
                    </div>
                </div>

                <div className="flex items-start gap-4 p-2.5 rounded-xl bg-[#0d1117]/50 border border-[#30363d]/50 hover:bg-[#0d1117] transition-all">
                    <div className="bg-orange-500/10 p-2 rounded-lg mt-0.5">
                        <Server className="text-orange-500 w-4 h-4" />
                    </div>
                    <div>
                        <label className="text-[8px] font-black text-dark-muted uppercase tracking-wider block mb-0.5">Impacted Infrastructure</label>
                        <p className="text-white font-mono text-xs font-medium">{node || 'N/A'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-purple-500">
                        <Search className="w-4 h-4" />
                        <label className="text-[8px] font-black uppercase tracking-wider">Technician Summary</label>
                    </div>
                    <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d] shadow-inner">
                        <p className="text-[11px] text-dark-text leading-relaxed font-medium">
                            {reason || 'System is operating within normal parameters.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IssuePanel;
