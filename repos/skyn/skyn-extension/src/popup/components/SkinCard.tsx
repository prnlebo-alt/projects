import type { Skin } from '../../shared/types';

interface SkinCardProps {
  skin: Skin;
  active: boolean;
  locked: boolean;
  compact?: boolean;
  onApply: (skin: Skin) => void;
  onLocked: (skin: Skin) => void;
  onPreview?: (skin: Skin) => void;
}

export default function SkinCard({ skin, active, locked, compact = false, onApply, onLocked, onPreview }: SkinCardProps) {
  const price = skin.price === 0 ? 'FREE' : `$${(skin.price / 100).toFixed(2)}`;

  return (
    <button
      className={`skin-card ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''}`}
      style={{ background: skin.bg, color: skin.text, borderColor: active ? skin.accent : skin.border }}
      type="button"
      onClick={() => locked ? onLocked(skin) : onApply(skin)}
      onMouseEnter={() => onPreview?.(skin)}
    >
      <span className="skin-card__emoji">{skin.emoji}</span>
      <span className="skin-card__dot" style={{ background: skin.accent }} />
      <span className="skin-card__name">{skin.name}</span>
      <span className="skin-card__meta">{locked ? price : active ? 'ACTIVE' : skin.vibe}</span>
    </button>
  );
}
