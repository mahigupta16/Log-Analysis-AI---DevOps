import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Terminal, Send, MessageSquare, AlertCircle, Wrench, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface LogAssistantProps {
  presetLogText?: string;
}

const promptTemplates = [
  { label: "PostgreSQL Lock", text: "2026-06-14 11:22:01.456 UTC [2945] FATAL: remaining connection slots are reserved for non-superuser bootstrap connections" },
  { label: "Disk Full Alert", text: "2026-06-14 11:22:15 UTC daemon.err kernel: [ 451.2948] ext4_lookup: deleted inode referenced: 12596489 in /var/log/nginx/access.log (no space left on device)" },
  { label: "SSHD Auth Fail", text: "Jun 14 11:22:05 server sshd[4950]: Failed password for invalid user admin from 192.168.1.105 port 42890 ssh2" }
];

export const LogAssistant: React.FC<LogAssistantProps> = ({ presetLogText }) => {
  const [logText, setLogText] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    if (presetLogText) {
      setLogText(presetLogText);
    }
  }, [presetLogText]);

  const handleReset = () => {
    setLogText('');
    setResponse('');
    setError('');
    setChatMessage('');
    setHistory([]);
  };

  const handleDownload = () => {
    if (history.length === 0) return;
    const contentText = history.map(h => `[${h.role === 'user' ? 'USER' : 'AI ASSISTANT'}]\n${h.content}\n`).join('\n');
    const blob = new Blob([contentText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `log_diagnostic_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApiCall = async (endpoint: string) => {
    if (!logText.trim()) {
      setError('Please paste an error log first.');
      return;
    }
    setLoading(true);
    setActiveAction(endpoint);
    setError('');
    try {
      const res = await axios.post(`http://localhost:5000/ai/${endpoint}`, {
        log: logText
      });
      setResponse(res.data.response);
      setHistory([{ role: 'ai', content: res.data.response }]);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred while connecting to the AI service.');
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    
    const newHistory = [...history, { role: 'user', content: chatMessage }];
    setHistory(newHistory);
    setChatMessage('');
    setLoading(true);
    setActiveAction('chat');
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/ai/chat', {
        message: chatMessage,
        context: { log: logText, result: response },
        history: history
      });
      setHistory([...newHistory, { role: 'ai', content: res.data.reply }]);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred during chat.');
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  return (
    <div className="bg-[#1a1b26] border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full max-h-[800px]">
      <div className="bg-[#24283b] p-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="text-blue-400" size={20} />
          <h2 className="text-lg font-semibold text-white">AI Log Assistant</h2>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleDownload}
              className="text-xs bg-[#1f2335] hover:bg-gray-700 text-blue-400 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors flex items-center gap-1 font-bold active:scale-95"
              title="Save Report to TXT"
            >
              Save Report
            </button>
          )}
          {(logText || response || history.length > 0) && (
            <button
              onClick={handleReset}
              className="text-xs bg-red-600/10 hover:bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors flex items-center gap-1 font-bold active:scale-95"
              title="Reset All fields"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-800">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Error Log</label>
          <textarea
            className="w-full h-24 bg-[#1f2335] text-gray-300 rounded-lg p-3 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-mono text-xs"
            placeholder="Paste error log or click any log line below..."
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
          />
        </div>

        {logText.length === 0 && (
          <div className="animate-in fade-in duration-300">
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Load Error Template</span>
            <div className="flex flex-wrap gap-1.5">
              {promptTemplates.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => setLogText(t.text)}
                  className="text-[9px] bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md transition-all active:scale-95 font-bold"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <button
            onClick={() => handleApiCall('explain')}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {activeAction === 'explain' ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <AlertCircle size={16} />
            )}
            Explain Error
          </button>
          <button
            onClick={() => handleApiCall('bash')}
            disabled={loading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {activeAction === 'bash' ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <Terminal size={16} />
            )}
            Generate Bash Script
          </button>
          <button
            onClick={() => handleApiCall('k8s')}
            disabled={loading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {activeAction === 'k8s' ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <Wrench size={16} />
            )}
            Suggest Kubernetes Fix
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2 flex-shrink-0">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          {loading && history.length === 0 && (
            <div className="flex items-center justify-center py-12 text-blue-400">
              <Loader2 className="animate-spin" size={32} />
            </div>
          )}

          {history.length > 0 && (
            <div className="flex flex-col gap-4">
              {history.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-blue-500/20 border border-blue-500/30 ml-8' 
                      : 'bg-[#24283b] border border-gray-700 mr-8'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {msg.role === 'user' ? <MessageSquare size={14} className="text-blue-400"/> : <Terminal size={14} className="text-green-400"/>}
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <div className="text-gray-300 text-sm prose prose-invert max-w-none prose-pre:bg-[#1a1b26] prose-pre:border prose-pre:border-gray-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))}
              {loading && history.length > 0 && (
                <div className="flex items-center gap-2 text-blue-400 p-4 mr-8 bg-[#24283b] border border-gray-700 rounded-lg">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-sm">AI is thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-[#24283b] border-t border-gray-800 flex-shrink-0">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleChat(); }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            disabled={loading || (!response && history.length === 0)}
            placeholder="Ask a follow-up question..."
            className="w-full bg-[#1f2335] text-white rounded-lg pl-4 pr-12 py-3 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !chatMessage.trim() || (!response && history.length === 0)}
            className="absolute right-2 p-2 text-gray-400 hover:text-blue-400 disabled:opacity-50 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
