import Stripe from 'stripe';
import { getPlanForPurchase, getUnlockedSkinsForItem, normalizeItemId, STRIPE_PURCHASE_PRODUCTS, type PurchaseItemType } from './catalog';
import { generateLicenseToken } from './license';
import { recordPurchase, updateUserLicense, upsertUserByEmail } from './supabase';

export interface FulfillmentResult {
  token: string;
  unlockedSkins: string[];
}

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<FulfillmentResult> {
  if (session.payment_status !== 'paid') {
    throw new Error('Payment is not complete.');
  }

  const itemType = session.metadata?.itemType as PurchaseItemType | undefined;
  const rawItemId = session.metadata?.itemId;
  if (!itemType || !STRIPE_PURCHASE_PRODUCTS[itemType]) throw new Error('Stripe session is missing item type metadata.');
  if (!rawItemId) throw new Error('Stripe session is missing item metadata.');
  if (!session.customer_email) throw new Error('Stripe session is missing customer email.');

  const itemId = normalizeItemId(itemType, rawItemId);
  const unlockedSkins = getUnlockedSkinsForItem(itemId);
  const plan = getPlanForPurchase(itemType, itemId);
  const user = await upsertUserByEmail(session.customer_email);
  const mergedUnlockedSkins = mergeUnlockedSkins(user.unlocked_skins, unlockedSkins);
  const token = await generateLicenseToken({
    userId: user.id,
    plan,
    unlockedSkins: mergedUnlockedSkins,
  });

  await updateUserLicense(user.id, {
    plan,
    unlocked_skins: mergedUnlockedSkins,
    license_token: token,
  });
  await recordPurchase({
    user_id: user.id,
    item_id: itemId,
    stripe_session_id: session.id,
    amount: session.amount_total ?? STRIPE_PURCHASE_PRODUCTS[itemType].amount,
  });

  return { token, unlockedSkins: mergedUnlockedSkins };
}

function mergeUnlockedSkins(existing: string[], purchased: string[]): string[] {
  if (existing.includes('all') || purchased.includes('all')) return ['all'];
  return Array.from(new Set([...existing, ...purchased]));
}
