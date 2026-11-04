import { useEffect, useMemo, useState } from 'react';
import BackgroundUploader from './components/BackgroundUploader';
import FontPicker from './components/FontPicker';
import MarketplaceTab from './components/MarketplaceTab';
import PaywallModal from './components/PaywallModal';
import SettingsTab from './components/SettingsTab';
import ShareButton from './components/ShareButton';
import SkinGrid from './components/SkinGrid';
import { FREE_SKINS, SKINS, getSkinById } from '../shared/skins';
import { getLocalStorage, getSyncStorage, LOCAL_STORAGE_DEFAULTS, setLocalStorage, setSyncStorage, STORAGE_DEFAULTS } from '../shared/storage';
import type { LocalStorage, Skin, SkinCategory, SyncStorage } from '../shared/types';

type Tab = 'skins' | 'marketplace' | 'settings';

export default function App() {
  const [sync, setSync] = useState<SyncStorage>(STORAGE_DEFAULTS);
  const [local, setLocal] = useState<LocalStorage>(LOCAL_STORAGE_DEFAULTS);
  const [tab, setTab] = useState<Tab>('skins');
  const [category, setCategory] = useState<'all' | SkinCategory>('all');
  const [previewSkin, setPreviewSkin] = useState<Skin>(getSkinById(STORAGE_DEFAULTS.activeSkinId));
  const [lockedSkin, setLockedSkin] = useState<Skin | null>(null);
  const [notice, setNotice] = useState('');
  const [supportedTab, setSupportedTab] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([getSyncStorage(), getLocalStorage()]).then(([syncState, localState]) => {
      setSync(syncState);
      setLocal(localState);
      setPreviewSkin(getSkinById(syncState.activeSkinId));
    });
    chrome.runtime.sendMessage({ action: 'getActiveTabStatus' }, (response) => {
      setSupportedTab(response?.ok ? Boolean(response.supported) : false);
    });
  }, []);

  const activeSkin = useMemo(() => getSkinById(sync.activeSkinId), [sync.activeSkinId]);
  const visibleUnlockedSkins = useMemo(() => SKINS.filter((skin) => sync.unlockedSkins.includes(skin.id) || skin.free), [sync.unlockedSkins]);
  const proEnabled = sync.plan === 'season_pass' || sync.plan === 'lifetime';

  async function updateSync(values: Partial<SyncStorage>): Promise<void> {
    const next = { ...sync, ...values };
    setSync(next);
    await setSyncStorage(values);
    chrome.runtime.sendMessage({ action: 'refreshActiveTabTheme' }, () => {
      // Touch lastError so Chrome marks it handled. The popup-close race
      // produces "message channel closed" specifically — silently swallow
      // that. Any other error (permission, listener crash) gets a
      // Skyn-prefixed warn so it's still visible during development.
      const err = chrome.runtime.lastError;
      if (err && !/channel closed/i.test(err.message ?? '')) {
        console.warn('[skyn] refreshActiveTabTheme:', err.message);
      }
    });
  }

  async function updateLocal(values: Partial<LocalStorage>): Promise<void> {
    const next = { ...local, ...values };
    setLocal(next);
    await setLocalStorage(values);
    chrome.runtime.sendMessage({ action: 'refreshActiveTabTheme' }, () => {
      const err = chrome.runtime.lastError;
      if (err && !/channel closed/i.test(err.message ?? '')) {
        console.warn('[skyn] refreshActiveTabTheme:', err.message);
      }
    });
  }

  function applySkin(skin: Skin): void {
    setPreviewSkin(skin);
    void updateSync({ activeSkinId: skin.id });
  }

  function showLocked(skin: Skin): void {
    setPreviewSkin(skin);
    setLockedSkin(skin);
  }

  function buyPack(packId: string): void {
    const userEmail = getCheckoutEmail();
    if (!userEmail) return;
    const itemType = packId === 'pack-all' ? 'all_access' : 'pack';
    setBusy(true);
    chrome.runtime.sendMessage({ action: 'startPurchase', itemId: packId, itemType, userEmail }, (response) => {
      setBusy(false);
      setNotice(response?.ok ? 'Checkout opened.' : response?.reason ?? 'Checkout failed.');
    });
  }

  function buySkin(skin: Skin): void {
    const userEmail = getCheckoutEmail();
    if (!userEmail) return;
    setBusy(true);
    chrome.runtime.sendMessage({ action: 'startPurchase', itemId: skin.id, itemType: 'skin', userEmail }, (response) => {
      setBusy(false);
      setNotice(response?.ok ? 'Checkout opened.' : response?.reason ?? 'Checkout failed.');
    });
  }

  function getCheckoutEmail(): string | null {
    const existing = sync.userEmail.trim();
    const email = existing || window.prompt('Email for checkout and license delivery')?.trim() || '';
    if (!email) {
      setNotice('Email is required for checkout.');
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice('Enter a valid email address.');
      return null;
    }
    if (email !== sync.userEmail) {
      void updateSync({ userEmail: email });
    }
    return email;
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <strong>Skyn</strong>
          <span>Dress your AI.</span>
        </div>
        <label className="switch">
          <input checked={sync.coatEnabled} type="checkbox" onChange={(event) => void updateSync({ coatEnabled: event.target.checked })} />
          <span>{sync.coatEnabled ? 'ON' : 'OFF'}</span>
        </label>
      </header>

      <nav className="tabs" aria-label="Popup tabs">
        <button className={tab === 'skins' ? 'is-active' : ''} type="button" onClick={() => setTab('skins')}>My Skins</button>
        <button className={tab === 'marketplace' ? 'is-active' : ''} type="button" onClick={() => setTab('marketplace')}>Market</button>
        <button className={tab === 'settings' ? 'is-active' : ''} type="button" onClick={() => setTab('settings')}>Settings</button>
      </nav>

      {!sync.hasSeenOnboarding && (
        <section className="onboarding">
          <strong>Pick a skin. Open a supported AI tab. Skyn handles the rest.</strong>
          <button type="button" onClick={() => void updateSync({ hasSeenOnboarding: true })}>Got it</button>
        </section>
      )}

      {supportedTab === false && (
        <div className="notice">Open Claude to preview changes on the page.</div>
      )}

      {busy && <div className="notice">Working...</div>}

      {notice && <button className="notice" type="button" onClick={() => setNotice('')}>{notice}</button>}

      {tab === 'skins' && (
        <section className="tab-panel">
          <div className="toolbar-row">
            <label className="field">
              <span>Skin</span>
              <select value={sync.activeSkinId} onChange={(event) => applySkin(getSkinById(event.target.value))}>
                {visibleUnlockedSkins.map((skin) => <option key={skin.id} value={skin.id}>{skin.name}</option>)}
              </select>
            </label>
            <FontPicker
              activeFontId={sync.activeFontId}
              proEnabled={proEnabled}
              onChange={(activeFontId) => void updateSync({ activeFontId })}
              onLocked={() => setNotice('Pro fonts unlock with Season Pass.')}
            />
          </div>

          <LivePreview skin={previewSkin.id === activeSkin.id ? activeSkin : previewSkin} />

          <div className="action-row">
            <BackgroundUploader
              disabled={false}
              hasBackground={Boolean(local.backgroundImage)}
              opacity={local.bgOpacityOverride}
              onClear={() => void updateLocal({ backgroundImage: null, bgOpacityOverride: null })}
              onError={setNotice}
              onOpacityChange={(bgOpacityOverride) => void updateLocal({ bgOpacityOverride })}
              onUpload={(backgroundImage) => void updateLocal({ backgroundImage })}
            />
            <ShareButton onError={setNotice} />
          </div>

          <SkinGrid
            compact
            activeSkinId={sync.activeSkinId}
            skins={visibleUnlockedSkins}
            unlockedSkins={sync.unlockedSkins}
            onApply={applySkin}
            onLocked={showLocked}
            onPreview={setPreviewSkin}
          />

          <button className="primary-button" type="button" onClick={() => setTab('marketplace')}>
            Unlock more
          </button>
        </section>
      )}

      {tab === 'marketplace' && (
        <MarketplaceTab
          activeSkinId={sync.activeSkinId}
          category={category}
          unlockedSkins={sync.unlockedSkins}
          onApply={applySkin}
          onBuyPack={buyPack}
          onCategoryChange={setCategory}
          onLocked={showLocked}
          onPreview={setPreviewSkin}
        />
      )}

      {tab === 'settings' && (
        <SettingsTab
          enabled={sync.coatEnabled}
          plan={sync.plan}
          unlockedCount={sync.unlockedSkins.length}
          userEmail={sync.userEmail}
          onEmailChange={(userEmail) => void updateSync({ userEmail })}
          onReset={() => {
            void updateSync({ ...STORAGE_DEFAULTS, unlockedSkins: [...FREE_SKINS] });
            void updateLocal(LOCAL_STORAGE_DEFAULTS);
          }}
          onToggle={(coatEnabled) => void updateSync({ coatEnabled })}
          onValidate={() => chrome.runtime.sendMessage({ action: 'validateLicenseNow' }, () => setNotice('License checked.'))}
        />
      )}

      <PaywallModal
        skin={lockedSkin}
        onClose={() => setLockedSkin(null)}
        onUpgrade={() => {
          if (lockedSkin) buySkin(lockedSkin);
          setLockedSkin(null);
        }}
      />
    </main>
  );
}

function LivePreview({ skin }: { skin: Skin }) {
  return (
    <section className="live-preview" style={{ background: skin.bg, color: skin.text, borderColor: skin.border }}>
      <aside style={{ background: skin.sidebar }}>
        <span />
        <span />
        <span />
      </aside>
      <div>
        <p className="bubble user" style={{ background: skin.bubbleUser, borderRadius: skin.bubbleUserRadius, color: skin.text }}>Make it feel like me.</p>
        <p className="bubble ai" style={{ background: skin.bubbleAi, borderRadius: skin.bubbleAiRadius, color: skin.text }}>Done. Your assistant has a new skin.</p>
        <div className="fake-input" style={{ background: skin.bubbleAi, borderColor: skin.border }} />
      </div>
    </section>
  );
}
