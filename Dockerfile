# Stage 1: Dependencies
FROM node:24-alpine AS dependencies

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV CI=true

RUN pnpm install --frozen-lockfile


# Stage 2: Build
FROM dependencies AS build

COPY . .

RUN pnpm build


# Stage 3: Development
FROM dependencies AS development

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev"]


# Stage 4: Staging
FROM node:24-alpine AS staging

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/server.js"]