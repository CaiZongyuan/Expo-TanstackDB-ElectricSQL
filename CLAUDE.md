# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Expo React Native app demonstrating **TanStack DB** with **ElectricSQL** for real-time data synchronization. Uses Python FastAPI backend as a proxy to ElectricSQL for server-side operations and shape streaming.

**Tech Stack:**
- **Frontend**: Expo React Native, TanStack DB, Drizzle ORM
- **Backend**: FastAPI (Python) + PostgreSQL
- **Sync**: ElectricSQL for real-time replication
- **UI**: HeroUI Native, Tailwind CSS v4, Tentap rich text editor

## Quick Commands

```bash
# Frontend
bun install              # Install dependencies
bunx expo start          # Start Expo dev server
bun run android          # Android emulator
bun run ios              # iOS simulator
bun run web              # Web browser

# Backend
cd backend && uv sync    # Install Python dependencies
uv run python -m app.main  # Start FastAPI (port 3001, hot reload)

# Migrations
uv run alembic revision --autogenerate -m "Description"
uv run alembic upgrade head

# Docker
docker compose up -d     # Start PostgreSQL + ElectricSQL
docker compose down      # Stop services
```

## Code Quality Requirements

**CRITICAL**: After completing any coding work, run these checks before delivering:

```bash
bunx tsc --noEmit        # Type checking (must pass)
bun run lint             # Linting (must pass)
```

If there are errors, fix them before delivery.

## Development Guidelines

### When Working with TanStack DB Collections
- Always check `src/app/(tabs)/todo.tsx` for reference
- Mutation handlers must call backend API via `src/utils/api-client.ts`
- Backend returns `{data, txid}` - txid is critical for ElectricSQL sync

### When Modifying Database Schema
1. Modify `backend/app/models.py` (SQLModel)
2. Generate migration: `uv run alembic revision --autogenerate -m "Description"`
3. Review the generated file in `backend/migrations/versions/`
4. Apply: `uv run alembic upgrade head`
5. Restart ElectricSQL: `docker compose restart electric`

**IMPORTANT**: Always review auto-generated migrations before applying.

### When Troubleshooting
For detailed troubleshooting guides, refer to:
- **README.md** - Architecture details, database issues, ElectricSQL integration problems
- **README-zh.md** - Chinese version of the troubleshooting guide

**Available Skills for specialized topics:**
- **`tanstack-db`** skill - TanStack DB + ElectricSQL comprehensive guidance:
  - Collections and live queries
  - Mutations and schema validation
  - ElectricSQL integration and shape streaming
  - Error handling and troubleshooting

- **`tentap-editor`** skill - Tentap rich text editor guidance:
  - Installation and basic setup
  - Advanced customization
  - API reference and examples

Common quick checks:
- Backend running? `curl http://localhost:3001/api/health`
- ElectricSQL running? `curl http://localhost:3000/api/health`
- Docker services? `docker compose ps`

### Windows-Specific Notes
- Alembic config: Use `alembic.ini` for database URL (Windows encoding limitation)
- Comment out `timezone = UTC` in both `alembic.ini` and `pyproject.toml`
- Migration files need `import sqlmodel` to avoid NameError

## Git Commit Guidelines

After completing meaningful work (feature, bug fix, refactor):

1. **Recommend commit** when work is complete
2. **Run pre-commit review**: Use `/pre-commit-review` skill to check staged changes
3. **Generate commit message**: Use conventional commit format (`feat:`, `fix:`, `refactor:`, etc.)
4. **Create commit** using standard git commands

**IMPORTANT**: Do NOT include Claude Code attribution or "Co-Authored-By" tags.

Example:
```
feat: Add component name and description

- Detail 1
- Detail 2

Additional context.
```

## Core Architecture Concepts

### TanStack DB + ElectricSQL Flow
1. Frontend mutations → TanStack DB collection
2. API client → FastAPI backend
3. Backend → PostgreSQL (returns txid)
4. ElectricSQL (WAL replication) → Shape stream
5. All connected clients receive updates

### Key Files
- `src/app/(tabs)/todo.tsx` - TanStack collection with shape sync
- `src/utils/api-client.ts` - Backend API client (fetch-based)
- `backend/app/main.py` - FastAPI routes + shape stream proxy
- `backend/app/models.py` - SQLModel schemas
- `src/db/schema.ts` - Drizzle ORM schema (frontend)

### Critical Implementation Details

**Backend Shape Stream Proxy** (`backend/app/main.py`):
- Must forward ALL ElectricSQL protocol params (`live`, `handle`, `cursor`, `log`, `columns`, etc.)
- Use `client.send(req, stream=True)` not `async with client.stream()`
- Keep stream open until client finishes reading
- Return all status codes (including 409 Conflict) - never throw HTTPException
- Generate txid INSIDE transaction: `pg_current_xact_id()::xid::text`

**Frontend Collection** (`src/app/(tabs)/todo.tsx`):
- Shape URL: `http://${hostname}:3001/api/todos`
- Custom parser for `timestamptz` columns
- Mutation handlers call backend API
- Uses `Constants.linkingUri` for device hostname detection

## Component Patterns

### Rich Text Editor (Tentap)
- Main editor: `src/components/tentap-editor.tsx`
- Toolbar: `src/components/glass-toolbar.tsx` (glassmorphic, keyboard-activated)
- Button definitions: `src/components/toolbar-buttons.ts`
- Each button: `id`, `label`, `icon`, `action()`, `getActive()`, `getDisabled()`

### Styling
- **Tailwind CSS v4** via Uniwind (React Native runtime)
- **HeroUI Native** for UI components
- **Glassmorphism** with `expo-glass-effect`
- Class names work via Uniwind runtime (see `.vscode/settings.json`)

**Uniwind FlatList Gotcha**: When using FlatList with Uniwind, ensure proper layout structure:
- Separate fixed-height elements (headers, inputs) into a container WITHOUT `flex: 1`
- Place FlatList in a separate container WITH `flex: 1` to occupy remaining space
- Use native `style` prop for FlatList's `flex` and `contentContainerStyle` (not `className`)
- Example:
  ```tsx
  <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
    {/* Fixed height elements - no flex */}
  </View>
  <View style={{ flex: 1, paddingHorizontal: 20 }}>
    <FlatList style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} />
  </View>
  ```

### Provider Stack
Root layout (`src/app/_layout.tsx`):
1. `GestureHandlerRootView` - react-native-gesture-handler
2. `HeroUINativeProvider` - HeroUI context

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app & routes
│   │   ├── models.py          # SQLModel schemas
│   │   ├── db.py              # Database connection
│   │   └── alembic_runner.py  # Auto-migration on startup
│   ├── migrations/            # Alembic migrations
│   ├── alembic.ini            # Database URL config
│   └── pyproject.toml         # Python dependencies
├── src/
│   ├── app/(tabs)/
│   │   └── todo.tsx         # Todo screen with TanStack collection
│   ├── components/          # React Native components
│   ├── db/
│   │   └── schema.ts        # Drizzle ORM schema
│   └── utils/
│       └── api-client.ts    # API client for backend
├── docker-compose.yml       # PostgreSQL + ElectricSQL
└── package.json
```

## For Detailed Information

Refer to the README files for:
- Complete architecture documentation
- Database migration workflows
- Troubleshooting guides (Windows issues, ElectricSQL problems, txid debugging)
- Alembic setup and configuration
- Environment setup instructions
