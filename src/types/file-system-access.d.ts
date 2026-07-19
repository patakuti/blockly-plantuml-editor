/**
 * Minimal ambient types for the File System Access API (Chrome/Edge only).
 * Not yet part of TypeScript's bundled DOM lib; only what
 * workspace/persistence.ts actually calls is declared here.
 */
interface FileSystemWritableFileStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

interface Window {
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
