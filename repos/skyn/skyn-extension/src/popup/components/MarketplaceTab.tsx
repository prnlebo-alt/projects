import SkinGrid from './SkinGrid';
import { SKIN_PACKS, SKINS } from '../../shared/skins';
import type { Skin, SkinCategory } from '../../shared/types';

const CATEGORIES: Array<'all' | SkinCategory> = ['all', 'dark', 'light', 'vibrant', 'glass', 'pretty', 'nature', 'scifi'];

interface MarketplaceTabProps {
  activeSkinId: string;
  category: 'all' | SkinCategory;
  unlockedSkins: string[];
  onCategoryChange: (category: 'all' | SkinCategory) => void;
  onApply: (skin: Skin) => void;
  onLocked: (skin: Skin) => void;
  onPreview: (skin: Skin) => void;
  onBuyPack: (packId: string) => void;
}

export default function MarketplaceTab({ activeSkinId, category, unlockedSkins, onCategoryChange, onApply, onLocked, onPreview, onBuyPack }: MarketplaceTabProps) {
  const skins = category === 'all' ? SKINS : SKINS.filter((skin) => skin.category === category);

  return (
    <section className="tab-panel">
      <div className="category-tabs">
        {CATEGORIES.map((item) => (
          <button key={item} className={item === category ? 'is-active' : ''} type="button" onClick={() => onCategoryChange(item)}>
            {item === 'all' ? 'All' : item}
          </button>
        ))}
      </div>
      <SkinGrid
        activeSkinId={activeSkinId}
        skins={skins}
        unlockedSkins={unlockedSkins}
        onApply={onApply}
        onLocked={onLocked}
        onPreview={onPreview}
      />
      <div className="pack-list">
        {SKIN_PACKS.slice(0, 6).map((pack) => (
          <button key={pack.id} className="pack-row" type="button" onClick={() => onBuyPack(pack.id)}>
            <span>{pack.name}</span>
            <strong>${(pack.price / 100).toFixed(2)}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
