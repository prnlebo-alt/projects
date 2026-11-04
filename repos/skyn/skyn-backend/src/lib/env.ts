export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://skynapp.app';
}
