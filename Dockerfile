FROM node:24-alpine AS base

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

FROM node:24-alpine AS build

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]

