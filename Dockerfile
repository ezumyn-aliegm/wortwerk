FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.mjs ./
COPY server ./server
COPY scripts/install-wave-two.mjs ./scripts/
COPY scripts/update-wave-two-scope.mjs ./scripts/
COPY src/engine.js src/tutor.js src/data.js src/memory.js src/legacy-memory.js src/previous-content.js src/library.js src/activity.js src/game.js src/scoring.js src/wave-two.js ./src/
COPY src/wave-two-scope.js ./src/
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
