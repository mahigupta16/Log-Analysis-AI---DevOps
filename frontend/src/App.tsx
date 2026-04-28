import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, ArrowRight, Activity, Terminal } from 'lucide-react';
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
import { AnomalyResponse, HistoryItem } from './types';

const App: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<AnomalyResponse | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [externalChatMsg, setExternalChatMsg] = useState<string | undefined>(undefined);

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

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text pb-12 overflow-x-hidden">
            <Navbar isConnected={isConnected} />

            {/* Premium Full-Screen Analysis Loader */}
            {isUploading && <AnalysisLoader />}

            <main className="max-w-[98%] mx-auto px-4 lg:px-8 py-8 space-y-10">
                
                {/* 1. Ingestion Area */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3">
                        <LogUploader onUpload={handleUpload} isUploading={isUploading} />
                    </div>
                    <div>
                        {result ? (
                            <AnomalyCard status={result.status} confidence={result.confidence} />
                        ) : (
                            <div className="bg-[#161b22] border-2 border-dashed border-[#30363d] rounded-[2rem] p-8 h-full flex flex-col items-center justify-center text-center">
                                <Activity className="w-12 h-12 text-dark-muted mb-4 animate-pulse" />
                                <h3 className="text-white font-bold">Awaiting Stream</h3>
                                <p className="text-[10px] text-dark-muted uppercase tracking-widest mt-2">LSTM Core Inactive</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Chat Trigger */}
                {result && (
                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-2 border-blue-500/30 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl animate-in zoom-in duration-500">
                        <div className="flex items-center gap-8">
                            <div className="bg-blue-600 p-5 rounded-2xl shadow-xl shadow-blue-600/30 rotate-3 animate-pulse">
                                <Sparkles className="text-white w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Neural Audit Complete</h3>
                                <p className="text-sm text-dark-muted font-medium">Detailed contextual diagnostics are ready for review. Proceed to AI Laboratory?</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsChatOpen(true)}
                            className="bg-white text-black px-12 py-5 rounded-2xl font-black text-xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-2xl hover:shadow-white/10"
                        >
                            Open Detailed Lab <ArrowRight className="w-6 h-6" />
                        </button>
                    </div>
                )}

                {/* 3. Reactive Log Flowchart */}
                {result && (
                    <div className="animate-in slide-in-from-bottom duration-1000">
                        <LogDataFlow 
                            filename={result.filename || "unknown_log"} 
                            metrics={result.features || {errors: 0, cpu: 0, disk: 0}} 
                        />
                    </div>
                )}

                {/* 4. Infrastructure Analysis */}
                {result && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in fade-in duration-700">
                        <div className="xl:col-span-4">
                            <IssuePanel 
                                issue={result.detected_issue}
                                node={result.failed_node}
                                reason={result.why_it_failed}
                            />
                        </div>
                        <div className="xl:col-span-8 flex flex-col gap-6">
                            <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3 uppercase italic">
                                <Terminal className="w-6 h-6 text-blue-500" /> Active Service Topology
                            </h2>
                            <ServiceGraph flowData={result.flow} />
                        </div>
                    </div>
                )}

                {/* 5. Remediation Grid */}
                {result && (
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
                        <div className="xl:col-span-3">
                            <FixesPanel 
                                fixes={result.possible_fixes} 
                                onFixClick={handleFixClick}
                            />
                        </div>
                        <div>
                            <HistoryTimeline history={history} />
                        </div>
                    </div>
                )}

                {!result && !isUploading && (
                    <div className="flex flex-col items-center justify-center py-32 text-center space-y-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 blur-[60px] animate-pulse" />
                            <div className="relative bg-[#161b22] p-10 rounded-[2.5rem] border-2 border-[#30363d] shadow-2xl">
                                <Sparkles className="w-20 h-20 text-blue-500" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">AI Neural Auditor</h2>
                            <p className="text-dark-muted max-w-lg mx-auto font-medium text-lg leading-relaxed">
                                Upload your system manifest or log streams to initiate deep LSTM-based anomaly detection.
                            </p>
                        </div>
                    </div>
                )}
            </main>

            <ChatWindow 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                logContext={result?.raw_log || ''}
                anomalyDetails={result}
                externalMessage={externalChatMsg}
            />
        </div>
    );
};

export default App;
