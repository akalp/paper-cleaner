# Docker Specification

## Goal

paper-cleaner must run in production as a **single Docker container**.
The frontend is built during image creation and served by the backend at runtime.

## Deployment philosophy

This project is a personal local tool, not a distributed production service.
The Docker setup should be simple, readable, and easy to run on one machine.

## Required characteristics

- single runtime container
- multi-stage build allowed and preferred
- no separate frontend runtime container in production
- local writable directories for uploads/temp/rendered output
- easy `docker compose up` workflow

## Build model

Recommended multi-stage build:

### Stage 1: frontend build

- use Node image
- install frontend dependencies
- run Vite production build
- produce `dist/`

### Stage 2: backend runtime

- use slim Python image
- install Python dependencies
- copy backend app code
- copy frontend build artifacts into backend static directory
- create runtime data directories
- run FastAPI app via Uvicorn

## Runtime directories

The container should provide writable paths for:

- `/app/data/uploads`
- `/app/data/rendered`
- `/app/data/temp`
- `/app/data/metadata`

These may be backed by bind mounts or named volumes in compose.
The SQLite metadata database lives inside `/app/data/metadata`, so the same data mount preserves
session history and edit metadata across container restarts.

## Networking

Only one exposed application port is needed, for example:

- `8000`

The backend serves both API and frontend static assets.

## Development vs production

### Development

It is acceptable to run:

- Vite dev server separately
- FastAPI separately

with a proxy between them.

### Production / packaged local use

Only one container should be required.

## Suggested Dockerfile behavior

The Dockerfile should:

1. build frontend assets
2. install backend dependencies
3. copy built frontend into backend static path
4. expose app port
5. launch Uvicorn

## Suggested compose behavior

`docker-compose.yml` or `compose.yml` should:

- build from project root
- publish the app port
- mount or persist `data/` as needed
- keep configuration minimal

## Environment configuration

If environment variables are used, keep them minimal.
Examples:

- `HOST`
- `PORT`
- `DATA_DIR`
- `LOG_LEVEL`

Do not introduce configuration for systems that do not exist in scope.

## Security considerations

Because the app is intended for local/trusted environments:

- avoid unnecessary reverse-proxy complexity
- still validate uploaded file types and paths safely
- avoid shelling out to risky external commands for image handling when Python libraries suffice

## Operational expectations

The container should start cleanly with a single command and require minimal setup.
A user should be able to:

- clone repo
- run compose
- open the app in a browser

## Out-of-scope Docker additions

Do not add by default:

- Redis
- Postgres
- worker containers
- nginx sidecars
- object storage services
- monitoring stack

These would violate the project’s simplicity goals unless explicitly requested later.
