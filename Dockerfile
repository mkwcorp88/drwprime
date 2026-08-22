# syntax=docker/dockerfile:1.4

FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run typecheck && npm run lint && npm run test

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG RELEASE_SHA=unknown
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV RELEASE_SHA=${RELEASE_SHA}
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/admin"
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/admin"
ENV NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/admin"
ENV NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/admin"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN --mount=type=secret,id=database_url \
    --mount=type=secret,id=database_uri \
    --mount=type=secret,id=payload_secret \
    --mount=type=secret,id=clerk_secret_key \
    --mount=type=cache,target=/app/.next/cache \
    DATABASE_URL="$(cat /run/secrets/database_url)" \
    DATABASE_URI="$(cat /run/secrets/database_uri)" \
    PAYLOAD_SECRET="$(cat /run/secrets/payload_secret)" \
    CLERK_SECRET_KEY="$(cat /run/secrets/clerk_secret_key)" \
    npm run build

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates fontconfig fonts-dejavu-core \
    && fc-cache -f \
    && fc-match "DejaVu Sans" | grep -q "DejaVuSans" \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG RELEASE_SHA=unknown
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV RELEASE_SHA=${RELEASE_SHA}
LABEL org.opencontainers.image.revision=${RELEASE_SHA}
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/admin"
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/admin"
ENV NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/admin"
ENV NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/admin"

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(4000) }).then(async response => { const body = await response.json(); process.exit(response.ok && body.ok === true ? 0 : 1); }).catch(() => process.exit(1))"
CMD ["npm", "run", "start"]
