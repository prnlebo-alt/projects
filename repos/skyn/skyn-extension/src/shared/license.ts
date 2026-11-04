import { FREE_SKINS } from './skins';
import type { Plan, SkinId } from './types';

const SKYN_API = 'https://skynapp.app/api';

export interface LicenseValidationResult {
  valid: boolean;
  plan: Plan;
  unlockedSkins: string[];
}

export async function validateLicense(token: string): Promise<LicenseValidationResult> {
  try {
    const response = await fetch(`${SKYN_API}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) throw new Error('Validation failed');
    return await response.json() as LicenseValidationResult;
  } catch {
    return {
      valid: true,
      plan: 'free',
      unlockedSkins: [...FREE_SKINS],
    };
  }
}

export function shouldValidateLicense(lastValidated: number, now = Date.now()): boolean {
  return now - lastValidated >= 24 * 60 * 60 * 1000;
}

export function isUnlocked(skinId: SkinId, unlockedSkins: string[]): boolean {
  return FREE_SKINS.includes(skinId) || unlockedSkins.includes(skinId) || unlockedSkins.includes('all');
}
