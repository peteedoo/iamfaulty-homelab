FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install --workspace=server --workspace=client
COPY . .
RUN npm run build -w client && npm run build -w server

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/
RUN npm install --workspace=server --omit=dev
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
ENV PORT=3100
EXPOSE 3100
CMD ["node", "server/dist/index.js"]
