interface BackgroundUploaderProps {
  disabled: boolean;
  opacity: number | null;
  hasBackground: boolean;
  onUpload: (dataUrl: string) => void;
  onOpacityChange: (opacity: number | null) => void;
  onClear: () => void;
  onError: (message: string) => void;
}

export default function BackgroundUploader({ disabled, opacity, hasBackground, onUpload, onOpacityChange, onClear, onError }: BackgroundUploaderProps) {
  return (
    <div className="background-tools">
      <label className="file-button">
        <input
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            void compressImage(file).then(onUpload).catch((error: Error) => onError(error.message));
          }}
        />
        Background
      </label>
      <label className="range-field">
        <span>Intensity</span>
        <input
          max="30"
          min="0"
          type="range"
          value={opacity ?? 12}
          onChange={(event) => onOpacityChange(Number(event.target.value))}
        />
      </label>
      <button className="ghost-button" disabled={!hasBackground} type="button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

async function compressImage(file: File): Promise<string> {
  if (file.size > 4 * 1024 * 1024) throw new Error('Image must be 4MB or smaller.');
  const dataUrl = await readFile(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, 800 / image.width, 600 / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not process image.'));
    image.src = src;
  });
}
