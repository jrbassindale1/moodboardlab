import { ImageDown, X } from 'lucide-react';

interface PostProcessingModalProps {
  isOpen: boolean;
  previewUrl: string | null;
  title: string;
  imageAlt: string;
  isDownloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}

const PostProcessingModal = ({
  isOpen,
  previewUrl,
  title,
  imageAlt,
  isDownloading,
  onDownload,
  onClose,
}: PostProcessingModalProps) => {
  if (!isOpen || !previewUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Render preview"
    >
      <div
        className="flex max-h-full w-full max-w-[96vw] flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 text-white">
          <div className="font-mono text-[11px] uppercase tracking-widest">
            {title}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-white/20"
            >
              <ImageDown className="h-3.5 w-3.5" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </div>
        <div className="flex min-h-0 items-center justify-center overflow-auto rounded-sm bg-black/40 p-2">
          <img
            src={previewUrl}
            alt={imageAlt}
            className="max-h-[88vh] max-w-full h-auto w-auto object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default PostProcessingModal;
