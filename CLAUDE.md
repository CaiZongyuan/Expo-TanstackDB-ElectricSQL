# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Expo React Native todo application demonstrating **TanStack DB** with **ElectricSQL** for real-time data synchronization. The app uses a Python FastAPI backend as a proxy to ElectricSQL for server-side operations and shape streaming.

**Architecture Stack:**
- **Frontend**: Expo React Native with TanStack DB collections
- **Backend**: FastAPI (Python) + PostgreSQL
- **Sync**: ElectricSQL for real-time data replication
- **ORM**: Drizzle ORM (frontend schema), SQLModel (backend models)

## Commands

### Frontend Development
```bash
bun install          # Install dependencies
bunx expo start      # Start Expo dev server
bun run android      # Start with Android emulator
bun run ios          # Start with iOS simulator
bun run web          # Start web version
```

### Backend Development
```bash
cd backend
uv sync              # Install Python dependencies
uv run python -m app.main   # Start FastAPI server (port 3001, hot reload enabled)
```

### Database Migrations
```bash
cd backend

# Generate migration based on model changes
uv run alembic revision --autogenerate -m "Description"

# Apply migrations
uv run alembic upgrade head

# Check current version
uv run alembic current

# View history
uv run alembic history

# Rollback
uv run alembic downgrade -1
```

### Docker Services (PostgreSQL + ElectricSQL)
```bash
docker compose up -d    # Start PostgreSQL and ElectricSQL
docker compose down     # Stop services
```

### Environment Setup
1. Copy `.env.example` to `.env` and configure database connection
2. Start Docker services for PostgreSQL and ElectricSQL
3. Start the FastAPI backend (port 3001)
4. Start the Expo frontend

## Architecture

### TanStack DB + ElectricSQL Integration
The app uses TanStack DB with ElectricSQL for real-time data synchronization:

**Frontend Schema (`src/db/schema.ts`):**
- Drizzle ORM defines the `todos` table schema
- Zod validation schemas: `selectTodoSchema`, `insertTodoSchema`, `updateTodoSchema`

**TanStack Collection (`src/app/(tabs)/todo.tsx`):**
- `todoCollection` created with `electricCollectionOptions`
- Shape sync URL: `http://${hostname}:3001/api/todos`
- Custom parser for timestamp columns (`timestamptz`)
- Mutation handlers: `onInsert`, `onUpdate`, `onDelete` that call the backend API

**API Client (`src/utils/api-client.ts`):**
- Standalone fetch-based client for backend communication
- Methods: `createTodo`, `updateTodo`, `deleteTodo`
- Uses `Constants.linkingUri` for device hostname detection
- Returns todo data along with transaction ID (txid)

### Backend (FastAPI)
Python backend serving as API proxy and ElectricSQL shape streamer:

**Structure (`backend/app/`):**
- `main.py` - FastAPI app with CORS, routes for CRUD and shape proxy, auto-migration on startup
- `models.py` - SQLModel definitions (`Todo`, `TodoCreate`, `TodoUpdate`)
- `db.py` - Async PostgreSQL connection using asyncpg driver
- `alembic_runner.py` - Automatic migration runner for startup

**API Endpoints:**
- `POST /api/todos` - Create todo, returns `{todo, txid}`
- `PUT /api/todos/{id}` - Update todo, returns `{todo, txid}`
- `DELETE /api/todos/{id}` - Delete todo, returns `{success, txid}`
- `GET /api/todos` - Proxies ElectricSQL shape stream with live updates

**Shape Stream Proxy Implementation:**
The backend proxy (`GET /api/todos`) is critical for ElectricSQL integration:

**Protocol Parameters** (must all be forwarded to ElectricSQL):
- `live`, `live-sse` - Enable live updates
- `handle`, `expired-handle` - Stream position markers
- `offset` - Stream offset
- `cursor` - Transaction cursor
- `log`, `log-mode` - Logging mode
- `where`, `limit`, `order-by` - Query filters
- `columns` - Column selection

