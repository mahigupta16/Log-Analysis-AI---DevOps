import React from 'react';
import { Handle, Position } from 'reactflow';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const CustomNode = ({ data }: any) => {
  const isFailed = data.status === 'failed';

  return (
    <div className={`px-4 py-3 shadow-xl rounded-xl border-2 min-w-[180px] transition-all duration-500 bg-[#161b22]
      ${isFailed ? 'border-red-500 shadow-red-500/20' : 'border-green-500 shadow-green-500/20'}`}>
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-1.5 rounded-lg ${isFailed ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
          {isFailed ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold text-dark-muted uppercase tracking-tighter">Service Node</p>
          <p className="text-sm font-bold text-white -mt-1">{data.label}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-[#30363d]">
        <Info className="w-3 h-3 text-dark-muted" />
        <p className="text-[10px] text-dark-text italic truncate max-w-[140px]">
          {data.desc || 'Operational'}
        </p>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-[#8b949e] !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-[#8b949e] !w-2 !h-2" />
    </div>
  );
};

export default CustomNode;
