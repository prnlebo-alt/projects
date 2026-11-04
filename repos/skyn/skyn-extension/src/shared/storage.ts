import type { LocalStorage, SyncStorage } from './types';

export const STORAGE_DEFAULTS: SyncStorage = {
  activeSkinId: 'midnight',
  activeFontId: 'system',
  coatEnabled: true,
  unlockedSkins: ['midnight', 'snow', 'glass-day'],
  licenseToken: null,
  userEmail: '',
  plan: 'free',
  lastValidated: 0,
  hasSeenOnboarding: false,
};

export const LOCAL_STORAGE_DEFAULTS: LocalStorage = {
  backgroundImage: null,
  bgOpacityOverride: null,
  customSkins: [],
  panelOpen: false,
};

export async function getSyncStorage(): Promise<SyncStorage> {
  const stored = await chrome.storage.sync.get(toStorageDefaults(STORAGE_DEFAULTS));
  return { ...STORAGE_DEFAULTS, ...stored } as SyncStorage;
}

export async function getLocalStorage(): Promise<LocalStorage> {
  const stored = await chrome.storage.local.get(toStorageDefaults(LOCAL_STORAGE_DEFAULTS));
  return { ...LOCAL_STORAGE_DEFAULTS, ...stored } as LocalStorage;
}

export async function setSyncStorage(values: Partial<SyncStorage>): Promise<void> {
  await chrome.storage.sync.set(values);
}

export async function setLocalStorage(values: Partial<LocalStorage>): Promise<void> {
  await chrome.storage.local.set(values);
}

function toStorageDefaults<T extends object>(values: T): Record<string, unknown> {
  return values as Record<string, unknown>;
}
