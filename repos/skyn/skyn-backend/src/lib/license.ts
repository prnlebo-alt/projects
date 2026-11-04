import { jwtVerify, SignJWT } from 'jose';
import { requireEnv } from './env';
import { FREE_SKINS, type Plan } from './catalog';

export interface LicensePayload {
  userId: string;
  plan: Plan;
  unlockedSkins: string[];
}

export async function generateLicenseToken(payload: LicensePayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    plan: payload.plan,
    unlockedSkins: payload.unlockedSkins,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(getJwtSecret());
}

export async function validateLicenseToken(token: string): Promise<LicensePayload> {
  const result = await jwtVerify(token, getJwtSecret());
  const userId = typeof result.payload.userId === 'string' ? result.payload.userId : result.payload.sub;
  if (!userId) throw new Error('License token is missing subject.');

  return {
    userId,
    plan: result.payload.plan === 'season_pass' || result.payload.plan === 'lifetime' ? result.payload.plan : 'free',
    unlockedSkins: Array.isArray(result.payload.unlockedSkins)
      ? result.payload.unlockedSkins.filter((item): item is string => typeof item === 'string')
      : [...FREE_SKINS],
  };
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'));
}
