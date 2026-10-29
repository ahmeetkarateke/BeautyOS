# BeautyOS API imajı. Derleme bağlamı depo kökü olmalı:
#   docker build -f apps/api/Dockerfile -t beautyos-api:<surum> .
# Taban imaj sabit etiketlidir; güvenlik yamaları için düzenli olarak yükseltilir.

FROM node:22.23.4-bookworm-slim AS base
# Prisma motoru openssl 3 ister; slim imajda yoktur.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Derleme aşaması: tüm bağımlılıklar + tsc
FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=apps/api
COPY packages/shared packages/shared
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/prisma apps/api/prisma
COPY apps/api/src apps/api/src
RUN npm run build --workspace=apps/api

# Üretim bağımlılıkları (dev bağımlılığı yok) + Prisma istemcisi.
# Çalışma imajıyla aynı tabandan türediği için native motor hedefi tutar.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=apps/api --omit=dev
COPY apps/api/prisma apps/api/prisma
WORKDIR /app/apps/api
RUN node_modules/.bin/prisma generate

# Çalışma aşaması
FROM base AS runtime
# HOME=/tmp: salt okunur kök dosya sisteminde Prisma/npm önbellek yazabilsin.
ENV NODE_ENV=production \
    TZ=UTC \
    HOME=/tmp \
    PORT=3001
WORKDIR /app/apps/api
COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./node_modules
# Calisma zamaninda @beautyos/shared, node_modules icindeki sembolik baglanti uzerinden bu klasore cozulur.
COPY --from=build --chown=node:node /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist /app/packages/shared/dist
COPY --chown=node:node apps/api/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --chown=node:node apps/api/prisma ./prisma
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/index.js"]