**Key Implementation Details:**
1. **Stream Management** (main.py:200-234):
   - Use `client.send(req, stream=True)` instead of `async with` context manager
   - Keep stream open until client finishes reading
   - Clean up resources in `stream_generator`'s `finally` block
   - Set timeout to 300 seconds for long-lived connections

2. **Passthrough All Status Codes**:
   - Return all status codes (including 409 Conflict) to client
   - Never throw HTTPException for non-200 responses
   - TanStack DB Electric Collection needs 409 to handle expired handles

3. **Transaction ID Generation** (main.py:72-79):
   - Use `pg_current_xact_id()::xid::text` NOT `txid_current()`
   - Call inside the same transaction as the mutation
   - Strip epoch with `::xid::text` to match Electric's stream

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `ELECTRIC_URL` - ElectricSQL instance (default: `http://localhost:3000`)
- `RUN_MIGRATIONS_ON_STARTUP` - Enable/disable auto-migration (default: `true`)

### Database Migrations (Alembic)
The backend uses Alembic for database schema management with auto-migration on startup:

**Configuration:**
- Uses hybrid config: `alembic.ini` for database URL + `pyproject.toml` for other settings
- `backend/migrations/env.py` - Async migration support with SQLModel metadata
- `backend/migrations/script.py.mako` - Migration template with `sqlmodel` import
- Auto-formats generated migrations with Black

**Migration Workflow:**
1. Modify `backend/app/models.py` (SQLModel schemas)
2. Run `uv run alembic revision --autogenerate -m "Description"`
3. Review generated file in `backend/migrations/versions/`
4. Run `uv run alembic upgrade head` to apply
5. Backend auto-runs migrations on startup (can be disabled with env var)

**Important Notes:**
- Always review auto-generated migrations before applying
- Autogenerate detects: table/col add/drop, nullable changes, indexes, foreign keys
- Autogenerate CANNOT detect: table/col renames (shows as drop+add), anonymous constraints
- Use descriptive migration messages
- Test both upgrade and downgrade

**Windows Compatibility:**
- Must use `alembic.ini` for database URL (Windows encoding issue with pyproject.toml)
- Comment out `timezone = UTC` in both `alembic.ini` and `pyproject.toml`
- Migration template includes `import sqlmodel` to avoid `NameError`

### Infrastructure (Docker)
`docker-compose.yml` defines:
- **PostgreSQL 16**: Port 54321, WAL level logical for replication
- **ElectricSQL**: Port 3000, connects to PostgreSQL, insecure mode for dev

### Rich Text Editor (Tentap)
The core feature is a rich text editor built with `@10play/tentap-editor`:

**Components:**
- `src/components/tentap-editor.tsx` - Main editor wrapper using `useEditorBridge`
- `src/components/glass-toolbar.tsx` - Glassmorphic toolbar that appears when keyboard is shown
  - Supports multiple contexts: Main, Heading, Link
  - Context-aware button states (active/disabled)
  - Uses `expo-glass-effect` for glassmorphism UI
  - Only renders when keyboard is visible (keyboardHeight > 0)
- `src/components/toolbar-buttons.ts` - Button definitions (MAIN_TOOLBAR_BUTTONS, HEADING_BUTTONS)
- `src/components/toolbar-types.ts` - TypeScript types for toolbar system

**Toolbar System:**
Each toolbar button has:
- `id`, `label`, `icon`
- `action(editor, state)` - Execute command
- `getActive(state)` - Check if format is active
- `getDisabled(state)` - Check if command is available

### Styling
- **Tailwind CSS v4** via `tailwindcss` package
- **Uniwind** - React Native-specific Tailwind (metro.config.js integration)
- **HeroUI Native** - UI component library (`heroui-native`)
- **Glassmorphism** - `expo-glass-effect` for frosted glass UI
- Class names work via Uniwind's runtime (see `.vscode/settings.json` for configured attributes)

