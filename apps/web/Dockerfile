# BeautyOS web imajı (Next.js standalone). Derleme bağlamı depo kökü olmalı:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.beautyossapp.com -t beautyos-web:<surum> .
# NEXT_PUBLIC_* değerleri derleme anında JS paketine gömülür; gizli değer DEĞİLDİR.

FROM node:22.23.4-bookworm-slim AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=apps/web
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_BOT_FEATURES_ENABLED=false
# Acik yuzeyler, virgulle ayrik (site,auth,panel,book,admin). Bos = yeni arayuz kapali.
ARG NEXT_PUBLIC_UI_V2=
# Tasarim sistemi vitrini (/v2/tasarim-sistemi): yalniz staging imajinda "1". Canli imaja derle.sh bu bayragi HIC GECIRMEZ.
ARG NEXT_PUBLIC_UI_V2_SHOWCASE=
# Derleme belleği (MB): sunucuda canlı yığınla birlikte derlendiğinden sınırlı tutulur (derle.sh 1536 verir).
ARG NODE_HEAP_MB=2048
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_BOT_FEATURES_ENABLED=$NEXT_PUBLIC_BOT_FEATURES_ENABLED \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=$NODE_HEAP_MB
# Kodda yedek (Railway) adresi var; yanlışlıkla ona düşülmesin diye adres zorunlu.
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL build arg zorunlu" && exit 1)
RUN npm run build --workspace=apps/web

FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=UTC \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
