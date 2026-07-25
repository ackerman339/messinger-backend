# Stage 1: Base — pnpm
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

# Stage 2: Development
FROM base AS development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "dev"]
