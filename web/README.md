This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Admin API (Secure) for Membership Management

We provide server-only admin endpoints to inspect and repair `user_program_memberships`. These routes require server environment variables and an admin token header.

### Required env variables (server)

Create a `.env.local` in `web/` with at least:

```
NEXT_PUBLIC_SUPABASE_URL=https://lbanldhbmuabmybtlkbs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Server-only
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_API_TOKEN=some-long-random-string
```

Notes:
- Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` on the client. It is only read on the server.
- The admin routes will reject requests unless `x-admin-token` matches `ADMIN_API_TOKEN`.

### Endpoints

- GET `./api/admin/memberships/list?user_id=<uuid>`
  - Lists memberships. If `user_id` omitted, returns all.

- POST `./api/admin/memberships/ensure`
  - Body: `{ "user_id": "<uuid>", "program_id": "<uuid>" }`
  - Creates membership if missing; idempotent.

### curl examples

```
# List all memberships
curl -s "http://localhost:3000/api/admin/memberships/list" \
  -H "x-admin-token: $ADMIN_API_TOKEN"

# List by user
curl -s "http://localhost:3000/api/admin/memberships/list?user_id=<USER_UUID>" \
  -H "x-admin-token: $ADMIN_API_TOKEN"

# Ensure membership
curl -s -X POST "http://localhost:3000/api/admin/memberships/ensure" \
  -H "content-type: application/json" \
  -H "x-admin-token: $ADMIN_API_TOKEN" \
  -d '{"user_id":"<USER_UUID>","program_id":"<PROGRAM_UUID>"}'
```

### Where the code lives

- Admin client: `src/lib/supabaseAdmin.ts`
- Routes:
  - `src/app/api/admin/memberships/list/route.ts`
  - `src/app/api/admin/memberships/ensure/route.ts`

### Hardcoded dev keys to clean up (follow-up)

For local diagnostics there are hardcoded anon keys in:
- `src/config/supabase-config.js`
- `src/app/api/check-table/route.ts`

Consider moving these to env variables before production.
