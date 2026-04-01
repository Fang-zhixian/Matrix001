import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Folder, Maximize2 } from 'lucide-react';
import type { FolderNodeData } from '../types/canvas';

const FolderNode = ({ data, id, selected }: NodeProps<FolderNodeData>) => {
  return (
    <div className="group relative">
      <div className={`px-7 py-5 shadow-[0_10px_30px_rgba(36,39,46,0.07)] rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(247,248,251,0.78)_100%)] border min-w-[220px] transition-all duration-300 ${
        selected ? 'border-[#0071e3]/40 ring-8 ring-[#0071e3]/[0.06]' : 'border-white/85 hover:border-slate-200'
      }`}>
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-slate-200 border-2 border-white !-top-1.5"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-[#0071e3] shadow-sm">
            <Folder className="w-6 h-6" />
          </div>
          
          <div className="text-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1">
              {data.label}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter opacity-60">
              {data.archivedNodes.length} Nodes Archived
            </p>
          </div>

          <button
            onClick={() => data.onExpand?.(id)}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-[#0071e3] transition-all font-bold text-[9px] uppercase tracking-[0.22em] shadow-lg shadow-slate-200"
          >
            <Maximize2 className="w-3 h-3" />
            Expand Group
          </button>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-slate-200 border-2 border-white !-bottom-1.5"
        />
      </div>
      
      {/* Visual stack effect */}
      <div className="absolute -bottom-2 left-4 right-4 h-4 bg-slate-50 border border-slate-100 rounded-[2rem] -z-10 opacity-50" />
      <div className="absolute -bottom-4 left-8 right-8 h-4 bg-slate-100 border border-slate-100 rounded-[2rem] -z-20 opacity-30" />
    </div>
  );
};

export default memo(FolderNode);
