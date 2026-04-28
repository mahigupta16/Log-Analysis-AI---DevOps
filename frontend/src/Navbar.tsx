import React from 'react';
import { ShieldCheck, Activity } from 'lucide-react';

interface NavbarProps {
    isConnected: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ isConnected }) => {
  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-[#161b22] border-b border-[#30363d] sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg">
            <ShieldCheck className="text-white w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          AI Log <span className="text-blue-500">Intelligence</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 bg-[#0d1117] px-4 py-1.5 rounded-full border border-[#30363d]">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-sm font-medium text-dark-muted">
          {isConnected ? 'Backend Connected' : 'Disconnected'}
        </span>
      </div>
    </nav>
  );
};

export default Navbar;
