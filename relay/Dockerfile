# Node 26 — текущая линейка релизов. Если понадобится более
# консервативный вариант, LTS сейчас 24 (Krypton): меняется только тег.
FROM node:26-alpine

ENV NODE_ENV=production
WORKDIR /app

# Зависимости отдельным слоем: правки index.mjs не пересобирают npm ci.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.mjs ./

USER node
EXPOSE 8080

# Вебсокет-сервер не отвечает на обычный GET осмысленным кодом,
# поэтому проверяем самое надёжное — принимает ли он TCP-соединение.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["node", "-e", "import('node:net').then(({default:net})=>{const s=net.connect(8080,'127.0.0.1');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))})"]

CMD ["node", "index.mjs"]
