import type { Skin } from '../../shared/types';

interface PaywallModalProps {
  skin: Skin | null;
  onClose: () => void;
  onUpgrade: () => void;
}

export default function PaywallModal({ skin, onClose, onUpgrade }: PaywallModalProps) {
  if (!skin) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="Unlock skin" onClick={(event) => event.stopPropagation()}>
        <div className="modal__swatch" style={{ background: skin.bg, color: skin.text }}>
          <span>{skin.emoji}</span>
        </div>
        <h2>{skin.name}</h2>
        <p>{skin.vibe}</p>
        <button className="primary-button" type="button" onClick={onUpgrade}>
          Unlock ${(skin.price / 100).toFixed(2)}
        </button>
        <button className="ghost-button" type="button" onClick={onClose}>
          Not now
        </button>
      </section>
    </div>
  );
}
