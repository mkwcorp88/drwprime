# DRW Prime Deployment

Production runs as the standalone Docker container `drwprime` on the VPS. It is
attached to the `coolify` network and publishes container port `3000` on host
loopback port `127.0.0.1:5054`. Host Nginx proxies `drwprime.com` to that port
using `/etc/nginx/sites-enabled/drwprime.com`; Coolify no longer owns this
application.

The same container serves treatment operations on `admin.drwprime.com`. Its
dedicated Nginx virtual host must preserve `Host: admin.drwprime.com` when
proxying to `127.0.0.1:5054`; Next.js middleware then rewrites requests to
`/treatment-ops`. TLS is managed as a separate Certbot certificate named
`admin.drwprime.com`.

## Deployment Paths

The automatic path is the VPS webhook dispatcher:

1. A push to `main` reaches the webhook receiver.
2. `/opt/git/deploy-dispatch.sh` updates `/opt/git/drwprime-work`.
3. `/opt/git/deploy-drwprime.sh` builds the immutable commit image. The Docker
   builder runs typecheck, lint, and tests before the image can be produced.
4. The server invokes `.github/scripts/deploy-standalone.sh` from that checkout.

`.github/workflows/deploy.yml` is a manual recovery path. It builds the same
commit in GitHub Actions, mirrors it to the VPS registry, and invokes the same
standalone deploy script. It intentionally has no `push` trigger so the webhook
and GitHub Actions cannot deploy the same commit concurrently.

Runtime configuration is stored only on the VPS in `/opt/git/drwprime.env`.
Never copy that file or its values into the repository or GitHub Actions logs.

## Safety Model

`npm run build` only builds the Next.js application. It never migrates or seeds
a database.

The standalone deploy script performs these steps under an exclusive lock:

1. Apply pending Prisma migrations once from the target image.
2. Start an isolated candidate container and check `/api/health`.
3. Confirm the candidate homepage renders, then stop and retain the current
   container as `drwprime-previous`.
4. Start the target image as `drwprime` with the declared network, port, logging,
   restart policy, and VPS environment file.
5. Verify the immutable image identity, Prisma and Payload database readiness,
   required runtime configuration, release SHA, public health endpoint, and
   public homepage.
6. Restore the previous container automatically when the swap or health checks
   fail.

The stopped previous container is retained until the next successful deployment.
Database migrations are not automatically reversible, so migrations must follow
the expand/contract pattern and remain compatible with the previous application
release during rollout. Migration execution is capped at five minutes by default;
override `DRWPRIME_MIGRATION_TIMEOUT` only for a reviewed long-running migration.

Seeding is always explicit:

```bash
npm run db:seed
```

Treatment Operations must not use the demo seed in production. Bootstrap the
first Super Admin once from the running release, then create all other staff in
the application:

```bash
OPS_ADMIN_EMAIL="admin@drwprime.com" \
OPS_ADMIN_PHONE="0812xxxxxxxx" \
OPS_ADMIN_PASSWORD="temporary-strong-password" \
npm run ops:bootstrap-admin
```

The bootstrap password remains a rollback credential. Password mode forces an
immediate password change; OTP mode ignores that gate. A controlled recovery
can set `OPS_ADMIN_FORCE_RESET=true`, which revokes every existing session for
that account.

Treatment Operations uses WhatsApp OTP when enabled, with credentials dedicated
to the DRW Prime WhatsApp property (never the shared POS/member account). Add
these values to `/opt/git/drwprime.env` before deploying the OTP release:

```bash
OPS_WHATSAPP_OTP_ENABLED=true
OPS_WHATSAPP_ACCESS_TOKEN="DRW-Prime-WABA-token"
OPS_WHATSAPP_PHONE_NUMBER_ID="1002114199662987"   # +62 811-3880-0039
OPS_WHATSAPP_TEMPLATE="drwprime_login_otp"
OPS_WHATSAPP_TEMPLATE_LANG="id"
OPS_OTP_SECRET="random-secret-minimum-32-characters"
```

The Meta template must be active and every active `OpsStaff` account that needs
access must have a unique normalized phone number. The deployment preflight
requires the dedicated `OPS_WHATSAPP_*` credentials whenever OTP mode is
enabled; it never falls back to the shared POS `WHATSAPP_*` values.

## VPS Bootstrap

The VPS build wrapper must pass the release SHA into Docker:

```bash
docker build \
  --build-arg "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}" \
  --build-arg "RELEASE_SHA=${TAG}" \
  ... \
  --tag "${IMAGE}:${TAG}" \
  .
```

After pushing the immutable image, it must delegate migration and container
replacement to the checked-in script:

```bash
bash "${SRC}/.github/scripts/deploy-standalone.sh" "${IMAGE}:${TAG}" "${TAG}"
```

The wrapper remains responsible only for fetching source, building, and pushing
the image. It must not remove or recreate the production container itself.

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

To validate an image through migration and isolated candidate readiness without
swapping production, set `DRWPRIME_PREFLIGHT_ONLY=true` when invoking the deploy
script.

## Manual Container Rollback

The deploy script performs this automatically on rollout failure. For a later
regression, restore the retained container on the VPS:

```bash
docker rm -f drwprime
docker rename drwprime-previous drwprime
docker start drwprime
curl --fail --silent --show-error http://127.0.0.1:5054/
```

This restores application code only. Review migration compatibility before any
manual rollback.
