FROM node:24-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

FROM python:3.14-slim AS backend-wheels

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_PREFER_BINARY=1

WORKDIR /wheels

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r /tmp/requirements.txt

FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app/backend

COPY backend/requirements.txt ./requirements.txt
COPY --from=backend-wheels /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./app/static

RUN mkdir -p /app/data/uploads \
    /app/data/rendered/sources \
    /app/data/rendered/previews \
    /app/data/rendered/exports \
    /app/data/temp \
    /app/data/metadata/sessions \
    /app/data/metadata/documents

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host ${HOST} --port ${PORT}"]
