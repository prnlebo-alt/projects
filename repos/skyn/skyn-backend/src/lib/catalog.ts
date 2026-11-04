export type Plan = 'free' | 'season_pass' | 'lifetime';
export type PurchaseItemType = 'skin' | 'pack' | 'all_access' | 'season_pass';

export const FREE_SKINS = ['midnight', 'snow', 'glass-day'];

export const SKIN_PRICES: Record<string, number> = {
  cyber: 299,
  neon: 299,
  lava: 299,
  galaxy: 299,
  matrix: 299,
  retro: 299,
  sakura: 299,
  'glass-dusk': 299,
  'glass-night': 299,
  'glass-warm': 299,
  'glass-emerald': 299,
  'glass-rose': 299,
};

export const PACKS: Record<string, { name: string; price: number; skins: string[] | 'all'; plan?: Plan }> = {
  'pack-dark': { name: 'Dark Pack', price: 799, skins: ['obsidian','aurora','crimson','navy','forest','amber','rose','slate','cyber','onyx','abyss','void'] },
  'pack-light': { name: 'Light Pack', price: 799, skins: ['ivory','cream','arctic','blush','mint','lavender','sunrise','paper','zinc','parchment','cloud','linen'] },
  'pack-vibrant': { name: 'Vibrant Pack', price: 699, skins: ['neon','candy','ocean','lava','galaxy','matrix','acid','plasma'] },
  'pack-glass': { name: 'Glass Pack', price: 599, skins: ['glass-day','glass-dusk','glass-night','glass-warm','glass-emerald','glass-rose'] },
  'pack-holiday': { name: 'Holiday Pack', price: 999, skins: ['halloween','christmas','winter-night','new-year','valentine','st-patrick','easter','fourth-july','thanksgiving','hanukkah','diwali','lunar-new-year','eid','pride'] },
  'pack-sports': { name: 'Sports Pack', price: 999, skins: ['purple-gold','black-gold','green-white','red-white','navy-orange','silver-teal','black-red','blue-yellow','scarlet-gray','orange-black','green-yellow','red-gold'] },
  'pack-abstract': { name: 'Abstract Pack', price: 699, skins: ['bauhaus','mondrian','memphis','brutalist','vaporwave','glitch','isometric','constructivist'] },
  'pack-attitude': { name: 'Attitude Pack', price: 799, skins: ['punk','metal','grunge','rage','toxic','anarchist','goth','rave','streetwear','skater'] },
  'pack-pretty': { name: 'Pretty Pack', price: 699, skins: ['cottagecore','pastel-dream','fairytale','bubblegum','peach','lilac','cloud-nine','rosegold'] },
  'pack-nature': { name: 'Nature Pack', price: 799, skins: ['deep-ocean','jungle','desert','arctic-wild','volcano','storm','northern-lights','autumn','blossom','underwater'] },
  'pack-scifi': { name: 'Sci-fi & Gaming Pack', price: 799, skins: ['holo','synthwave','terminal','arcade','mech','hyperspace','dungeon','pixel','biohazard','cyberpunk-city'] },
  'pack-special': { name: 'Special Pack', price: 699, skins: ['retro','nordic','sakura','sand','mono','blueprint','film-noir','woodblock'] },
  'pack-all': { name: 'All-Access Lifetime', price: 2499, skins: 'all', plan: 'lifetime' },
};

export const STRIPE_PURCHASE_PRODUCTS: Record<PurchaseItemType, {
  name: string;
  amount: number;
  mode: 'payment' | 'subscription';
  lookupKey: string;
}> = {
  skin: {
    name: 'Individual skin',
    amount: 199,
    mode: 'payment',
    lookupKey: 'skyn_individual_skin_once_199',
  },
  pack: {
    name: 'Skin pack',
    amount: 699,
    mode: 'payment',
    lookupKey: 'skyn_skin_pack_once_699',
  },
  all_access: {
    name: 'All-Access Lifetime',
    amount: 2499,
    mode: 'payment',
    lookupKey: 'skyn_all_access_lifetime_once_2499',
  },
  season_pass: {
    name: 'Season Pass',
    amount: 399,
    mode: 'subscription',
    lookupKey: 'skyn_season_pass_monthly_399',
  },
};

export function getSkinPrice(skinId: string): number {
  if (FREE_SKINS.includes(skinId)) return 0;
  return SKIN_PRICES[skinId] ?? 199;
}

export function getUnlockedSkinsForItem(itemId: string): string[] {
  const pack = PACKS[itemId];
  if (pack?.skins === 'all') return ['all'];
  if (pack) return Array.from(new Set([...FREE_SKINS, ...pack.skins]));
  return Array.from(new Set([...FREE_SKINS, itemId]));
}

export function getPlanForItem(itemId: string): Plan {
  return PACKS[itemId]?.plan ?? 'free';
}

export function getPlanForPurchase(itemType: PurchaseItemType, itemId: string): Plan {
  if (itemType === 'all_access') return 'lifetime';
  if (itemType === 'season_pass') return 'season_pass';
  return getPlanForItem(itemId);
}

export function getAmountForItem(itemId: string): number {
  return PACKS[itemId]?.price ?? getSkinPrice(itemId);
}

export function getNameForItem(itemId: string): string {
  return PACKS[itemId]?.name ?? `Skyn skin: ${itemId}`;
}

export function normalizeItemId(itemType: PurchaseItemType, itemId: string): string {
  if (itemType === 'all_access') return 'pack-all';
  if (itemType === 'season_pass') return 'season-pass';
  return itemId;
}
