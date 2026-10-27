# DRW Prime Deployment

Production is a Coolify-managed Docker-image application on the VPS (app UUID
`nnmld8bulwmuf4bit1cdxbta`). The current container publishes port `3000` on
host loopback port `127.0.0.1:5054`. Host Nginx proxies `drwprime.com` to that
port using `/etc/nginx/sites-enabled/drwprime.com`. Coolify owns the container;
do not run the legacy standalone deployment script against production.

The same container serves treatment operations on `admin.drwprime.com`. Its
dedicated Nginx virtual host must preserve `Host: admin.drwprime.com` when
proxying to `127.0.0.1:5054`; Next.js middleware then rewrites requests to
`/treatment-ops`. TLS is managed as a separate Certbot certificate named
`admin.drwprime.com`.

## Deployment Paths

The automatic path is the VPS webhook dispatcher:

1. A push to `main` reaches the webhook receiver.
2. `/opt/git/deploy-dispatch.sh` updates `/opt/git/drwprime-work`.
3. `/opt/git/deploy-drwprime.sh` builds and pushes the immutable commit image to
   the VPS registry. The Docker builder runs typecheck, lint, and tests before
   the image can be produced.
4. The VPS script runs `prisma migrate deploy` from that image, updates its tag
   in Coolify, triggers the Coolify rollout, and checks the release SHA in
   `/api/health` on `127.0.0.1:5054`.

`.github/workflows/deploy.yml` still invokes the obsolete standalone script.
Do not run that workflow for production until it is updated for Coolify.

The VPS build and migration wrapper reads `/opt/git/drwprime.env`; the running
application receives its runtime environment from Coolify. Keep these aligned
without copying secret values into the repository or build logs.

## Safety Model

`npm run build` only builds the Next.js application. It never migrates or seeds
a database.

The active VPS wrapper takes an exclusive lock, builds and pushes the target
image, applies pending Prisma migrations, asks Coolify to roll it out, and
checks the live release SHA. It does not stage a separate candidate container
or automatically roll back a failed Coolify deployment. Database migrations
must therefore remain compatible with the previous release. Migration
execution is capped at five minutes by default; override
`DRWPRIME_MIGRATION_TIMEOUT` only for a reviewed long-running migration.

The staff login cutover requires an additive migration **and a one-time import**
of verified legacy staff identities before the new login replaces Clerk. Do not
push the cutover through the automatic webhook until `staff_accounts` is populated
and an imported staff member has a working Google account. See
[`STAFF_AUTH.md`](STAFF_AUTH.md) for the import and verification sequence.

Seeding is always explicit:

```bash
npm run db:seed
```

Treatment Operations must not use the demo seed in production. Bootstrap the
first Super Admin once from the running release, then create all other staff in
the application:

```bash
OPS_ADMIN_PHONE="0812xxxxxxxx" \
OPS_ADMIN_PASSWORD="temporary-strong-password" \
npm run ops:bootstrap-admin
```

New accounts use the normalized WhatsApp number as their login identifier and
do not require an email address. To locate and migrate a legacy Super Admin
that only has an email, add `OPS_ADMIN_EMAIL` and
`OPS_ADMIN_FORCE_RESET=true`; the email is kept as record data but stops being
a valid login after the phone number is saved. The bootstrap password remains a
rollback credential. Password mode forces an immediate password change; OTP
mode ignores that gate. A controlled recovery can set
`OPS_ADMIN_FORCE_RESET=true`, which revokes every existing session for that
account.

Treatment Operations uses WhatsApp OTP when enabled. The intended configuration
uses a dedicated DRW Prime WhatsApp sender. Configure its runtime values in
Coolify (and any build or migration values needed by the VPS wrapper):

```bash
OPS_WHATSAPP_OTP_ENABLED=true
OPS_WHATSAPP_ACCESS_TOKEN="DRW-Prime-WABA-token"
OPS_WHATSAPP_PHONE_NUMBER_ID="1002114199662987"   # +62 811-3880-0039
OPS_WHATSAPP_TEMPLATE="drwprime_login_otp"
OPS_WHATSAPP_TEMPLATE_LANG="id"
OPS_OTP_SECRET="random-secret-minimum-32-characters"
```

The Meta template must be active and every active `OpsStaff` account that needs
access must have a unique normalized phone number. The active VPS wrapper does
not run the legacy standalone preflight. Check these values in Coolify before
rollout.

OTP delivery tracking uses the optional `MEMBER_WHATSAPP_APP_SECRET` and
`MEMBER_WHATSAPP_WEBHOOK_VERIFY_TOKEN` pair. Configure both before registering
`https://drwprime.com/api/webhooks/whatsapp-otp` as the Meta callback and
subscribing the app to WABA `messages` events. Set both secrets in Coolify; a
partial pair leaves one webhook method unusable. The migration adds only a
separate tracking table, so the previous app remains compatible during rollout.
See `docs/MEMBER_WHATSAPP_LOGIN.md`.

## VPS Bootstrap

The active VPS build wrapper passes the release SHA into Docker and calls Prisma
migration before handing rollout to Coolify:

```bash
docker build \
  --build-arg "NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}" \
  --build-arg "NEXT_PUBLIC_GOOGLE_LOGIN_PUBLIC=${NEXT_PUBLIC_GOOGLE_LOGIN_PUBLIC:-true}" \
  --build-arg "RELEASE_SHA=${TAG}" \
  ... \
  --tag "${IMAGE}:${TAG}" \
  .
```

The production wrapper is `/opt/git/deploy-drwprime.sh` on the VPS. Review the
server copy before changing deployment behavior; the checked-in standalone
script does not describe the current deployment.

## Verification

Run the local quality gate before deployment:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Production readiness:

```bash
curl --fail --silent --show-error https://drwprime.com/api/health
curl --fail --silent --show-error https://admin.drwprime.com/api/health
curl --fail --silent --show-error https://admin.drwprime.com/treatment-ops/login
```

The response must contain `"ok":true` and the expected `release` commit SHA.

For a regression, select a known-good image tag in Coolify and deploy it through
Coolify. Confirm that the database migration remains compatible with the older
application release before rolling back code.
