import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Database, Search, Download, RefreshCw, ChevronDown, ChevronUp,
  ShieldAlert, ShieldCheck, Clock, FileText, BarChart2, Tag, 
  CheckSquare, Square, Loader2, Trash2, ChevronRight, Edit3,
  X, Save, AlertTriangle, TrendingUp, Activity, HardDrive,
  Filter, SortAsc, SortDesc, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:5000/model';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbStats {
  total_records: number;
  anomaly_count: number;
  normal_count: number;
  reviewed_count: number;
  unreviewed_count: number;
  anomaly_rate: number;
  avg_confidence: number;
  avg_processing_ms: number;
  total_lines_scanned: number;
  total_error_lines: number;
  total_bytes_processed: number;
  dataset_breakdown: { name: string; count: number }[];
  severity_breakdown: { level: string; count: number }[];
  format_breakdown: { format: string; count: number }[];
  model_breakdown: { model: string; count: number }[];
  daily_activity: { day: string; count: number }[];
  top_issues: { issue: string; count: number }[];
}

interface HistoryRecord {
  id: string;
  timestamp: string;
  filename: string;
  dataset_name: string;
  dataset_category: string;
  status: string;
  confidence: number;
  severity_level: string;
  model_used: string;
  detected_issue: string;
  root_cause: string;
  why_it_failed: string;
  failed_node: string;
  recommendations: string[];
  possible_fixes: string[];
  reconstruction_error: number;
  threshold: number;
  total_lines_scanned: number;
  error_lines_count: number;
  file_size_bytes: number;
  ai_explanation: string;
  upload_source: string;
  processing_time_ms: number;
  log_format: string;
  anomaly_score: number;
  tags: string[];
  notes: string;
  reviewed: boolean;
  archive_filename: string;
}

