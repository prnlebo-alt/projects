export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('your_') || value === 'placeholder' || value.includes('placeholder.supabase.co')) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function isPlaceholder(value: string | undefined) {
  return !value || value.startsWith('your_') || value === 'placeholder' || value.includes('placeholder.supabase.co');
}
