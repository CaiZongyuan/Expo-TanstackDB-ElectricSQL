# Expo + TanStack DB + ElectricSQL Todo App

**English | [中文](README-zh.md)**

A real-time todo application built with Expo React Native, demonstrating [TanStack DB](https://tanstack.com/db/latest) with [ElectricSQL](https://electric-sql.com/) for seamless data synchronization across devices.

## Features

- **Real-time Sync**: Automatic data synchronization using ElectricSQL's shape-based replication
- **Offline-first**: Local database with automatic sync when connection is restored
- **TanStack DB Collections**: Type-safe data management with live queries
- **Rich Text Editor**: Built with `@10play/tentap-editor` for diary/journal entries
- **Cross-platform**: Works on iOS, Android, and Web

## Tech Stack

### Frontend
- **Expo SDK 54** - React Native development framework
- **TanStack DB** - Local-first database with collections
- **ElectricSQL** - Postgres-to-app data sync
- **Drizzle ORM** - TypeScript ORM for schema definition
- **React Navigation** - Tab navigation

### Backend
- **FastAPI** - Python async web framework
- **SQLModel** - Pydantic + SQLAlchemy for database models
- **PostgreSQL** - Primary database

### Infrastructure
- **Docker Compose** - PostgreSQL and ElectricSQL services
- **ElectricSQL** - Real-time data replication service

## Prerequisites

- **Node.js** 18+ and [Bun](https://bun.sh)
- **Python** 3.12+ and [uv](https://github.com/astral-sh/uv)
- **Docker** and Docker Compose
- **Expo CLI** (`bunx expo install`)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Expo-TanstackDB-ElectricSQL
```

### 2. Environment Setup

Copy the environment template and configure:

```bash
cp .env.example .env
```

Edit `.env` with your database configuration:

```env
DB_HOST=localhost
DB_PORT=54321
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=electric
```

### 3. Start Infrastructure Services

Start PostgreSQL and ElectricSQL:

```bash
docker compose up -d
```

Verify services are running:

```bash
docker compose ps
```

### 4. Database Migration (First Time Only)

If this is your first time setting up the project, you need to initialize and run database migrations:

```bash
cd backend

# Install dependencies
uv sync

# Generate initial migration (creates todos table)
uv run alembic revision --autogenerate -m "Initial migration"

# Apply migration to database
uv run alembic upgrade head
```

**Note**: The backend automatically runs pending migrations on startup, so you only need to manually run migrations during development.

### 5. Start Backend API

```bash
cd backend
uv sync
uv run python -m app.main
```

The backend will run on `http://localhost:3001`

### 6. Install Frontend Dependencies

```bash
bun install
```

### 7. Start Expo Development Server

```bash
bunx expo start
```

Press one of the following keys to run on your desired platform:
- `a` - Android emulator
- `i` - iOS simulator
- `w` - Web browser

## Project Structure

```
├── backend/                  # Python FastAPI backend
│   ├── app/
│   │   ├── alembic_runner.py  # Auto-migration on startup
│   │   ├── main.py            # FastAPI app & routes
│   │   ├── models.py          # SQLModel schemas
│   │   └── db.py              # Database connection
│   ├── migrations/            # Alembic database migrations
│   │   ├── versions/          # Migration files (auto-generated)
│   │   ├── env.py             # Migration environment (async support)
│   │   └── script.py.mako     # Migration template
│   ├── alembic.ini            # Alembic config (database URL)
│   └── pyproject.toml         # Python dependencies & Alembic config
├── src/
│   ├── app/(tabs)/
│   │   ├── _layout.tsx      # Tab navigation layout
│   │   └── todo.tsx         # Todo screen with TanStack collection
│   ├── components/          # React Native components
│   │   ├── tentap-editor.tsx
│   │   └── glass-toolbar.tsx
│   ├── db/
│   │   └── schema.ts        # Drizzle ORM schema
│   └── utils/
│       └── api-client.ts    # API client for backend
├── docker-compose.yml       # PostgreSQL + ElectricSQL
├── .env.example             # Environment variables template
└── package.json
```

## How It Works

### Data Flow

1. **Frontend** creates/updates/deletes todos via TanStack DB collection
2. **API Client** sends mutations to FastAPI backend
3. **Backend** writes to PostgreSQL and returns transaction ID
4. **ElectricSQL** captures changes via WAL replication
5. **Shape Stream** pushes updates to all connected clients

### TanStack Collection

The `todoCollection` in `src/app/(tabs)/todo.tsx` uses:
- **Shape URL**: `http://${hostname}:3001/api/todos` for live updates
- **Mutation Handlers**: Backend API calls for insert/update/delete
- **Timestamp Parser**: Converts ISO strings to Date objects

## Database Connection

### DataGrip / pgAdmin

```
Host: localhost
Port: 54321
Database: electric
User: postgres
Password: password
```

### Direct Connection

```bash
psql -h localhost -p 54321 -U postgres -d electric
```

## Database Migrations

This project uses **Alembic** for database schema management.

### Daily Workflow

After modifying models in `backend/app/models.py`:

```bash
cd backend

# Generate migration based on model changes
uv run alembic revision --autogenerate -m "Description of changes"

# Review the generated migration file in backend/migrations/versions/

# Apply the migration
uv run alembic upgrade head
```

### Common Commands

```bash
# Check current migration version
uv run alembic current

# View migration history
uv run alembic history

# Rollback one migration
uv run alembic downgrade -1

# Rollback all migrations
uv run alembic downgrade base

# Check for pending migrations (without applying)
uv run alembic check
```

### Automatic Migration on Startup

The backend automatically runs pending migrations when it starts up. This can be disabled by setting the environment variable:

```bash
export RUN_MIGRATIONS_ON_STARTUP=false
```

### Important Notes

- **Always review** auto-generated migrations before applying
- **Use descriptive** migration messages (e.g., "Add priority field to todos")
- **Test both upgrade and downgrade** to ensure rollbacks work
- **Commit migration files** to version control

For detailed documentation, see [backend/docs/alembic-pyproject-setup.md](backend/docs/alembic-pyproject-setup.md)

## Development

### Type Checking

```bash
bunx tsc --noEmit
```

### Linting

```bash
bun run lint
```

### Backend Development

```bash
cd backend
uv run python -m app.main   # Start with hot reload
```

## Troubleshooting

### Docker services won't start

```bash
docker compose down -v  # Remove volumes
docker compose up -d    # Start fresh
```

### ElectricSQL connection issues

**409 Conflict on app startup**

You may see logs like this when the app starts:
```
INFO: 192.168.2.188 - "GET /api/todos?...&handle=XXX HTTP/1.1" 409 Conflict
INFO: 192.168.2.188 - "GET /api/todos?...&handle=YYY HTTP/1.1" 200 OK
```

**This is normal behavior!** The 409 Conflict is part of ElectricSQL's session recovery mechanism:
1. Client attempts to reconnect using a cached handle from the previous session
2. ElectricSQL detects the handle is expired and returns 409
3. Client automatically creates a new connection with a fresh handle
4. All subsequent syncs work normally

**No action needed** - TanStack DB Electric Collection handles this automatically.

Check Electric is running:
```bash
curl http://localhost:3000/api/health
```

### Backend API not responding

Verify backend is running on port 3001:
```bash
curl http://localhost:3001/api/health
```

### Mobile app can't connect to backend

- Ensure your device/emulator and backend are on the same network
- Update `API_BASE_URL` in `src/utils/api-client.ts` with your machine's IP

### Frontend errors with ElectricSQL

**Error: "Cannot read property 'event' of undefined"**

This indicates an issue with the shape stream from the backend. Check:
1. Backend is running and not throwing errors
2. ElectricSQL service is accessible
3. All ElectricSQL protocol parameters are forwarded (see `backend/app/main.py`)

**Error: "Stream has been closed"**

The streaming response was closed prematurely. This happens when:
- The backend's proxy function closes the stream before sending the response
- Connection timeout is too short

**Solution**: Ensure the backend uses `client.send(req, stream=True)` and keeps the stream open until the client finishes reading (see `backend/app/main.py:200-234`).

### Migration Issues

**Autogenerate creates empty migration**
- Ensure `migrations/env.py` imports all models from `app.models`
- Check that `target_metadata = SQLModel.metadata` (not `None`)
- Verify database connection is correct

**Migration apply fails with encoding error (Windows)**
- This is expected - see [backend/docs/alembic-pyproject-setup.md](backend/docs/alembic-pyproject-setup.md) for Windows-specific setup

**ElectricSQL reports table dropped/renamed after migration**
```bash
docker compose restart electric
```

**Want to disable auto-migration on startup**
```bash
export RUN_MIGRATIONS_ON_STARTUP=false
```

### Optimistic Updates Not Syncing

If mutations appear to work but data doesn't sync from the backend:

**Problem: txid mismatch**
- The backend returns a txid that doesn't match the actual transaction in Postgres
- This happens when `pg_current_xact_id()` is called outside the mutation transaction

**Solution**: Ensure `get_current_txid()` is called inside the same transaction as the mutation (see `backend/app/main.py:72-79`).

**Enable debug logging** to diagnose txid issues:
```javascript
// In browser console
localStorage.debug = 'ts/db:electric'
```

This will show you when txids are requested and when they arrive from the stream.

## License

MIT

## Resources

- [TanStack DB Documentation](https://tanstack.com/db/latest)
- [ElectricSQL Documentation](https://electric-sql.com/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Alembic Tutorial](backend/docs/complete-migration-guide.md) - Complete migration guide
- [Alembic Setup Plan](backend/docs/alembic-pyproject-setup.md) - Project-specific setup guide
