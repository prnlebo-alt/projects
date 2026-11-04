import SkinCard from './SkinCard';
import type { Skin } from '../../shared/types';

interface SkinGridProps {
  skins: Skin[];
  activeSkinId: string;
  unlockedSkins: string[];
  compact?: boolean;
  onApply: (skin: Skin) => void;
  onLocked: (skin: Skin) => void;
  onPreview?: (skin: Skin) => void;
}

export default function SkinGrid({ skins, activeSkinId, unlockedSkins, compact, onApply, onLocked, onPreview }: SkinGridProps) {
  return (
    <div className="skin-grid">
      {skins.map((skin) => (
        <SkinCard
          key={skin.id}
          skin={skin}
          active={skin.id === activeSkinId}
          locked={!skin.free && !unlockedSkins.includes(skin.id) && !unlockedSkins.includes('all')}
          compact={compact}
          onApply={onApply}
          onLocked={onLocked}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}
