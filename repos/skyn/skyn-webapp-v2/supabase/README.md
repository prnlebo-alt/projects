# Supabase Setup

Run `supabase/migrations/0001_initial_schema.sql` in your Supabase SQL editor before testing production mode.

Set these Auth URLs in Supabase:

Site URL:

```text
http://localhost:3000
```

Redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
```

For production, add:

```text
https://your-domain.com/auth/callback
```

Enable the Google provider under Auth Providers, then add your Google OAuth client ID and secret.
