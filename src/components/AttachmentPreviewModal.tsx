import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type { AttachmentPayload } from '../types/canvas';

interface AttachmentPreviewModalProps {
  attachment: AttachmentPayload | null;
  onClose: () => void;
}

export default function AttachmentPreviewModal({
  attachment,
  onClose,
}: AttachmentPreviewModalProps) {
  return (
    <AnimatePresence>
      {attachment && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/26 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="relative w-full max-w-5xl rounded-[1.6rem] border border-white/90 bg-white/82 p-4 shadow-[0_24px_80px_rgba(36,39,46,0.16)] backdrop-blur-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-4 rounded-[1.1rem] bg-black/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{attachment.name}</div>
                <div className="mt-1 text-xs text-slate-400">{attachment.mimeType}</div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-black/[0.05] hover:text-slate-600"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-[1.2rem] bg-[#f4f5f7]">
              {attachment.kind === 'image' && (attachment.dataUrl || attachment.previewUrl) ? (
                <img
                  src={attachment.dataUrl || attachment.previewUrl}
                  alt={attachment.name}
                  className="max-h-[76vh] w-full object-contain"
                />
              ) : attachment.mimeType === 'application/pdf' && (attachment.dataUrl || attachment.previewUrl) ? (
                <iframe
                  src={attachment.dataUrl || attachment.previewUrl}
                  title={attachment.name}
                  className="h-[76vh] w-full bg-white"
                />
              ) : (
                <div className="flex h-[40vh] items-center justify-center text-sm text-slate-500">
                  当前文件暂不支持预览
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
