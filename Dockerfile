# syntax=docker/dockerfile:1

FROM node:26-alpine AS build
WORKDIR /app

# Install scripts are skipped: the only one that matters is `nuxt prepare`,
# which `nuxt build` runs anyway once the sources are copied in.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM node:26-alpine
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# The Nitro output is self-contained, so the runtime image needs no node_modules.
COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
