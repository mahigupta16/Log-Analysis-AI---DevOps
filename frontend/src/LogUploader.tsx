import React, { useState } from 'react';
import { Upload, FileText, X, Sparkles } from 'lucide-react';

const PRESETS = [
    {
        name: "DB Connection Exhausted",
        category: "PostgreSQL Failure",
        filename: "postgres_pool_exhaustion.log",
        content: `2026-07-06 21:00:00 [main] INFO org.postgresql.Driver - Connecting to database at 10.0.1.42:5432
2026-07-06 21:01:05 [pool-1-thread-2] WARNING org.hibernate.engine.jdbc.connections.internal.BasicConnectionCreator - Connection pool exhausted. Waiting for connections...
2026-07-06 21:02:10 [pool-1-thread-4] CRITICAL org.postgresql.Driver - Database connection pool size 100 exhausted. Total waiting threads: 45. ConnectionTimeoutException! PostgreSQL remaining connection slots reserved for superuser privileges.`
    },
    {
        name: "Mount Write Block Failure",
        category: "Disk Space Full",
        filename: "disk_space_exhaustion.log",
        content: `2026-07-06 18:22:00 [syslog] INFO Starting daily database index cleanup job on partition sda2
2026-07-06 18:22:15 [syslog] WARNING kernel: [38291.902] Disk utilization reached 98% on mount /var/lib/postgresql
2026-07-06 18:23:01 [syslog] CRITICAL systemd[1]: postgresql.service: Failed to write write-ahead log. No space left on device (28). Disk is completely full. System halted!`
    },
    {
        name: "HDFS Block Sync Timeout",
        category: "HDFS Anomaly (RF)",
        filename: "hdfs_block_timeout.log",
        content: `2026-07-06 10:15:30 INFO  dfs.DataNode$PacketResponder: PacketResponder: Block blk_5729104729184729103, terminating
2026-07-06 10:15:32 WARN  dfs.DataNode$DataXceiver: Got exception while serving blk_5729104729184729103 to /10.251.43.115:50010
2026-07-06 10:15:35 ERROR dfs.DataNode$DataXceiver: writeBlock blk_5729104729184729103 received exception java.io.IOException: Block already exists!`
    },
    {
        name: "Brute Force SSH Attack",
        category: "Security Intrusion",
        filename: "ssh_brute_force.log",
        content: `2026-07-06 02:11:00 INFO sshd[4829]: Server listening on port 22
2026-07-06 02:11:05 WARNING sshd[4833]: Failed password for invalid user admin from 192.168.1.104 port 48291 ssh2
2026-07-06 02:11:10 WARNING sshd[4833]: Failed password for invalid user admin from 192.168.1.104 port 48293 ssh2
2026-07-06 02:11:15 CRITICAL sshd[4833]: Host 192.168.1.104 blocked. Too many authentication failures (15 failures in 30 seconds). SSH Brute force attack suspected!`
    },
    {
        name: "Normal System Operation",
        category: "Healthy State",
        filename: "normal_system_boot.log",
        content: `2026-07-06 09:00:00 INFO systemd[1]: Started System Logging Service.
2026-07-06 09:01:00 INFO cron[120]: (root) CMD (run-parts /etc/cron.hourly)
2026-07-06 09:02:00 INFO kernel: [129.09] CPU frequency scaled successfully. All cores operating at 2.4GHz.
2026-07-06 09:03:00 INFO ntpd[19]: synchronized to time server 129.6.15.28`
    }
];

interface LogUploaderProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
}

const LogUploader: React.FC<LogUploaderProps> = ({ onUpload, isUploading }) => {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const uploadedFile = e.dataTransfer.files[0];
            setFile(uploadedFile);
            onUpload(uploadedFile);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const uploadedFile = e.target.files[0];
            setFile(uploadedFile);
            onUpload(uploadedFile);
        }
    };

    const handlePresetClick = (preset: typeof PRESETS[0]) => {
        const blob = new Blob([preset.content], { type: 'text/plain' });
        const fileObj = new File([blob], preset.filename, { type: 'text/plain' });
        setFile(fileObj);
        onUpload(fileObj);
    };

    return (
        <div className="bg-[#161b22] border-2 border-[#30363d] rounded-2xl p-8 h-full w-full flex flex-col justify-between shadow-2xl hover:border-blue-500/30 transition-all">
            <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <Sparkles className="text-blue-500 w-5 h-5 animate-pulse" />
                Telemetry Ingestion Area
            </h2>
            
            <div 
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 flex flex-col items-center justify-center gap-4
                    \${dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-[#30363d] hover:border-[#8b949e]'}
                    \${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleChange}
                    disabled={isUploading}
                    accept=".txt,.log,.csv"
                />
                
                <div className="bg-blue-500/10 p-4 rounded-full">
                    <Upload className="text-blue-500 w-8 h-8" />
                </div>
                
                <div className="text-center">
                    <p className="text-white font-medium">Drag & drop your log file here</p>
                    <p className="text-sm text-dark-muted">or click to browse files</p>
                </div>
            </div>

            {file && (
                <div className="mt-4 flex items-center justify-between bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                    <div className="flex items-center gap-3">
                        <FileText className="text-blue-500 w-5 h-5" />
                        <div>
                            <p className="text-sm font-medium text-white">{file.name}</p>
                            <p className="text-xs text-dark-muted">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setFile(null)}
                        className="text-dark-muted hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Quick Simulation Presets */}
            <div className="mt-6 border-t border-[#30363d] pt-6">
                <span className="text-[10px] text-dark-muted block uppercase font-black tracking-widest mb-3">Quick Incident Simulation Presets</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                    {PRESETS.map((preset, idx) => (
                        <button
                            key={idx}
                            onClick={() => handlePresetClick(preset)}
                            disabled={isUploading}
                            className="bg-[#0d1117] hover:bg-[#1f242c] text-white border border-[#30363d] hover:border-blue-500/40 p-3 rounded-xl text-left transition-all active:scale-95 disabled:opacity-50"
                        >
                            <span className="text-[8px] text-blue-400 font-black uppercase block mb-0.5">{preset.category}</span>
                            <span className="text-[10px] font-bold text-gray-300 line-clamp-1 block">{preset.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LogUploader;
