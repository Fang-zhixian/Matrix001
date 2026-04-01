import type { AttachmentPayload } from '../types/canvas';

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function inferMimeType(filename: string) {
  if (filename.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (filename.toLowerCase().endsWith('.png')) return 'image/png';
  if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) return 'image/jpeg';
  if (filename.toLowerCase().endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export function stripAttachmentPayload(attachment: AttachmentPayload): AttachmentPayload {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    previewUrl: attachment.previewUrl,
  };
}
