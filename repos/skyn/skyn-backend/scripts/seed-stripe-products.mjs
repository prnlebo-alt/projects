import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Stripe from 'stripe';

loadEnvLocal();

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('Missing STRIPE_SECRET_KEY in .env.local');
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: '2026-04-22.dahlia',
});

const products = [
  {
    itemType: 'skin',
    name: 'Individual skin',
    amount: 199,
    mode: 'payment',
    lookupKey: 'skyn_individual_skin_once_199',
  },
  {
    itemType: 'pack',
    name: 'Skin pack',
    amount: 699,
    mode: 'payment',
    lookupKey: 'skyn_skin_pack_once_699',
  },
  {
    itemType: 'all_access',
    name: 'All-Access Lifetime',
    amount: 2499,
    mode: 'payment',
    lookupKey: 'skyn_all_access_lifetime_once_2499',
  },
  {
    itemType: 'season_pass',
    name: 'Season Pass',
    amount: 399,
    mode: 'subscription',
    lookupKey: 'skyn_season_pass_monthly_399',
  },
];

const results = [];

for (const config of products) {
  const product = await getOrCreateProduct(config);
  const price = await getOrCreatePrice(product.id, config);
  results.push({
    itemType: config.itemType,
    productId: product.id,
    priceId: price.id,
    lookupKey: config.lookupKey,
  });
}

console.log(JSON.stringify(results, null, 2));

async function getOrCreateProduct(config) {
  const productsPage = await stripe.products.search({
    query: `metadata['skyn_product_key']:'${config.itemType}'`,
    limit: 1,
  });

  if (productsPage.data[0]) return productsPage.data[0];

  return stripe.products.create({
    name: config.name,
    metadata: {
      skyn_product_key: config.itemType,
    },
  });
}

async function getOrCreatePrice(productId, config) {
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [config.lookupKey],
    limit: 1,
  });

  if (prices.data[0]) return prices.data[0];

  return stripe.prices.create({
    currency: 'usd',
    unit_amount: config.amount,
    product: productId,
    lookup_key: config.lookupKey,
    recurring: config.mode === 'subscription' ? { interval: 'month' } : undefined,
    metadata: {
      skyn_item_type: config.itemType,
    },
  });
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  const contents = readFileSync(envPath, 'utf8');

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] = value;
  }
}
