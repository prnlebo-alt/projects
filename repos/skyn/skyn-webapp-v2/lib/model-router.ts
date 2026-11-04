import type { Model, ModelSuggestion } from '@/types/app';

const CODE_PATTERNS    = /\b(code|debug|function|api|sql|apex|soql|javascript|python|typescript|error|bug|fix|refactor|implement|class|variable|loop|algorithm|script|json|html|css)\b/i;
const SEARCH_PATTERNS  = /\b(latest|current|today|news|recent|2024|2025|2026|search|find|what is happening|who is|stock|price|weather|live)\b/i;
const CREATIVE_PATTERNS = /\b(write|story|poem|creative|song|lyrics|script|narrative|blog|essay|draft|imagine|fiction|character|plot|chapter)\b/i;
const ANALYSIS_PATTERNS = /\b(analyze|compare|evaluate|assess|review|summarize|explain|breakdown|strategy|pros and cons|difference between|versus|vs)\b/i;
const MATH_PATTERNS    = /\b(calculate|math|equation|formula|solve|integral|derivative|statistics|probability|geometry)\b/i;

export function suggestModel(message: string): ModelSuggestion {
  if (CODE_PATTERNS.test(message)) {
    return { model: 'claude', reason: 'Claude excels at code and technical reasoning', confidence: 'high' };
  }
  if (SEARCH_PATTERNS.test(message)) {
    return { model: 'gemini', reason: 'Gemini has stronger real-time web awareness', confidence: 'high' };
  }
  if (CREATIVE_PATTERNS.test(message)) {
    return { model: 'gpt', reason: 'GPT-4o is strong for creative writing', confidence: 'medium' };
  }
  if (MATH_PATTERNS.test(message)) {
    return { model: 'claude', reason: 'Claude handles structured reasoning well', confidence: 'medium' };
  }
  if (ANALYSIS_PATTERNS.test(message)) {
    return { model: 'claude', reason: 'Claude preferred for deep analysis', confidence: 'medium' };
  }
  return { model: 'claude', reason: 'Claude recommended as default', confidence: 'low' };
}

export const MODEL_LABELS: Record<Model, string> = {
  claude: 'Claude 3.5',
  gpt:    'GPT-4o',
  gemini: 'Gemini 1.5',
};

export const MODEL_COLORS: Record<Model, string> = {
  claude: '#a78bfa',
  gpt:    '#f97316',
  gemini: '#34d399',
};

export const MODEL_DESCRIPTIONS: Record<Model, string> = {
  claude: 'Best for code, analysis, and long documents',
  gpt:    'Best for creative writing and conversation',
  gemini: 'Best for search-aware and multimodal tasks',
};
