import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AnomalyCardProps {
    status: 'normal' | 'anomaly';
    confidence: number;
    aiExplanation?: string;
}

const AnomalyCard: React.FC<AnomalyCardProps> = ({ status, confidence, aiExplanation }) => {
    const isAnomaly = status === 'anomaly';
    const color = isAnomaly ? '#f85149' : '#2ea043';
    
    // Circular progress math
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (confidence / 100) * circumference;

    return (
        <div className={`bg-[#161b22] border rounded-xl p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300
            ${isAnomaly ? 'border-red-500/50 shadow-[0_0_20px_rgba(248,81,73,0.1)]' : 'border-green-500/50 shadow-[0_0_20px_rgba(46,160,67,0.1)]'}`}>
            
            <h2 className="text-lg font-semibold text-white">Anomaly Status</h2>
            
            <div className="relative flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="#30363d"
                        strokeWidth="8"
                        fill="transparent"
                    />
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke={color}
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{confidence}%</span>
                    <span className="text-[10px] text-dark-muted uppercase font-bold tracking-widest">Confidence</span>
                </div>
            </div>

            <div className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm uppercase tracking-wider
                ${isAnomaly ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                {isAnomaly ? (
                    <><AlertTriangle className="w-4 h-4" /> Anomaly Detected</>
                ) : (
                    <><CheckCircle className="w-4 h-4" /> Normal Operation</>
                )}
            </div>
            {aiExplanation && isAnomaly && (
                <div className="mt-6 p-4 bg-[#24283b] border border-gray-700 rounded-lg w-full text-left overflow-y-auto max-h-64 scrollbar-thin scrollbar-thumb-gray-600">
                    <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">AI Automated Diagnostic</h3>
                    <div className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none prose-pre:bg-[#1a1b26] prose-pre:border prose-pre:border-gray-800">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiExplanation}
                        </ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnomalyCard;
