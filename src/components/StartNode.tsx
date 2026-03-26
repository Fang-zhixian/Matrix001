import { Flag } from 'lucide-react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { StartNodeData } from '../lib/startNode';

export default function StartNode({ data }: NodeProps<StartNodeData>) {
  return (
    <div className="relative w-[220px] overflow-hidden rounded-[1.35rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(246,248,251,0.88)_100%)] px-6 py-5 shadow-[0_16px_38px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0)_100%)]" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
          <Flag className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Start</div>
          <div className="mt-1 text-[15px] font-semibold text-slate-800">{data.label}</div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bottom-[-6px] !h-3 !w-3 !border-2 !border-white !bg-slate-300"
      />
    </div>
  );
}
