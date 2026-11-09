import React, { useRef, useState } from "react";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";

export interface InspectionPhotoUploadProps {
  /** Title shown above the photos (defaults to "Larawan ng Inspeksyon") */
  title?: string;
  /** Already-saved photo URLs from the server (shown as previews) */
  existingUrls?: string[];
  /** Called with the final array of File objects the user picked */
  onFilesChange: (files: File[]) => void;
  /** Disable the picker while an upload is in progress */
  disabled?: boolean;
  /** Maximum allowed photos (server cap = 3) */
  maxPhotos?: number;
}

/**
 * Photo picker used by the DA technician (inspection proof) and optionally
 * by the farmer (evidence). Accepts up to `maxPhotos` images; shows
 * thumbnail previews and lets the user remove individual picks.
 */
export const InspectionPhotoUpload: React.FC<InspectionPhotoUploadProps> = ({
  title = "Larawan ng Inspeksyon",
  existingUrls = [],
  onFilesChange,
  disabled = false,
  maxPhotos = 3,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);

  const totalCount = existingUrls.length + localFiles.length;
  const canAdd = totalCount < maxPhotos && !disabled;

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;

    const remaining = maxPhotos - existingUrls.length - localFiles.length;
    const toAdd = picked.slice(0, remaining);

    const previews = toAdd.map((f) => URL.createObjectURL(f));
    const nextFiles = [...localFiles, ...toAdd];
    const nextPreviews = [...localPreviews, ...previews];

    setLocalFiles(nextFiles);
    setLocalPreviews(nextPreviews);
    onFilesChange(nextFiles);

    // reset so the same file can be picked again if removed
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemoveLocal = (idx: number) => {
    URL.revokeObjectURL(localPreviews[idx]);
    const nextFiles = localFiles.filter((_, i) => i !== idx);
    const nextPreviews = localPreviews.filter((_, i) => i !== idx);
    setLocalFiles(nextFiles);
    setLocalPreviews(nextPreviews);
    onFilesChange(nextFiles);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Camera className="w-4 h-4 text-[#14213d] shrink-0" aria-hidden="true" />
        <p className="text-[13px] font-extrabold text-[#14213d]">
          {title}{" "}
          <span className="text-[12px] font-semibold text-[#4b5563]">
            (hanggang {maxPhotos} litrato)
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Existing server photos */}
        {existingUrls.map((url, idx) => (
          <div
            key={`existing-${idx}`}
            className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#c8d0c2] shadow-xs"
          >
            <img
              src={url}
              alt={`Larawan ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Existing photos show as saved — no remove button since they're already on the server */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] font-bold text-center py-0.5">
              Naka-save
            </div>
          </div>
        ))}

        {/* Local (newly picked) previews */}
        {localPreviews.map((url, idx) => (
          <div
            key={`local-${idx}`}
            className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#0a6b45] shadow-xs"
          >
            <img
              src={url}
              alt={`Bagong larawan ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemoveLocal(idx)}
              disabled={disabled}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition cursor-pointer"
              aria-label="Alisin ang larawang ito"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-[#c8d0c2] flex flex-col items-center justify-center gap-1 text-[#4b5563] hover:border-[#0a6b45] hover:text-[#0a6b45] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Magdagdag ng larawan"
          >
            {disabled ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px] font-bold">Magdagdag</span>
              </>
            )}
          </button>
        )}

        {/* Camera shortcut on mobile */}
        {canAdd && (
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.setAttribute("capture", "environment");
                inputRef.current.click();
              }
            }}
            disabled={disabled}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-[#c8d0c2] flex flex-col items-center justify-center gap-1 text-[#4b5563] hover:border-[#0a6b45] hover:text-[#0a6b45] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Kumuha ng larawan gamit ang camera"
          >
            {disabled ? null : (
              <>
                <Camera className="w-5 h-5" />
                <span className="text-[10px] font-bold">Camera</span>
              </>
            )}
          </button>
        )}
      </div>

      {totalCount >= maxPhotos && (
        <p className="text-[11px] text-[#4b5563] font-semibold">
          Naabot na ang limitasyon ng {maxPhotos} larawan.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePick}
        aria-hidden="true"
      />
    </div>
  );
};

