import type { Plan } from './types';

const SKYN_API = 'https://skynapp.app/api';

export type PurchaseItemType = 'skin' | 'pack' | 'all_access' | 'season_pass';

export interface PurchaseIntentRequest {
  itemId: string;
  itemType: PurchaseItemType;
  userEmail: string;
}

export interface PurchaseIntentResponse {
  checkoutUrl: string;
}

export interface PurchaseVerifyResponse {
  token: string;
  unlockedSkins: string[];
  plan?: Plan;
}

export async function createPurchaseIntent(request: PurchaseIntentRequest): Promise<PurchaseIntentResponse> {
  const response = await fetch(`${SKYN_API}/purchase/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) throw new Error('Could not start checkout.');
  return await response.json() as PurchaseIntentResponse;
}

export async function verifyPurchase(sessionId: string): Promise<PurchaseVerifyResponse> {
  const response = await fetch(`${SKYN_API}/purchase/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) throw new Error('Could not verify purchase.');
  return await response.json() as PurchaseVerifyResponse;
}
