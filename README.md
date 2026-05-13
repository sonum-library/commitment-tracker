# Commitment Tracker

A lightweight tool for coaching clients to keep their between-session commitments visible and check them off as they complete them.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
- Deployed to Cloudflare Pages

---

## 1. Supabase setup

### Create the table

1. Open your Supabase project → **SQL Editor**
2. Paste the contents of `supabase-setup.sql` and click **Run**

This creates the `commitment_tracker_items` table with Row Level Security enabled so each user only ever sees their own rows.

### Enable Google OAuth

1. In Supabase: **Authentication → Providers → Google**
2. Toggle Google on and enter your **Client ID** and **Client Secret** from Google Cloud Console
3. Copy the **Callback URL** shown — you'll add it to Google next

In [Google Cloud Console](https://console.cloud.google.com/):
1. Go to **APIs & Services → Credentials → your OAuth 2.0 Client**
2. Under **Authorized redirect URIs**, add:
   - The Supabase callback URL (from step 3 above)
   - `https://your-pages-domain.pages.dev` (once you have it)

---

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in Supabase: **Project Settings → API**.

`.env.local` is gitignored — never commit real keys.

---

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 4. Deploy to Cloudflare Pages

### Connect the repo

1. Push this project to a new GitHub repository
2. In [Cloudflare Pages](https://pages.cloudflare.com/): **Create a project → Connect to Git**
3. Select your repo and use these build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Under **Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

### Update Supabase URL configuration

After Cloudflare gives you a URL (e.g. `https://commitment-tracker.pages.dev`):

1. In Supabase: **Authentication → URL Configuration**
   - **Site URL:** `https://commitment-tracker.pages.dev`
   - **Redirect URLs:** add `https://commitment-tracker.pages.dev`
2. In Google Cloud Console → your OAuth client:
   - **Authorized redirect URIs:** add `https://commitment-tracker.pages.dev`

---

## 5. Sharing with clients

Each client signs in with their own Google account. Their commitments are completely separate from other users — RLS ensures that at the database level.
