import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, FileText, ChevronRight, Trash2, ShieldAlert, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HistoryViewerProps {
  onLoadHistoryResult: (result: any) => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ onLoadHistoryResult }) => {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/model/history');
      setHistoryList(res.data);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await axios.delete(`http://localhost:5000/model/history/${id}`);
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
        setFileContent('');
      }
      fetchHistory();
    } catch (err) {
      console.error("Error deleting history record:", err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all history and archives? This will delete all saved log files!")) return;
    try {
      await axios.delete('http://localhost:5000/model/history');
      setSelectedRecord(null);
      setFileContent('');
      fetchHistory();
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  };

  const handleSelectRecord = async (record: any) => {
    setSelectedRecord(record);
    setFileContent('');
    setLoadingFile(true);
    try {
      const res = await axios.get(`http://localhost:5000/model/history/file/${record.id}`);
      setFileContent(res.data.content);
    } catch (err) {
      setFileContent("Failed to load file contents from backend archive.");
      console.error("Error loading archived file:", err);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleLoadToWorkspace = (record: any) => {
    // Reconstruct the result structure expected by the main App
    const resultObj = {
      id: record.id,
      timestamp: record.timestamp,
      filename: record.filename,
      dataset_name: record.dataset_name,
      dataset_category: record.dataset_category,
      status: record.status,
      confidence: record.confidence,
      severity_level: record.severity_level,
      reconstruction_error: record.reconstruction_error,
      threshold: record.threshold,
      detected_issue: record.detected_issue,
      why_it_failed: record.root_cause || record.why_it_failed,
      root_cause: record.root_cause || record.why_it_failed,
      failed_node: record.failed_node,
      possible_fixes: record.recommendations || record.possible_fixes,
      recommendations: record.recommendations || record.possible_fixes,
      flow: record.flow,
      features: record.features,
      ai_explanation: record.ai_explanation,
      total_lines_scanned: record.total_lines_scanned,
      error_lines_count: record.error_lines_count,
      model_used: record.model_used,
      raw_log: fileContent
    };
    onLoadHistoryResult(resultObj);
  };

  const filteredHistory = historyList.filter(item => 
    item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.dataset_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.model_used || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.detected_issue || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.root_cause || item.why_it_failed || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      
      {/* Left Column: Archives List */}
      <div className="lg:col-span-5 bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] p-8 shadow-xl flex flex-col h-[650px]">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-4 mb-6">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Ingestion Archives</h3>
            <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest mt-1">Persistent History Logs</p>
          </div>
          {historyList.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="text-xs bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl transition-all active:scale-95 font-bold"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted w-4 h-4" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename, dataset, or issue..."
              className="w-full bg-[#0d1117] text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-2 text-xs border border-[#30363d] focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* List scroll container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-gray-800">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-blue-500">
              <Loader2 className="animate-spin mb-2" size={24} />
              <span className="text-[10px] uppercase font-bold tracking-wider">Syncing database...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-dark-muted py-12">
              <FileText className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-widest">Archive Empty</p>
              <p className="text-[10px] lowercase mt-1 font-mono">no persisted logs saved yet</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isSelected = selectedRecord?.id === item.id;
              const isAnomaly = item.status === 'anomaly';
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectRecord(item)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                    isSelected 
                      ? 'bg-blue-600/5 border-blue-500 shadow-lg shadow-blue-600/5' 
                      : 'bg-[#0d1117] border-[#30363d] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${isAnomaly ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {isAnomaly ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors font-mono">{item.filename}</p>
                      <p className="text-[9px] text-blue-400/80 font-bold uppercase tracking-wider truncate">{item.dataset_name || 'Custom Log Dataset'}</p>
                      <p className="text-[9px] text-dark-muted font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                        <Calendar size={10} />
                        {item.timestamp}
                        <span className="w-1 h-1 bg-dark-muted rounded-full" />
                        {item.model_used}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-2 text-dark-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/15 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                    <ChevronRight className="w-4 h-4 text-dark-muted group-hover:text-white transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Record Detail View */}
      <div className="lg:col-span-7 bg-[#161b22] border-2 border-[#30363d] rounded-[2rem] p-8 shadow-xl flex flex-col h-[650px] relative">
        <AnimatePresence mode="wait">
          {!selectedRecord ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center text-dark-muted py-12"
            >
              <FileText className="w-12 h-12 mb-4 animate-pulse" />
              <h3 className="text-white font-bold uppercase tracking-widest text-sm">Select Archived Log</h3>
              <p className="text-[10px] uppercase font-mono tracking-wider mt-2">Select a database record from the left side to examine diagnostic data</p>
            </motion.div>
          ) : (
            <motion.div 
              key={selectedRecord.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full space-y-6"
            >
              {/* Record Title Details */}
              <div className="flex items-center justify-between border-b border-[#30363d] pb-4">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight font-mono">{selectedRecord.filename}</h3>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">
                    Dataset: {selectedRecord.dataset_name || 'Custom Log Dataset'}
                  </p>
                  <p className="text-[10px] text-dark-muted font-bold uppercase tracking-widest mt-1">
                    Uploaded: {selectedRecord.timestamp} · Model: {selectedRecord.model_used} · Severity: {selectedRecord.severity_level || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => handleLoadToWorkspace(selectedRecord)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-blue-600/10"
                >
                  Load to Workspace
                </button>
              </div>

              {/* Status and Details Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border text-center ${
                  selectedRecord.status === 'anomaly' 
                    ? 'bg-red-500/5 border-red-500/20 text-red-500' 
                    : 'bg-green-500/5 border-green-500/20 text-green-500'
                }`}>
                  <span className="text-[8px] text-dark-muted block uppercase font-bold">Status</span>
                  <span className="text-xs uppercase font-black tracking-widest">{selectedRecord.status}</span>
                </div>
                <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] text-center text-white">
                  <span className="text-[8px] text-dark-muted block uppercase font-bold">Confidence</span>
                  <span className="text-xs font-black font-mono">{selectedRecord.confidence}%</span>
                </div>
                <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] text-center text-white">
                  <span className="text-[8px] text-dark-muted block uppercase font-bold">Lines Scanned</span>
                  <span className="text-xs font-black font-mono">{selectedRecord.total_lines_scanned}</span>
                </div>
              </div>

              {/* Text explanations */}
              <div className="space-y-4 flex-shrink-0">
                <div>
                  <span className="text-[9px] text-blue-400 font-black block uppercase tracking-wider mb-1">Issue Diagnosed</span>
                  <p className="text-xs font-bold text-white bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d]">{selectedRecord.detected_issue}</p>
                </div>
                <div>
                  <span className="text-[9px] text-orange-400 font-black block uppercase tracking-wider mb-1">Root Cause</span>
                  <p className="text-xs font-medium text-gray-300 bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d] leading-relaxed">
                    {selectedRecord.root_cause || selectedRecord.why_it_failed}
                  </p>
                </div>
                {(selectedRecord.recommendations || selectedRecord.possible_fixes || []).length > 0 && (
                  <div>
                    <span className="text-[9px] text-green-400 font-black block uppercase tracking-wider mb-1">Recommendations</span>
                    <ul className="text-xs font-medium text-gray-300 bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d] space-y-2">
                      {(selectedRecord.recommendations || selectedRecord.possible_fixes).map((fix: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-green-500 font-black">{idx + 1}.</span>
                          <span>{fix}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Log File Content Container */}
              <div className="flex-1 flex flex-col min-h-[160px] overflow-hidden">
                <span className="text-[9px] text-dark-muted font-black block uppercase tracking-wider mb-1">Archived Log Contents</span>
                <div className="flex-1 bg-[#0d1117] p-4 rounded-xl border border-[#30363d] overflow-y-auto leading-relaxed select-all">
                  {loadingFile ? (
                    <div className="flex items-center justify-center h-full text-blue-500 gap-2">
                      <Loader2 className="animate-spin w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Reading archive file...</span>
                    </div>
                  ) : (
                    <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap">{fileContent}</pre>
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};
