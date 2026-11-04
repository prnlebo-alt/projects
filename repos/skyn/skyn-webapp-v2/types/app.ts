export type Plan = 'free' | 'starter' | 'pro' | 'team';
export type Model = 'claude' | 'gpt' | 'gemini';
export type Role = 'user' | 'assistant' | 'system';
export type WorkspaceRole = 'admin' | 'member' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  api_key_anthropic: string | null;
  api_key_openai: string | null;
  api_key_google: string | null;
  theme: string;
  messages_used_this_month: number;
  billing_period_start: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  model: Model;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  model: Model | null;
  tokens_input: number;
  tokens_output: number;
  created_at: string;
}

export interface Prompt {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  content: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  conversation_id: string | null;
  model: Model;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  created_at: string;
}

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ModelSuggestion {
  model: Model;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ThemeDefinition {
  id: string;
  name: string;
  cat: 'dark' | 'light' | 'vibrant' | 'special' | 'glass' | 'tropical' | 'bubble' | 'gamer' | 'cloud';
  accent: string;
  bg: string;
}
