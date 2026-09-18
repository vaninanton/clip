# Один образ отдаёт и страницу, и сигнальный релей. Это сделано ради
# корпоративной сети: из RDP-сессии достаточно разрешить один домен,
# а не два, и не нужен доступ к github.io.

# ── сборка фронтенда ──────────────────────────────────────────────────
FROM node:26-alpine AS build

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# Скрипт build перед сборкой прогоняет tsc --noEmit,
# так что образ не соберётся на сломанных типах.
RUN npm run build

# ── рантайм ───────────────────────────────────────────────────────────
FROM node:26-alpine

ENV NODE_ENV=production
WORKDIR /app

# Зависимости отдельным слоем: правки сервера не пересобирают npm ci.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/index.mjs ./
COPY --from=build /src/public ./public

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["node", "index.mjs"]
