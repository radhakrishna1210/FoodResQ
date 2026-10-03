import { useRef, useState } from 'react';
import { CheckCircle2, FileUp, ImagePlus, X } from 'lucide-react';
import { errorMessage, uploadFile } from '@/lib/api';
import type { UploadBucket } from '@/types';
import { Spinner } from '@/components/ui/Spinner';

/** Signed-URL upload (ARCHITECTURE §4.5). Calls onUploaded(path) after a successful PUT. */
export function FileUpload({
  bucket,
  allocationId,
  accept,
  label,
  hint,
  value,
  onUploaded,
  onClear,
  image,
}: {
  bucket: UploadBucket;
  /** Required for `feedback-photos` so the path is `{allocation_id}/…` (§4.5). */
  allocationId?: string;
  accept: string;
  label: string;
  hint?: string;
  value: string | null | undefined;
  onUploaded: (path: string) => void;
  onClear?: () => void;
  image?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    setFileName(file.name);
    if (image && file.type.startsWith('image/')) setPreview(URL.createObjectURL(file));
    try {
      const path = await uploadFile(bucket, file, allocationId);
      onUploaded(path);
    } catch (e) {
      setError(errorMessage(e, 'Upload failed. Please try again.'));
      setPreview(null);
      setFileName(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-green/30 bg-green-50 px-3 py-2">
          {preview ? (
            <img src={preview} alt="" className="h-12 w-12 rounded object-cover" />
          ) : (
            <CheckCircle2 size={20} className="text-green" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{fileName ?? 'File uploaded'}</p>
            <p className="text-xs text-green-700">Uploaded</p>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setFileName(null);
                onClear();
              }}
              className="rounded p-1 text-slate hover:bg-white"
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-line bg-white px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-primary-50/30 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-60"
        >
          {busy ? (
            <Spinner />
          ) : image ? (
            <ImagePlus size={22} className="text-primary" aria-hidden />
          ) : (
            <FileUp size={22} className="text-primary" aria-hidden />
          )}
          <span className="text-sm font-medium text-ink">{busy ? 'Uploading…' : label}</span>
          {hint && <span className="text-xs text-slate">{hint}</span>}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