type SortField = 'timestamp' | 'filename' | 'status' | 'confidence' | 'severity_level' | 'anomaly_score' | 'processing_time_ms';
type SortDir = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const severityColor = (s: string) => {
  switch (s?.toUpperCase()) {
    case 'CRITICAL': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'WARNING':  return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'INFO':     return 'text-green-400 bg-green-500/10 border-green-500/30';
    default:         return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatMs = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex items-start gap-4 hover:border-[#444c56] transition-all"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black text-white mt-0.5 font-mono">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

// ─── Tag Pill ─────────────────────────────────────────────────────────────────

const TagPill = ({ tag, onRemove }: { tag: string; onRemove?: () => void }) => {
  const colors: Record<string, string> = {
    anomaly: 'bg-red-500/15 text-red-400 border-red-500/30',
    normal: 'bg-green-500/15 text-green-400 border-green-500/30',
    security: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    hadoop: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    database: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    network: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    memory: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    storage: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    performance: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    error: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  const cls = colors[tag] || 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-white transition-colors ml-0.5">
          <X size={9} />
        </button>
      )}
    </span>
  );
};

// ─── Mini Bar ─────────────────────────────────────────────────────────────────

const MiniBar = ({ data, total, colorClass }: { data: { label: string; count: number }[]; total: number; colorClass: string }) => (
  <div className="space-y-2">
    {data.map(d => (
      <div key={d.label} className="flex items-center gap-2">
        <span className="text-[9px] text-gray-400 w-28 truncate font-mono shrink-0">{d.label}</span>
        <div className="flex-1 bg-[#0d1117] rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${colorClass} transition-all duration-700`}
            style={{ width: `${total > 0 ? (d.count / total) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[9px] text-gray-500 font-mono w-6 text-right">{d.count}</span>
      </div>
    ))}
  </div>
);

// ─── Detail Drawer ────────────────────────────────────────────────────────────

const DetailDrawer = ({ record, onClose, onAnnotate, onDelete }: {
  record: HistoryRecord;
  onClose: () => void;
  onAnnotate: (id: string, notes: string, tags: string[], reviewed: boolean) => Promise<void>;
  onDelete: (id: string) => void;
}) => {
  const [notes, setNotes] = useState(record.notes || '');
  const [tags, setTags] = useState<string[]>(record.tags || []);
  const [reviewed, setReviewed] = useState(record.reviewed || false);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const fixes = record.recommendations || record.possible_fixes || [];
  const rootCause = record.root_cause || record.why_it_failed || '';

  const loadFile = async () => {
    if (fileContent) { setShowLog(!showLog); return; }
    setShowLog(true);
    setLoadingFile(true);
    try {
      const res = await axios.get(`${API}/history/file/${record.id}`);
      setFileContent(res.data.content);
    } catch {
      setFileContent('Unable to load archived log file.');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onAnnotate(record.id, notes, tags, reviewed);
    setSaving(false);
  };

  const addTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  };

  const removeTag = (t: string) => setTags(tags.filter(x => x !== t));

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="h-full flex flex-col bg-[#161b22] border-l border-[#30363d]"
    >
      {/* Header */}
      <div className="p-5 border-b border-[#30363d] flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-black text-white font-mono truncate">{record.filename}</p>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-0.5">{record.dataset_name}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">{record.timestamp} · {record.model_used}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onDelete(record.id)}
            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Delete record"
          >
            <Trash2 size={13} />
          </button>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-gray-800">

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${record.status === 'anomaly' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
            {record.status}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${severityColor(record.severity_level)}`}>
            {record.severity_level}
          </span>
          {record.reviewed && (
            <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/30 text-blue-400">
              ✓ Reviewed
            </span>
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Confidence', value: `${record.confidence}%` },
            { label: 'Anomaly Score', value: `${(record.anomaly_score * 100).toFixed(1)}%` },
            { label: 'Lines Scanned', value: record.total_lines_scanned.toLocaleString() },
            { label: 'Error Lines', value: record.error_lines_count.toLocaleString() },
            { label: 'File Size', value: formatBytes(record.file_size_bytes) },
            { label: 'Processing', value: formatMs(record.processing_time_ms) },
            { label: 'Log Format', value: record.log_format },
            { label: 'Upload Source', value: record.upload_source },
          ].map(m => (
            <div key={m.label} className="bg-[#0d1117] rounded-xl p-2.5 border border-[#30363d]">
              <p className="text-[8px] text-gray-500 uppercase font-bold">{m.label}</p>
              <p className="text-xs font-black text-white font-mono mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Detected Issue */}
        {record.detected_issue && record.detected_issue !== 'N/A' && (
          <div>
            <p className="text-[9px] text-blue-400 font-black uppercase tracking-wider mb-1.5">Issue Detected</p>
            <p className="text-xs text-white bg-[#0d1117] p-3 rounded-xl border border-[#30363d] font-medium">{record.detected_issue}</p>
          </div>
        )}

        {/* Root Cause */}
        {rootCause && rootCause !== 'N/A' && (
          <div>
            <p className="text-[9px] text-orange-400 font-black uppercase tracking-wider mb-1.5">Root Cause</p>
            <p className="text-xs text-gray-300 bg-[#0d1117] p-3 rounded-xl border border-[#30363d] leading-relaxed">{rootCause}</p>
          </div>
        )}

        {/* Recommendations */}
        {fixes.length > 0 && (
          <div>
            <p className="text-[9px] text-green-400 font-black uppercase tracking-wider mb-1.5">Recommendations</p>
            <ul className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d] space-y-2">
              {fixes.map((fix, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-300">
                  <span className="text-green-500 font-black shrink-0">{i + 1}.</span>
                  <span className="leading-relaxed">{fix}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        <div>
          <p className="text-[9px] text-purple-400 font-black uppercase tracking-wider mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => <TagPill key={t} tag={t} onRemove={() => removeTag(t)} />)}
            {tags.length === 0 && <span className="text-[9px] text-gray-600">No tags</span>}
          </div>
          <div className="flex gap-2">
            <input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add tag..."
              className="flex-1 bg-[#0d1117] text-white text-xs rounded-lg px-3 py-1.5 border border-[#30363d] focus:border-purple-500 outline-none"
            />
            <button onClick={addTag} className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg text-xs font-bold border border-purple-500/20 transition-all">
              Add
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[9px] text-yellow-400 font-black uppercase tracking-wider mb-1.5">Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add investigation notes..."
            rows={3}
            className="w-full bg-[#0d1117] text-gray-300 text-xs rounded-xl px-3 py-2.5 border border-[#30363d] focus:border-yellow-500/50 outline-none resize-none font-mono"
          />
        </div>

        {/* Mark Reviewed */}
        <button
          onClick={() => setReviewed(!reviewed)}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${reviewed ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:border-blue-500/30 hover:text-blue-400'}`}
        >
          {reviewed ? <CheckSquare size={14} /> : <Square size={14} />}
          {reviewed ? 'Marked as Reviewed' : 'Mark as Reviewed'}
        </button>

        {/* Save Annotations */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Annotations'}
        </button>

        {/* Log File Preview */}
        <div>
          <button
            onClick={loadFile}
            className="w-full flex items-center gap-2 text-[9px] text-gray-500 hover:text-gray-300 uppercase font-bold tracking-wider transition-colors py-2"
          >
            {showLog ? <EyeOff size={11} /> : <Eye size={11} />}
            {showLog ? 'Hide' : 'Show'} Archived Log Content
          </button>
          {showLog && (
            <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-3 max-h-48 overflow-y-auto">
              {loadingFile
                ? <div className="flex items-center gap-2 text-blue-400 text-xs"><Loader2 size={12} className="animate-spin" /> Loading...</div>
                : <pre className="text-[9px] text-gray-400 font-mono whitespace-pre-wrap">{fileContent}</pre>
              }
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const DatabaseExplorer: React.FC = () => {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'anomaly' | 'normal'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'stats'>('table');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setStatsLoading(true);
    try {
      const [histRes, statsRes] = await Promise.all([
        axios.get(`${API}/history`),
        axios.get(`${API}/db-stats`),
      ]);
      setRecords(histRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('DB Explorer fetch error:', err);
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Sorting & Filtering ─────────────────────────────────────────────────

  const sortedFiltered = records
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q || [r.filename, r.dataset_name, r.detected_issue, r.root_cause || r.why_it_failed, r.log_format, ...(r.tags || [])].some(f => (f || '').toLowerCase().includes(q));
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSeverity = severityFilter === 'all' || r.severity_level === severityFilter;
      const matchFormat = formatFilter === 'all' || r.log_format === formatFilter;
      return matchSearch && matchStatus && matchSeverity && matchFormat;
    })
    .sort((a, b) => {
      let av: any = a[sortField];
      let bv: any = b[sortField];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field
      ? (sortDir === 'asc' ? <SortAsc size={11} className="text-blue-400" /> : <SortDesc size={11} className="text-blue-400" />)
      : <SortAsc size={11} className="text-gray-600" />;

  // ─── CSV Export ───────────────────────────────────────────────────────────

  const exportCSV = () => {
    const headers = ['ID', 'Uploaded At', 'Filename', 'Dataset Name', 'Dataset Category', 'Status', 'Severity', 'Confidence (%)', 'Anomaly Score', 'Model Used', 'Log Format', 'Processing Time (ms)', 'File Size (bytes)', 'Lines Scanned', 'Error Lines', 'Detected Issue', 'Root Cause', 'Recommendations', 'Tags', 'Notes', 'Reviewed', 'Upload Source'];
    const rows = sortedFiltered.map(r => [
      r.id, r.timestamp, r.filename, r.dataset_name, r.dataset_category,
      r.status, r.severity_level, r.confidence, r.anomaly_score,
      r.model_used, r.log_format, r.processing_time_ms, r.file_size_bytes,
      r.total_lines_scanned, r.error_lines_count,
      `"${(r.detected_issue || '').replace(/"/g, '""')}"`,
      `"${((r.root_cause || r.why_it_failed) || '').replace(/"/g, '""')}"`,
      `"${(r.recommendations || r.possible_fixes || []).join(' | ').replace(/"/g, '""')}"`,
      `"${(r.tags || []).join(', ')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      r.reviewed ? 'Yes' : 'No',
      r.upload_source,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_analysis_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Annotate Record ──────────────────────────────────────────────────────

  const handleAnnotate = async (id: string, notes: string, tags: string[], reviewed: boolean) => {
    try {
      const res = await axios.patch(`${API}/history/${id}/annotate`, { notes, tags, reviewed });
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...res.data } : r));
      if (selectedRecord?.id === id) setSelectedRecord(r => r ? { ...r, ...res.data } : r);
    } catch (err) {
      console.error('Annotate error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record and its archived log file?')) return;
    try {
      await axios.delete(`${API}/history/${id}`);
      setRecords(prev => prev.filter(r => r.id !== id));
      if (selectedRecord?.id === id) setSelectedRecord(null);
      fetchAll();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // ─── Unique values for filter dropdowns ──────────────────────────────────

  const uniqueFormats = ['all', ...Array.from(new Set(records.map(r => r.log_format).filter(Boolean)))];
  const uniqueSeverities = ['all', 'CRITICAL', 'WARNING', 'INFO'];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">
      
      {/* Header */}
      <div className="border-b border-[#30363d] bg-[#161b22] px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 rounded-xl border border-blue-500/30">
              <Database size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Database Explorer</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                Log Analysis History · SQLite
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-gray-300 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={records.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-4">
          {(['table', 'stats'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-[#21262d]'}`}
            >
              {tab === 'table' ? '📋 Records' : '📊 Analytics'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'table' ? (
        <div className="flex h-[calc(100vh-160px)]">

          {/* Left: Table Panel */}
          <div className={`flex flex-col transition-all duration-300 ${selectedRecord ? 'w-3/5' : 'w-full'}`}>

            {/* Filters */}
            <div className="p-5 border-b border-[#30363d] bg-[#161b22] flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search filename, issue, tag..."
                  className="w-full bg-[#0d1117] text-white text-xs rounded-xl pl-9 pr-4 py-2 border border-[#30363d] focus:border-blue-500 outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-[#0d1117] text-xs text-gray-300 rounded-xl px-3 py-2 border border-[#30363d] focus:border-blue-500 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="anomaly">Anomaly</option>
                <option value="normal">Normal</option>
              </select>

              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="bg-[#0d1117] text-xs text-gray-300 rounded-xl px-3 py-2 border border-[#30363d] focus:border-blue-500 outline-none"
              >
                {uniqueSeverities.map(s => <option key={s} value={s}>{s === 'all' ? 'All Severities' : s}</option>)}
              </select>

              <select
                value={formatFilter}
                onChange={e => setFormatFilter(e.target.value)}
                className="bg-[#0d1117] text-xs text-gray-300 rounded-xl px-3 py-2 border border-[#30363d] focus:border-blue-500 outline-none"
              >
                {uniqueFormats.map(f => <option key={f} value={f}>{f === 'all' ? 'All Formats' : f}</option>)}
              </select>

              <span className="text-[10px] text-gray-500 font-mono ml-auto">
                {sortedFiltered.length} / {records.length} records
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-blue-400 gap-3">
                  <Loader2 className="animate-spin" size={28} />
                  <span className="text-xs uppercase font-bold tracking-wider">Loading database...</span>
                </div>
              ) : sortedFiltered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
                  <Database size={40} className="opacity-30" />
                  <p className="text-sm font-bold">No records found</p>
                  <p className="text-xs">Try adjusting your search or filters</p>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#161b22] border-b border-[#30363d]">
                      {[
                        { label: 'File', field: 'filename' as SortField },
                        { label: 'Dataset', field: null },
                        { label: 'Uploaded', field: 'timestamp' as SortField },
                        { label: 'Status', field: 'status' as SortField },
                        { label: 'Severity', field: 'severity_level' as SortField },
                        { label: 'Confidence', field: 'confidence' as SortField },
                        { label: 'Score', field: 'anomaly_score' as SortField },
                        { label: 'Format', field: null },
                        { label: 'Tags', field: null },
                        { label: 'Time', field: 'processing_time_ms' as SortField },
                        { label: '✓', field: null },
                      ].map(col => (
                        <th
                          key={col.label}
                          onClick={() => col.field && toggleSort(col.field)}
                          className={`px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap ${col.field ? 'cursor-pointer hover:text-gray-300 select-none' : ''}`}
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            {col.field && <SortIcon field={col.field} />}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiltered.map((record, idx) => {
                      const isSelected = selectedRecord?.id === record.id;
                      const isAnomaly = record.status === 'anomaly';
                      return (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => setSelectedRecord(isSelected ? null : record)}
                          className={`border-b border-[#21262d] cursor-pointer transition-all group ${isSelected ? 'bg-blue-600/5 border-blue-500/20' : 'hover:bg-[#21262d]/50'}`}
                        >
                          {/* Filename */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAnomaly ? 'bg-red-500' : 'bg-green-500'}`} />
                              <span className="font-mono text-gray-300 truncate max-w-[120px] group-hover:text-white transition-colors">{record.filename}</span>
                            </div>
                          </td>
                          {/* Dataset */}
                          <td className="px-4 py-2.5 max-w-[100px]">
                            <span className="text-blue-400/80 truncate block text-[9px] font-bold uppercase">{record.dataset_name || '—'}</span>
                          </td>
                          {/* Timestamp */}
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono">{record.timestamp?.split(' ')[0]}</td>
                          {/* Status */}
                          <td className="px-4 py-2.5">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${isAnomaly ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                              {record.status}
                            </span>
                          </td>
                          {/* Severity */}
                          <td className="px-4 py-2.5">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${severityColor(record.severity_level)}`}>
                              {record.severity_level}
                            </span>
                          </td>
                          {/* Confidence */}
                          <td className="px-4 py-2.5 text-gray-300 font-mono">{record.confidence}%</td>
                          {/* Anomaly Score */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 bg-[#0d1117] rounded-full h-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${record.anomaly_score > 0.7 ? 'bg-red-500' : record.anomaly_score > 0.3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${record.anomaly_score * 100}%` }}
                                />
                              </div>
                              <span className="text-gray-400 font-mono">{(record.anomaly_score * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          {/* Log Format */}
                          <td className="px-4 py-2.5 text-gray-500 text-[9px] font-mono">{record.log_format || '—'}</td>
                          {/* Tags */}
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 flex-wrap max-w-[100px]">
                              {(record.tags || []).slice(0, 2).map(t => <TagPill key={t} tag={t} />)}
                              {(record.tags || []).length > 2 && <span className="text-[8px] text-gray-600">+{record.tags.length - 2}</span>}
                            </div>
                          </td>
                          {/* Processing time */}
                          <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">{formatMs(record.processing_time_ms)}</td>
                          {/* Reviewed */}
                          <td className="px-4 py-2.5 text-center">
                            {record.reviewed
                              ? <CheckSquare size={13} className="text-blue-400 mx-auto" />
                              : <Square size={13} className="text-gray-700 mx-auto" />
                            }
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right: Detail Drawer */}
          <AnimatePresence>
            {selectedRecord && (
              <div className="w-2/5 border-l border-[#30363d] overflow-hidden">
                <DetailDrawer
                  record={selectedRecord}
                  onClose={() => setSelectedRecord(null)}
                  onAnnotate={handleAnnotate}
                  onDelete={handleDelete}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

      ) : (
        /* ─── Analytics Tab ─────────────────────────────────────────────────── */
        <div className="p-8 space-y-8 overflow-auto">

          {statsLoading ? (
            <div className="flex items-center justify-center py-20 text-blue-400 gap-3">
              <Loader2 className="animate-spin" size={28} />
              <span className="text-xs font-bold uppercase tracking-wider">Loading analytics...</span>
            </div>
          ) : stats ? (
            <>
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Database} label="Total Records" value={stats.total_records} sub={`${stats.reviewed_count} reviewed`} color="bg-blue-500/10 text-blue-400" />
                <StatCard icon={ShieldAlert} label="Anomalies Detected" value={stats.anomaly_count} sub={`${stats.anomaly_rate}% anomaly rate`} color="bg-red-500/10 text-red-400" />
                <StatCard icon={TrendingUp} label="Avg Confidence" value={`${stats.avg_confidence}%`} sub="across all records" color="bg-green-500/10 text-green-400" />
                <StatCard icon={Activity} label="Avg Processing" value={formatMs(stats.avg_processing_ms)} sub="per log analysis" color="bg-purple-500/10 text-purple-400" />
                <StatCard icon={FileText} label="Lines Scanned" value={stats.total_lines_scanned.toLocaleString()} sub={`${stats.total_error_lines.toLocaleString()} error lines`} color="bg-orange-500/10 text-orange-400" />
                <StatCard icon={HardDrive} label="Data Processed" value={formatBytes(stats.total_bytes_processed)} sub="total archived size" color="bg-cyan-500/10 text-cyan-400" />
                <StatCard icon={ShieldCheck} label="Normal Logs" value={stats.normal_count} sub={`${stats.total_records - stats.anomaly_count} healthy`} color="bg-teal-500/10 text-teal-400" />
                <StatCard icon={Eye} label="Unreviewed" value={stats.unreviewed_count} sub="pending manual review" color="bg-yellow-500/10 text-yellow-400" />
              </div>

              {/* Breakdown Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Dataset Breakdown */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart2 size={14} className="text-blue-400" /> Dataset Breakdown
                  </h4>
                  <MiniBar
                    data={stats.dataset_breakdown.map(d => ({ label: d.name, count: d.count }))}
                    total={stats.total_records}
                    colorClass="bg-blue-500"
                  />
                </div>

                {/* Severity Breakdown */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-orange-400" /> Severity Breakdown
                  </h4>
                  <MiniBar
                    data={stats.severity_breakdown.map(d => ({ label: d.level, count: d.count }))}
                    total={stats.total_records}
                    colorClass="bg-orange-500"
                  />
                </div>

                {/* Log Format Breakdown */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText size={14} className="text-cyan-400" /> Log Format Breakdown
                  </h4>
                  <MiniBar
                    data={stats.format_breakdown.map(d => ({ label: d.format, count: d.count }))}
                    total={stats.total_records}
                    colorClass="bg-cyan-500"
                  />
                </div>

                {/* Model Usage */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-purple-400" /> Model Usage
                  </h4>
                  <MiniBar
                    data={stats.model_breakdown.map(d => ({ label: d.model, count: d.count }))}
                    total={stats.total_records}
                    colorClass="bg-purple-500"
                  />
                </div>

                {/* Top Issues */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShieldAlert size={14} className="text-red-400" /> Top Detected Issues
                  </h4>
                  {stats.top_issues.length === 0 ? (
                    <p className="text-[10px] text-gray-600">No issues recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.top_issues.map((iss, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-red-500 font-black text-[9px] shrink-0 mt-0.5">{i + 1}.</span>
                          <span className="text-[10px] text-gray-300 leading-snug flex-1">{iss.issue}</span>
                          <span className="text-[9px] text-gray-500 font-mono shrink-0 bg-[#0d1117] px-1.5 py-0.5 rounded">{iss.count}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 7-Day Activity */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock size={14} className="text-green-400" /> 7-Day Activity
                  </h4>
                  {stats.daily_activity.length === 0 ? (
                    <p className="text-[10px] text-gray-600">No recent activity.</p>
                  ) : (
                    <div className="flex items-end gap-1 h-20">
                      {stats.daily_activity.map(d => {
                        const maxCount = Math.max(...stats.daily_activity.map(x => x.count));
                        const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                        return (
                          <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count} logs`}>
                            <span className="text-[7px] text-gray-600 font-mono">{d.count}</span>
                            <div className="w-full bg-[#0d1117] rounded-t" style={{ height: '48px' }}>
                              <div
                                className="w-full bg-green-500/60 rounded-t transition-all duration-700"
                                style={{ height: `${pct}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                              />
                            </div>
                            <span className="text-[7px] text-gray-600 font-mono">{d.day.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-20">
              <Database size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Failed to load analytics. Check backend connection.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
