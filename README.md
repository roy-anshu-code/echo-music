# Echo — personal music library

A private music-library starter built with Next.js and Supabase.

## 1. Install

```bash
npm install
```

## 2. Create a Supabase project

Create a project at https://supabase.com/dashboard.

In **Project Settings / API** (or the project's Connect panel), copy:
- Project URL
- Publishable key (the `sb_publishable_...` key)

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Do not use a `service_role` or secret key in a `NEXT_PUBLIC_` variable.

## 3. Create the database

Open **SQL Editor** in Supabase and run all SQL from `supabase-setup.sql`.

## 4. Create private storage

In Supabase, open **Storage → New bucket**:
- Name: `music`
- Public bucket: **OFF**
- File size limit: `20 MB` if the dashboard offers this setting.
- Allowed MIME types: audio types if you want to restrict uploads. Some browsers report uncommon audio types inconsistently, so the app also checks extensions.

Then run the storage policies from `supabase-storage-policies.sql` in SQL Editor.

## 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

Create an account with your email and a password. If email confirmation is enabled, confirm the email first, then sign in.

## Notes

- Each account can only access its own songs and playlists when the SQL policies and private bucket policies are installed correctly.
- Uploads are limited to 20 MB per song in the interface.
- Playback uses short-lived signed URLs for private audio.
- This starter is a first version; test login, upload, playback, deletion, and playlist operations before deploying.
- Favorites in this starter are stored in the current browser session and are not yet synced to the database.
- Offline playback is not implemented.
