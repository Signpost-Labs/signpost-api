# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Accept the Git commit SHA at build time (defaults to "unknown")
ARG GIT_COMMIT=unknown

WORKDIR /app

# Install dependencies first (better layer caching).
# --ignore-scripts: the `prepare` script installs git hooks via husky, which
# is meaningless (and, once dev deps are pruned below, unavailable) inside a
# container that never has a .git directory.
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies so only production deps are copied to runtime stage
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Build arguments for OCI annotations and runtime environment
ARG GIT_COMMIT=unknown
ARG VERSION=1.0.0
ARG BUILD_DATE=""
ARG SOURCE=https://github.com/scout-off/scout-off-backend
ARG TITLE="scout-off-backend"
ARG DESCRIPTION="Backend API for ScoutOff — decentralized football scouting platform on Stellar"
ARG LICENSES="Apache-2.0"

# OCI Image Spec annotations (https://github.com/opencontainers/image-spec/blob/main/annotations.md)
LABEL org.opencontainers.image.title="${TITLE}" \
      org.opencontainers.image.description="${DESCRIPTION}" \
      org.opencontainers.image.source="${SOURCE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="${LICENSES}"

# Non-root user for least-privilege runtime
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy compiled output and production node_modules from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package.json ./

# Copy database migration files — migrate.ts resolves migrations relative to
# /app/db at runtime, so they must be present in the image
COPY --chown=appuser:appgroup db ./db

# Create a directory for the SQLite database file and give the app user ownership
RUN mkdir -p /data && chown appuser:appgroup /data

USER appuser

# Expose the default API port
EXPOSE 4000

# Set default DB path to the /data volume mount
ENV DB_PATH=/data/scout-off.db \
    NODE_ENV=production \
    PORT=4000 \
    GIT_COMMIT=$GIT_COMMIT

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health/liveness || exit 1

CMD ["node", "dist/index.js"]
