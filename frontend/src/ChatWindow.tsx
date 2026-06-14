import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, User, Bot, Sparkles, X, Terminal, BrainCircuit } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatWindowProps {
    isOpen: boolean;
    onClose: () => void;
    logContext: string;
    anomalyDetails: any;
    externalMessage?: string; // New: To handle clicks from FixesPanel
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose, logContext, anomalyDetails, externalMessage }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Initial greeting
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                role: 'assistant',
                content: `👋 Hello! I'm your Senior DevOps AI Buddy. I've analyzed your log file and found a **${anomalyDetails?.status === 'anomaly' ? 'Critical Anomaly' : 'Normal Pattern'}**. \n\nI can explain why this happened in simple terms, suggest detailed fixes, or even help you understand the HDFS architecture. What would you like to know?`
            }]);
        }
    }, [isOpen, anomalyDetails]);

    // Handle external messages (e.g. from clicking a fix card)
    useEffect(() => {
        if (isOpen && externalMessage) {
            handleSend(externalMessage);
        }
    }, [isOpen, externalMessage]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (customMsg?: string) => {
        const userMsg = customMsg || input.trim();
        if (!userMsg || isLoading) return;

        if (!customMsg) setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:5000/ai/chat', {
                message: userMsg,
                context: {
                    log: logContext.slice(0, 3000),
                    result: anomalyDetails
                },
                history: messages
            });

            setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Connection error. Please check if the Backend is running and Gemini API key is valid." }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Close on click outside
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (chatContainerRef.current && !chatContainerRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={handleOverlayClick}
        >
            <div 
                ref={chatContainerRef}
                className="bg-[#0d1117] w-[95vw] h-[90vh] rounded-[2rem] border-2 border-[#30363d] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="px-10 py-6 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
                    <div className="flex items-center gap-5">
                        <div className="bg-blue-600 p-3 rounded-2xl shadow-xl shadow-blue-600/30 rotate-3">
                            <BrainCircuit className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">AI Diagnostic Laboratory</h2>
                            <p className="text-[10px] text-dark-muted font-bold uppercase tracking-[0.3em] flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Neural Context Active
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-3 hover:bg-red-500/10 rounded-full transition-all text-dark-muted hover:text-red-500 border border-transparent hover:border-red-500/20"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-12 space-y-10">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-6 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl
                                ${msg.role === 'assistant' ? 'bg-blue-600/10 border border-blue-500/30' : 'bg-purple-600/10 border border-purple-500/30'}`}>
                                {msg.role === 'assistant' ? <Sparkles className="text-blue-500 w-6 h-6" /> : <User className="text-purple-500 w-6 h-6" />}
                            </div>
                            <div className={`max-w-[75%] px-8 py-6 rounded-[1.5rem] text-base leading-relaxed font-medium shadow-xl
                                ${msg.role === 'assistant' ? 'bg-[#161b22] text-dark-text border border-[#30363d]' : 'bg-blue-600 text-white shadow-blue-600/20'}`}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center">
                                <Bot className="text-blue-500 w-6 h-6 animate-bounce" />
                            </div>
                            <div className="px-8 py-6 rounded-[1.5rem] bg-[#161b22] border border-[#30363d] text-dark-muted italic text-sm">
                                Gemini is processing deep system logs...
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-10 border-t border-[#30363d] bg-[#161b22]">
                    <div className="flex items-center gap-6 bg-[#0d1117] px-8 py-5 rounded-3xl border-2 border-[#30363d] focus-within:border-blue-500 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all">
                        <Terminal className="w-6 h-6 text-dark-muted" />
                        <input 
                            type="text" 
                            placeholder="Type your cross-question here (e.g. 'Why did the DataNode fail?')..." 
                            className="flex-1 bg-transparent border-none outline-none text-white text-lg font-medium placeholder:text-dark-muted"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button 
                            onClick={() => handleSend()}
                            disabled={isLoading || !input.trim()}
                            className="bg-blue-600 px-6 py-3 rounded-2xl text-white hover:bg-blue-500 transition-all disabled:opacity-50 font-bold shadow-xl shadow-blue-600/30"
                        >
                            Send Query
                        </button>
                    </div>
                    <p className="text-center mt-4 text-[10px] text-dark-muted font-bold uppercase tracking-[0.2em]">Senior DevOps Assistant · Google Gemini Pro</p>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
