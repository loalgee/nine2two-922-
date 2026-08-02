# nine2two — Setup Walkthrough

Everything you need to go from zero to a live, shared Hollywood restroom map.
Total time: about 20 minutes. Cost: $0 (Supabase free tier + GitHub Pages).

---

## Step 1 — Create your Supabase account (~2 min)

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign up with **GitHub** (recommended, since your code already lives there)
   or email. The free tier is enough for the whole MVP — no credit card.

## Step 2 — Create the project (~3 min)

1. On the dashboard, click **New project**.
2. Fill in:
   - **Organization:** your default org is fine.
   - **Project name:** `nine2two`
   - **Database password:** click **Generate a password** and save it
     somewhere safe (password manager). You rarely need it, but don't lose it.
   - **Region:** **West US (North California)** — closest to Hollywood users.
3. Click **Create new project** and wait ~2 minutes while it provisions.

## Step 3 — Create the database (~2 min)

1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Open `supabase/schema.sql` from this repo, copy the **entire file**, paste
   it into the editor, and click **Run** (or Cmd/Ctrl+Enter).
4. You should see "Success. No rows returned." That created:
   - `restrooms`, `reviews`, `reports`, `admins` tables (PRD §5)
   - Row Level Security so anonymous users can read/rate but never edit or
     delete, and only admins can moderate (PRD §4.6–4.7)
   - the trigger that flips an imported listing to **verified** on its first
     community rating (PRD §4.5)
   - the `restrooms_with_stats` view (average score, rating count, last-rated)

## Step 4 — Get your API credentials (~1 min)

1. Sidebar → **Project Settings** (gear icon) → **Data API**.
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. In the **API Keys** section on the same page (or its "API Keys" tab), copy the
   **`anon` `public`** key — the long string starting with `eyJ…` or `sb_publishable_…`.
   ⚠️ **Never** copy the `service_role` secret key into the app.

## Step 5 — Configure the app (~1 min)

1. Open `js/config.js` in this repo.
2. Replace the two placeholders with your Project URL and anon key.
3. Commit. (Yes, committing the anon key is fine — it's public by design;
   Row Level Security is what protects the data.)

To test locally:

```sh
python3 -m http.server 8000
# visit http://localhost:8000 — the yellow setup banner should be gone
```

Add a test restroom (＋ → tap map → form). Then check Supabase →
**Table Editor** → `restrooms`: your row should be there.

## Step 6 — Make yourself the admin (~3 min)

Admin sign-in uses passwordless **magic links** (email), which Supabase
enables by default.

1. Open the app with `?admin=1` on the URL, e.g.
   `http://localhost:8000/?admin=1`, and tap **⚑ Admin**.
2. Enter your email and tap **Send sign-in link**.
3. Open the email (subject "Confirm Your Signup" / "Magic Link") and click
   the link **on the same device/browser**. You'll land back in the app,
   signed in.
4. Now grant that account admin rights. In Supabase → **SQL Editor**, run
   (with your real email):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

5. Reopen **⚑ Admin** in the app — you'll see the moderation queue instead
   of the sign-in screen.

> If the magic-link email lands you on a broken page after you deploy
> (Step 8), set Supabase → **Authentication → URL Configuration →
> Site URL** to your deployed URL, and add it to **Redirect URLs**.

## Step 7 — Import the Hollywood seed data (~1 min)

In the admin panel, tap **⬇ Import Hollywood seed data**. This pulls the 50
nearest listings from the Refuge Restrooms public API and inserts them as
**gray, unverified** pins (PRD §4.5). Rate one and watch it flip to verified.

Toward the §8 launch goal of 75+ verified listings: the import gives you the
base; your own field-verification ratings do the rest.

## Step 8 — Deploy free on GitHub Pages (~3 min)

1. Merge this branch to `main` (or point Pages at this branch).
2. On GitHub: repo → **Settings → Pages**.
3. Under **Build and deployment**: Source = **Deploy from a branch**,
   Branch = `main`, folder = `/ (root)`. Save.
4. In a minute or two your app is live at
   `https://<your-username>.github.io/<repo-name>/`.
5. Do the Site URL fix from the Step 6 note so admin magic links work on the
   live URL.
6. On your phone, open the live URL → browser menu → **Add to Home Screen**.
   Thanks to the manifest it installs like an app (PWA).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Yellow banner "Supabase isn't configured" | `js/config.js` still has placeholder values |
| "Could not load restrooms" | Wrong URL/key in config, or schema.sql not run |
| Posting a restroom fails | Re-run `supabase/schema.sql` (RLS policies missing) |
| Admin panel says "not on the admin list" | Run the Step 6 SQL with the exact email you signed in with |
| Magic link opens a 404 | Set Site URL + Redirect URLs (Step 6 note) |
| Seed import fails | You must be signed in as admin; check the browser console |
