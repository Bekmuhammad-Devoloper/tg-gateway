FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
RUN apk add --no-cache tzdata && mkdir /data && chown node:node /data
WORKDIR /app
ENV NODE_ENV=production \
    TZ=Asia/Tashkent \
    PORT=8080 \
    DATABASE_PATH=/data/gateway.db
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "dist/server/index.js"]
