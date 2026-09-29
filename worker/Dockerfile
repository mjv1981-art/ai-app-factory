# Optional managed-job controller image. Target code NEVER runs in this container.
# A managed executor integration must provide a separately isolated Docker service.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends docker.io && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY factory ./factory
COPY server ./server
COPY worker ./worker
COPY agents ./agents
CMD ["node", "worker/start.mjs"]
