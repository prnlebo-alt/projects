import Stripe from 'stripe';
import { STRIPE_PURCHASE_PRODUCTS, type PurchaseItemType } from './catalog';
import { requireEnv } from './env';

export function getStripe(): Stripe {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-04-22.dahlia',
  });
}

export async function getOrCreatePriceForPurchase(itemType: PurchaseItemType): Promise<string> {
  const config = STRIPE_PURCHASE_PRODUCTS[itemType];
  const stripe = getStripe();
  const existingPrices = await stripe.prices.list({
    active: true,
    lookup_keys: [config.lookupKey],
    limit: 1,
  });

  if (existingPrices.data[0]) return existingPrices.data[0].id;

  const product = await getOrCreateProduct(itemType, config.name);
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: config.amount,
    product: product.id,
    lookup_key: config.lookupKey,
    recurring: config.mode === 'subscription' ? { interval: 'month' } : undefined,
    metadata: {
      skyn_item_type: itemType,
    },
  });

  return price.id;
}

async function getOrCreateProduct(itemType: PurchaseItemType, name: string): Promise<Stripe.Product> {
  const stripe = getStripe();
  const products = await stripe.products.list({
    active: true,
    limit: 100,
  });
  const existing = products.data.find((product) => product.metadata.skyn_product_key === itemType);
  if (existing) return existing;

  return stripe.products.create({
    name,
    metadata: {
      skyn_product_key: itemType,
    },
  });
}
