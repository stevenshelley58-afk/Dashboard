FROM node:20

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build packages
RUN pnpm --filter @dashboard/config build
RUN pnpm --filter @dashboard/worker build

# Start worker
WORKDIR /app/apps/worker
CMD ["pnpm", "start"]

