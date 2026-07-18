FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.js ./

ENV NODE_ENV=production \
    DATABASE_PATH=/data/portal.db \
    BSE_REQUEST_TIMEOUT_MS=25000 \
    BSE_MAX_RETRIES=5 \
    SYNC_INTERVAL_MS=60000 \
    INCENTIVE_RATE=0.10

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
