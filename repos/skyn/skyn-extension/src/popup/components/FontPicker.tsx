import { FONTS } from '../../shared/fonts';

interface FontPickerProps {
  activeFontId: string;
  proEnabled: boolean;
  onChange: (fontId: string) => void;
  onLocked: () => void;
}

export default function FontPicker({ activeFontId, proEnabled, onChange, onLocked }: FontPickerProps) {
  return (
    <label className="field">
      <span>Font</span>
      <select
        value={activeFontId}
        onChange={(event) => {
          const font = FONTS.find((item) => item.id === event.target.value);
          if (font?.tier === 'pro' && !proEnabled) {
            onLocked();
            return;
          }
          onChange(event.target.value);
        }}
      >
        {FONTS.map((font) => (
          <option key={font.id} value={font.id}>
            {font.name}{font.tier === 'pro' && !proEnabled ? ' · Pro' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
