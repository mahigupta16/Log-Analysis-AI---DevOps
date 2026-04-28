import React, { useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

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

    return (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">Log Upload Section</h2>
            
            <div 
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 flex flex-col items-center justify-center gap-4
                    ${dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-[#30363d] hover:border-[#8b949e]'}
                    ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
        </div>
    );
};

export default LogUploader;
