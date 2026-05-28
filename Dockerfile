# ===== FRONTEND BUILD =====
FROM node:24-slim AS frontend-builder

WORKDIR /frontend

RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ===== BACKEND BUILD =====
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS backend-builder

WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/ ./

# ===== FINAL IMAGE =====
FROM python:3.13-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=backend-builder /app/.venv /app/.venv
COPY --from=backend-builder /app/src /app/src
COPY --from=frontend-builder /frontend/build/client ./static

ENV IS_PROD="yes"
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 6000
CMD ["python", "src/app.py"]
