FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY engine.mjs job.mjs server.mjs models.mjs ./
RUN node models.mjs && chown -R node:node /app
USER node
ENV NODE_ENV=production RECEIPT_MODEL_PATH=/app/models
EXPOSE 8891
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8891/health').then(r=>r.json()).then(v=>process.exit(v.ok&&v.modelsReady?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