### Provider Stack
Root layout (`src/app/_layout.tsx`) wraps app with:
1. `GestureHandlerRootView` - For react-native-gesture-handler
2. `HeroUINativeProvider` - HeroUI context

## Code Quality Requirements

**CRITICAL:** After completing any coding work and before delivering, you MUST run the following checks:

```bash
# Type checking
bunx tsc --noEmit

# Linting
bun run lint
```

Both commands must pass with no errors before considering the work complete. If there are any TypeScript or ESLint errors, fix them before delivery.

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

## Git Commit Guidelines

After completing a meaningful amount of work (e.g., new feature, bug fix, refactor), you may recommend creating a git commit. The process should be:

1. **Recommend commit** - Suggest creating a commit when significant work is complete
2. **Run pre-commit review** - Before generating commit message, run the Linus-style code review:
   - Use the `/pre-commit-review` skill to check staged changes
   - This will review code for errors, performance issues, and code quality problems
   - Fix any critical issues found before proceeding
3. **Generate commit message** - If user agrees, generate an English commit message following conventional commit format:
   - Use format: `type: description`
   - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
   - Write clear, concise descriptions focusing on "why" rather than "what"
   - **IMPORTANT**: Do NOT include Claude Code attribution or "Co-Authored-By" tags
4. **Create commit** - If user approves the message, create the commit using standard git commands

### Pre-Commit Review Skill

The project includes a `pre-commit-review` skill that performs Linus Torvalds-style code review:
- **Brutally honest** feedback on code quality
- Checks for: errors, performance issues, bad patterns, security vulnerabilities
- React/React Native specific: missing dependencies, state mutations, memory leaks
- TypeScript specific: `any` types, missing types, improper assertions

Run it before committing:
```
/pre-commit-review
```

Example commit message format:
```
feat: Add component name and description

- Detail 1
- Detail 2

Additional context about the change.
```

## Database Migration Troubleshooting

### Windows-Specific Issues

**Problem 1: UnicodeDecodeError with pyproject.toml**
```
UnicodeDecodeError: 'gbk' codec can't decode byte 0x80
```
**Solution**: Use `alembic.ini` for database URL (Windows encoding limitation)
- Keep database URL in `backend/alembic.ini`
- Other Alembic settings in `pyproject.toml`'s `[tool.alembic]` section
- Use only English comments in `alembic.ini`

**Problem 2: Timezone error**
```
Can't locate timezone: UTC
```
**Solution**: Comment out `timezone = UTC` in both `alembic.ini` and `pyproject.toml`

**Problem 3: NameError for sqlmodel**
```
NameError: name 'sqlmodel' is not defined
```
**Solution**: Migration template should include `import sqlmodel`
- Already fixed in `backend/migrations/script.py.mako`
- For manual migration files, add: `import sqlmodel` after imports

### ElectricSQL Issues

**Problem: Table sync errors after migration**
```
Database table "public.todos" has been dropped or renamed
```
**Solution**: Restart ElectricSQL to recognize new table OID
```bash
docker compose restart electric
```

### General Migration Issues

**Problem: Autogenerate creates empty migration**
**Solution**: Check that:
1. `migrations/env.py` imports all models from `app.models`
2. `target_metadata = SQLModel.metadata` (not `None`)
3. Database connection is correct

**Problem: Migration apply fails**
**Solution**: Check database connection and Docker services:
```bash
docker compose ps
docker compose logs postgres
```

**Problem: Want to disable auto-migration on startup**
**Solution**: Set environment variable:
```bash
export RUN_MIGRATIONS_ON_STARTUP=false
```

### Common Migration Workflows

