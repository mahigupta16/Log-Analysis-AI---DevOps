import React from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { HistoryItem } from './types';

interface HistoryTimelineProps {
    history: HistoryItem[];
}

const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ history }) => {
    return (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
                <Clock className="text-blue-500 w-5 h-5" />
                <h2 className="text-lg font-semibold text-white">Log History Timeline</h2>
            </div>

            <div className="relative border-l-2 border-[#30363d] ml-2 pl-6 space-y-8">
                {history.length > 0 ? history.map((item, index) => (
                    <div key={index} className="relative">
                        {/* Dot */}
                        <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-[#161b22]
                            ${item.status === 'anomaly' ? 'bg-red-500' : 'bg-green-500'}`} />
                        
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white">{item.filename}</h3>
                                <span className="text-[10px] font-mono text-dark-muted">{item.timestamp}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
                                    ${item.status === 'anomaly' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                    {item.status}
                                </span>
                                <span className="text-[10px] text-dark-muted">{item.confidence}% confidence</span>
                            </div>
                        </div>
                    </div>
                )) : (
                    <p className="text-sm text-dark-muted italic">No history records found.</p>
                )}
            </div>
        </div>
    );
};

export default HistoryTimeline;
