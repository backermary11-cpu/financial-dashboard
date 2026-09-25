# Putting blazynumb online

About 15 minutes, no coding. You'll create two free accounts:

- **Supabase** stores your data and handles sign-in.
- **Vercel** hosts the app at its own web address.

## 1. Create the database (Supabase)

1. Go to <https://supabase.com> and click **Start your project**. Sign up with GitHub.
2. Click **New project**. Name it `blazynumb`, set a database password (save it somewhere), pick the region closest to you, and click **Create new project**. Wait about 2 minutes.
3. In the left sidebar open **SQL Editor** and click **New query**.
4. Open [`supabase/schema.sql`](../supabase/schema.sql) in this repo, copy everything, paste it into the editor, and click **Run**. You should see "Success. No rows returned".
5. **Turn on sign-in codes.** Go to **Authentication → Emails** (called **Email Templates** in some versions) and open the **Magic Link** template. Replace its body with:

   ```html
   <h2>Your blazynumb code</h2>
   <p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
   ```

   Click **Save**.

   Can't find it? Skip this step. Supabase's default email has a sign-in link instead of a code, and tapping it signs you in on the device where you tap it. The one catch: on iPhone the link opens Safari instead of the installed app, so with the default email, sign in once in Safari first. The code works everywhere, so it's worth adding later.
6. Go to **Project Settings → API** and keep that tab open. You'll need two values from it in step 2:
   - **Project URL**, like `https://abcd1234.supabase.co`
   - **anon public** key, a long string starting with `eyJ` (or `sb_publishable_`)

## 2. Put the app online (Vercel)

1. Go to <https://vercel.com/signup> and sign up with GitHub.
2. Click **Add New… → Project** and **Import** `financial-dashboard`. If it isn't listed, click **Adjust GitHub App Permissions** and allow it.
   Change **Project Name** to `blazynumb`. That makes your address `blazynumb.vercel.app` if the name is free; otherwise Vercel adds a few letters.
3. Open **Environment Variables** and add both values from Supabase:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

4. Click **Deploy**. After about a minute you get your link, like `https://blazynumb.vercel.app`.

> Vercel deploys the repo's main branch. If the app code is still on a separate branch, merge its pull request first.

## 3. Tell Supabase your web address

In Supabase go to **Authentication → URL Configuration**, set **Site URL** to your Vercel link, and click **Save**.

## 4. Install it on your phone

Open your Vercel link on your phone, then:

- **iPhone (Safari):** tap **Share** → **Add to Home Screen** → **Add**.
- **Android (Chrome):** tap **Install app** at the bottom of the page, or **⋮** → **Install app**.

Open it from the new icon and tap **Sign in to sync**. Enter your email, then the 6-digit code you receive. Sign in with the same email on your computer and both show the same data.

## Good to know

- The app works offline. Changes made without a connection save when you're back online.
- The first time you sign in, whatever is on that device is uploaded to your account. On other devices, your account's data replaces what's there. Clear the sample data first if you don't want it saved.
- Supabase's free plan sends a limited number of sign-in emails per hour. That's plenty for personal use.
- Security: row-level security means each account can only read its own data. The anon key is designed to be public, so it's safe in the app.