**Adding a new column to Todo model:**
1. Modify `backend/app/models.py`
2. Generate: `uv run alembic revision --autogenerate -m "Add priority field"`
3. Review: Check `backend/migrations/versions/<newest-file>.py`
4. Apply: `uv run alembic upgrade head`

**Rolling back a bad migration:**
1. `uv run alembic downgrade -1`
2. Fix the migration file or delete it
3. Re-generate if needed
4. `uv run alembic upgrade head`

**Checking migration status:**
```bash
uv run alembic current      # Current version
uv run alembic history      # All versions
uv run alembic check        # Check for pending changes
```

## TanStack DB + ElectricSQL Integration Troubleshooting

### Common Issues

**409 Conflict on App Startup**

**Symptoms:**
```
INFO: "GET /api/todos?...&handle=XXX HTTP/1.1" 409 Conflict
INFO: "GET /api/todos?...&handle=YYY HTTP/1.1" 200 OK
```

**Cause:** This is NORMAL behavior, not an error. It's ElectricSQL's session recovery mechanism:
1. Client attempts to reconnect using cached handle from previous session
2. ElectricSQL detects handle is expired and returns 409
3. Client automatically creates new connection with fresh handle
4. All subsequent syncs work normally

**Solution:** No action needed. TanStack DB Electric Collection handles this automatically.

**Frontend Error: "Cannot read property 'event' of undefined"**

**Symptoms:** App crashes with TypeError in `isMoveOutMessage`

**Cause:** Backend shape stream is sending malformed messages or closing prematurely

**Solutions:**
1. Check all ElectricSQL protocol parameters are forwarded (especially `log`, `cursor`, `columns`)
2. Ensure backend doesn't close stream before response completes
3. Verify backend uses `client.send(req, stream=True)` not `async with client.stream()`

**Backend Error: "Stream has been closed"**

**Symptoms:**
```
httpx.StreamClosed: Attempted to read or stream content, but the stream has been closed.
```

**Cause:** Using `async with client.stream()` which closes stream when function returns

**Solution:** Reference `backend/app/main.py:200-234`:
- Use `client.send(req, stream=True)` to get response object
- Move cleanup to `stream_generator`'s `finally` block
- Don't use context manager for the stream

**Optimistic Updates Not Syncing**

**Symptoms:** Mutations appear to work but data doesn't sync from backend

**Cause: txid mismatch** - Backend returns txid that doesn't match actual transaction in Postgres

**Diagnosis:** Enable debug logging in browser console:
```javascript
localStorage.debug = 'ts/db:electric'
```

Look for:
```
ts/db:electric awaitTxId called with txid 124
ts/db:electric new txids synced from pg [123]
// Stalls forever - 124 never arrives!
```

**Solution:** Ensure `pg_current_xact_id()::xid::text` is called INSIDE the mutation transaction:
```python
async with db.begin():
    txid = await get_current_txid(db)  # ← INSIDE transaction
    # ... do mutations
    return {"todo": new_todo, "txid": txid}
```

**Common mistake:** Calling `get_current_txid()` outside the transaction creates a separate transaction with a different txid.

**Repeated 500 Errors on Shape Stream**

**Symptoms:** Backend logs show repeated 500 errors for `/api/todos` requests

**Cause:** Missing ElectricSQL protocol parameters in backend whitelist

**Solution:** Ensure `ELECTRIC_PROTOCOL_QUERY_PARAMS` includes all parameters:
- `live`, `live-sse`, `handle`, `offset`
- `live-cache-buster`, `expired-handle`
- `log`, `log-mode` ← Often missing!
- `cursor` ← Often missing!
- `where`, `limit`, `order-by`, `where-params`
- `columns` ← Often missing!

**ElectricSQL Table Sync Errors After Migration**

**Symptoms:**
```
Database table "public.todos" has been dropped or renamed
```

**Cause:** ElectricSQL caches table OIDs, which change after migrations

**Solution:** Restart ElectricSQL service:
```bash
docker compose restart electric
```
