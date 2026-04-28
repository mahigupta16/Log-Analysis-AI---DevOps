import React from 'react';
import { Info, Server, Search, Terminal } from 'lucide-react';

interface IssuePanelProps {
    issue: string;
    node: string;
    reason: string;
}

const IssuePanel: React.FC<IssuePanelProps> = ({ issue, node, reason }) => {
    return (
        <div className="bg-[#161b22] border-2 border-[#30363d] rounded-2xl p-8 h-full shadow-2xl transition-all hover:border-blue-500/30">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg">
                        <Terminal className="text-blue-500 w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Root Cause Analysis</h2>
                </div>
                <span className="text-[10px] bg-blue-500/10 text-blue-500 font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">
                    AI Insights
                </span>
            </div>

            <div className="space-y-8">
                <div className="group">
                    <label className="text-[10px] font-bold text-dark-muted uppercase tracking-[0.2em] block mb-3 group-hover:text-blue-400 transition-colors">Primary Incident</label>
                    <div className="text-white text-lg font-bold bg-[#0d1117] p-5 rounded-xl border border-[#30363d] shadow-inner">
                        {issue || 'No issues detected'}
                    </div>
                </div>

                <div className="flex items-start gap-5 p-4 rounded-xl bg-[#0d1117]/50 border border-[#30363d]/50 hover:bg-[#0d1117] transition-all">
                    <div className="bg-orange-500/10 p-3 rounded-lg mt-1">
                        <Server className="text-orange-500 w-5 h-5" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-dark-muted uppercase tracking-widest block mb-1">Impacted Infrastructure</label>
                        <p className="text-white font-mono text-base font-medium">{node || 'N/A'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-purple-500">
                        <Search className="w-5 h-5" />
                        <label className="text-[10px] font-bold uppercase tracking-widest">Technician Summary</label>
                    </div>
                    <div className="bg-[#0d1117] p-5 rounded-xl border border-[#30363d] shadow-inner">
                        <p className="text-sm text-dark-text leading-relaxed font-medium">
                            {reason || 'System is operating within normal parameters.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IssuePanel;
