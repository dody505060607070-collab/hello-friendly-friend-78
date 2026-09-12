# Shared Employee Chat — Mithraa ↔ Al-Rashoudi

Both sites share ONE Lovable Cloud backend (the Mithraa project's backend).
The second site (Al-Rashoudi) must connect to the SAME backend instead of creating a new one.

## 1. Connect the second project to the same backend

In the Al-Rashoudi Lovable project, set these environment values to the Mithraa project's backend:

- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)

Do NOT create new tables for chat — they already exist.

## 2. Schema already in place

- `public.profiles.org` — text, default `'mithraa'`. Values: `mithraa` | `rashoudi`.
- `public.group_messages.channel` — text, default `'mithraa'`. Values: `mithraa` | `rashoudi` | `shared`.
- `public.user_org(uuid)` — security definer function returning the user's org.

RLS on `group_messages`:
- SELECT/INSERT allowed when the row's `channel` is `shared`, equals the caller's org, or the caller is `super_admin`.

## 3. What the Al-Rashoudi site must do

- On employee creation, set `profiles.org = 'rashoudi'`.
- Chat page shows two channels: `rashoudi` (own team) and `shared` (both companies).
- Always send `channel` on every `group_messages` insert.
- Realtime is enabled on `group_messages`; subscribe to `postgres_changes` on that table.

## 4. Do not change

- Don't rename or drop `channel` / `org`.
- Don't widen the RLS policies.
- Don't change the default of `channel` (`mithraa`), old messages rely on it.

## 5. Owner view

A `super_admin` account sees all three channels from either site with one login.
