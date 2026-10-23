FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Cai dat dependencies che do production va don dep cache de giam dung luong image
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Sao chep ma nguon va gan quyen so huu cho user node
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

# Hardening: Chay container bang user khong co dac quyen (non-root)
USER node

EXPOSE 3000

# Healthcheck dinh ky kiem tra route /health
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
