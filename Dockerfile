FROM node:25-alpine AS base

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

FROM node:25-alpine AS build

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:25-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
# Railway injects PORT at runtime; default for local Docker
ENV PORT=8080

COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Railway typically uses 8080; must match service Settings → Networking → Target Port
EXPOSE 8080

CMD ["node", "dist/server.js"]

