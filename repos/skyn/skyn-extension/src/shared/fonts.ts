export interface FontOption {
  id: string;
  name: string;
  family: string;
  url?: string;
  tier: 'free' | 'pro';
  vibe: string;
}

export const FONTS: FontOption[] = [
  { id:'system',    name:'System',          family:'system-ui,-apple-system,sans-serif', tier:'free', vibe:'Default clean' },
  { id:'mono',      name:'Terminal',        family:'"Courier New",Courier,monospace', tier:'free', vibe:'Hacker mode' },
  { id:'serif',     name:'Editorial',       family:'Georgia,"Times New Roman",serif', tier:'free', vibe:'Classic feel' },
  { id:'inter',     name:'Inter',           family:'"Inter",system-ui,sans-serif', url:'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap', tier:'pro', vibe:'Modern pro' },
  { id:'jetbrains', name:'JetBrains Mono',  family:'"JetBrains Mono",monospace', url:'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap', tier:'pro', vibe:'Dev energy' },
  { id:'playfair',  name:'Playfair',        family:'"Playfair Display",serif', url:'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap', tier:'pro', vibe:'Elegant & rich' },
  { id:'space',     name:'Space Grotesk',   family:'"Space Grotesk",sans-serif', url:'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap', tier:'pro', vibe:'Sci-fi nerdy' },
  { id:'bangers',   name:'Bangers',         family:'"Bangers",cursive', url:'https://fonts.googleapis.com/css2?family=Bangers&display=swap', tier:'pro', vibe:'Comic & fun' },
];

export function getFontById(id: string): FontOption {
  return FONTS.find((font) => font.id === id) ?? FONTS[0];
}
