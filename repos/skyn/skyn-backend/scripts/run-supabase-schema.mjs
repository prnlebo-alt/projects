import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

loadEnvLocal();

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL in .env.local');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

try {
  const schema = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8');
  await client.connect();
  await client.query(schema);
  console.log('Supabase schema applied.');
} finally {
  await client.end();
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
    const value = trimmed.slice(separator + 1).replace(/^"|"$/g, '');
    process.env[key] = value;
  }
}
