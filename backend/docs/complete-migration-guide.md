# Complete Guide to Alembic Database Migrations

**English | [中文](complete-migration-guide-zh.md)**

> Beginner-friendly Alembic Database Migration Tutorial - From Scratch to Proficiency

This tutorial is based on the official Alembic documentation, combined with actual project requirements, providing a complete guide from basics to advanced usage.

---

## 📋 Table of Contents

* [Quick Start](https://www.google.com/search?q=%23quick-start)
* [Basic Alembic Concepts](https://www.google.com/search?q=%23basic-alembic-concepts)
* [Initial Setup](https://www.google.com/search?q=%23initial-setup)
* [Daily Usage](https://www.google.com/search?q=%23daily-usage)
* [Deep Dive: Autogenerate](https://www.google.com/search?q=%23deep-dive-autogenerate)
* [Advanced Configuration](https://www.google.com/search?q=%23advanced-configuration)
* [FAQ](https://www.google.com/search?q=%23faq)
* [Best Practices](https://www.google.com/search?q=%23best-practices)
* [Command Cheatsheet](https://www.google.com/search?q=%23command-cheatsheet)

---

## ⚡ Quick Start

### Quick Setup Commands (First Time)

```bash
# 1. Start the database
docker-compose up -d

# 2. Initialize Alembic
cd backend
uv run alembic init migrations

# 3. Configuration Files (Requires manual editing, see steps below)
# - alembic.ini: Modify database connection
# - migrations/env.py: Import models and configure async

# 4. Generate migration
uv run alembic revision --autogenerate -m "Initial migration"

# 5. Apply migration
uv run alembic upgrade head

```

### Daily Usage Commands

```bash
# After modifying models, generate and apply migrations
cd backend
uv run alembic revision --autogenerate -m "Describe the change"
uv run alembic upgrade head

# View current version
uv run alembic current

# View migration history
uv run alembic history

```

---

## 📚 Basic Alembic Concepts

### What is a Migration Environment?

The usage of Alembic starts with creating a **Migration Environment**. This is a directory of scripts specific to your application that is created once and then maintained alongside your application's source code.

### Migration Environment Directory Structure

```
backend/
├── alembic.ini           # Main Alembic configuration file
├── pyproject.toml        # Modern Python project configuration
└── migrations/           # Migration environment directory (name customizable)
    ├── env.py            # Python script executed every time migrations run
    ├── README            # Readme file
    ├── script.py.mako    # Mako template for generating new migration files
    └── versions/         # Directory storing migration scripts
        ├── 3512b954651e_add_account.py
        ├── 2b1ae634e5cd_add_order_id.py
        └── 3adcc9a56557_rename_username_field.py

```

### File Explanations

| File/Directory | Description |
| --- | --- |
| `alembic.ini` | The main configuration file for Alembic, containing the database URL, script location, etc. |
| `migrations/env.py` | The script executed when running migrations, responsible for configuring the database connection and migration engine. |
| `migrations/script.py.mako` | The Mako template file used to generate new migration scripts. |
| `migrations/versions/` | The directory where specific migration scripts are stored. |

---

## 🎯 Initial Setup

### Step 1: Start the Database

Open a terminal in the **project root directory** and run:

```bash
docker-compose up -d

```

✅ This will start the PostgreSQL and Electric SQL services.

**Verify services are running**:

```bash
docker-compose ps

```

---

### Step 2: Initialize Alembic

Enter the `backend` directory:

```bash
cd backend
uv run alembic init migrations

```

✅ This creates:

* `migrations/` directory
* `migrations/env.py` - Environment configuration
* `migrations/script.py.mako` - Migration template
* `migrations/versions/` - Migration script directory
* `alembic.ini` - Alembic configuration file

### Using Different Templates

Alembic provides various environment templates:

```bash
# View available templates
uv run alembic list_templates

```

Available templates:

| Template | Description |
| --- | --- |
| `generic` | Generic single-database configuration (default) |
| `pyproject` | PEP-621 compliant configuration using pyproject.toml |
| `async` | Generic configuration supporting asynchronous databases |
| `multidb` | Multi-database configuration |

To create using a specific template:

```bash
# Use the async template (Recommended for this project)
uv run alembic init --template async migrations

```

---

### Step 3: Configure Database Connection

Open `backend/alembic.ini` and find the `sqlalchemy.url` setting:

```ini
# Default configuration
sqlalchemy.url = driver://user:pass@localhost/dbname

```

**Replace with project configuration**:

```ini
sqlalchemy.url = postgresql+asyncpg://postgres:password@localhost:54321/electric

```

💡 **Tip**: This is the address to connect to the local Docker database.

#### Database URL Format Explanation

**PostgreSQL Examples:**

```ini
# Basic format
postgresql://scott:tiger@localhost:5432/mydb

# Using asyncpg driver (Async)
postgresql+asyncpg://scott:tiger@localhost:5432/mydb

# Using psycopg2 driver (Sync)
postgresql+psycopg2://scott:tiger@localhost:5432/mydb

```

#### Special Character Escaping

If your password contains special characters (like `%`, `@`), you need double escaping:

1. **URL Escaping** (Required by SQLAlchemy):
* `%` → `%25`
* `@` → `%40`


2. **ConfigParser Escaping** (Required by alembic.ini):
* Replace `%` with `%%`



**Example:** Password is `P@ssw%rd`

```python
# Python code to generate the correctly escaped URL
import urllib.parse

password = "P@ssw%rd"
# Step 1: URL Escape
url_escaped = urllib.parse.quote_plus(password)
# Result: P%40ssw%25rd

# Step 2: ConfigParser Escape
config_escaped = url_escaped.replace("%", "%%")
# Result: P%%40ssw%%25rd

# Final Configuration
# sqlalchemy.url = postgresql://scott:P%%40ssw%%25rd@localhost:5432/mydb

```

---

### Step 4: Configure Model Import

Open `backend/migrations/env.py` and find the `target_metadata` configuration:

```python
# Original content
# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = None

```

**Replace with**:

```python
# Import project path
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import SQLModel and all models
from sqlmodel import SQLModel
from app.models import Todo  # If there are more models, import them all

# Set metadata
target_metadata = SQLModel.metadata

```

💡 **Why do this?**
According to the [Alembic Official Docs](https://alembic.sqlalchemy.org/en/latest/autogenerate.html), Alembic needs access to your model metadata to automatically detect changes.

---

### Step 5: Configure Async Support

In the same `env.py` file, find the `run_migrations_online()` function and **completely replace it with**:

```python
def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    """Run migrations in 'online' mode with async support."""
    from sqlalchemy.ext.asyncio import async_engine_from_config
    from sqlalchemy import pool

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

```

Then find the call section at the **end of the file**:

```python
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

```

**Replace with**:

```python
if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_migrations_online())

```

---

### Step 6: Generate Initial Migration

```bash
uv run alembic revision --autogenerate -m "Initial migration"

```

✅ This generates a migration file in `migrations/versions/`.

**What Alembic Automatically Detects**:

| Type | Description |
| --- | --- |
| ✅ **Fully Supported** | Table add/drop, Column add/drop, Column nullable status change, Basic Index and Foreign Key constraints |
| ⚠️ **Optional Detection** | Column type changes (enabled by default), Server default value changes (requires config) |
| ❌ **Cannot Detect** | Table/Column renaming, Constraint renaming, Anonymous constraint changes |

---

### Step 7: Review Generated Migration

Open `migrations/versions/xxxx_initial_migration.py` and confirm it includes code to create the table:

```python
"""Initial migration

Revision ID: 1975ea83b712
Revises:
Create Date: 2024-01-01 10:00:00.000000

"""
# revision identifiers, used by Alembic.
revision = '1975ea83b712'
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Create todos table
    op.create_table('todos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('text', sa.String(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    # Drop todos table
    op.drop_table('todos')

```

⚠️ **Important**: Always review auto-generated code for correctness! Alembic is not perfect.

**Common Migration Operations**:

| Operation | Description |
| --- | --- |
| `op.create_table()` | Create table |
| `op.drop_table()` | Drop table |
| `op.add_column()` | Add column |
| `op.drop_column()` | Drop column |
| `op.alter_column()` | Alter column |
| `op.create_index()` | Create index |
| `op.drop_index()` | Drop index |
| `op.create_foreign_key()` | Create foreign key |
| `op.drop_foreign_key()` | Drop foreign key |

---

### Step 8: Apply Migrations

```bash
uv run alembic upgrade head

```

✅ This creates the tables in the database.

**Expected Output**:

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> xxxx, Initial migration

```

**Upgrade Options**:

```bash
# Upgrade to the latest version
uv run alembic upgrade head

# Upgrade to a specific version (use full revision ID)
uv run alembic upgrade 1975ea83b712

# Upgrade to a specific version (partial ID works if unique)
uv run alembic upgrade 1975

# Relative upgrade (Advance N versions)
uv run alembic upgrade +2

```

---

### Step 9: Verify

```bash
# View current migration version
uv run alembic current

# View database tables
docker exec -it electric_expo_db_quickstart-postgres-1 psql -U postgres -d electric -c "\dt"

# View todos table structure
docker exec -it electric_expo_db_quickstart-postgres-1 psql -U postgres -d electric -c "\d todos"

```

🎉 **Complete!** The database is initialized.

---

## 🔄 Daily Usage

### How to update the database after modifying models?

#### 1. Modify Model

For example, add a new field in `app/models.py`:

```python
class Todo(SQLModel, table=True):
    # ... existing fields
    priority: Optional[str] = Field(default="normal")  # New field

```

#### 2. Generate Migration

```bash
cd backend
uv run alembic revision --autogenerate -m "Add priority field to todos"

```

#### 3. Review Generated Migration

Open the newly generated file and confirm the changes are correct:

```python
def upgrade() -> None:
    op.add_column('todos', sa.Column('priority', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('todos', 'priority')

```

#### 4. Apply Migration

```bash
uv run alembic upgrade head

```

✅ Database updated!

---

### Rolling Back Migrations

```bash
# Rollback one version
uv run alembic downgrade -1

# Rollback to a specific version
uv run alembic downgrade <revision_id>

# Rollback all migrations
uv run alembic downgrade base

# Relative downgrade
uv run alembic downgrade -2

```

**Downgrade Internal Process**:

1. Checks the current version in the `alembic_version` table.
2. Calculates the downgrade path from the current version to the target version.
3. Sequentially executes the `downgrade()` method of each migration file.

---

### Viewing Migration Information

```bash
# View current version
uv run alembic current

# View all migrations history
uv run alembic history

# View detailed history
uv run alembic history --verbose

# View history range
uv run alembic history -r1975ea:ae1027  # From 1975ea to ae1027
uv run alembic history -r-3:current      # Last 3 versions to current
uv run alembic history -r1975ea:         # From 1975ea to latest

# View all branches
uv run alembic branches

# View all head revisions
uv run alembic heads

```

**Output Example**:

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
Current revision for postgresql://scott:XXXXX@localhost/test: 1975ea83b712 -> ae1027a6acf (head), Add a column

```

---

### Manually Creating Migrations

Sometimes you need to write migrations manually (e.g., data migrations, complex changes):

```bash
# Create an empty migration file
uv run alembic revision -m "Custom data migration"

```

Then manually edit the generated file:

```python
def upgrade() -> None:
    # Execute data migration
    from sqlalchemy import table, column
    todos = table('todos',
        column('id', sa.Integer()),
        column('text', sa.String())
    )

    # Bulk update data
    connection.execute(
        todos.update()
        .where(todos.c.id == 1)
        .values(text='Updated text')
    )

def downgrade() -> None:
    # Rollback data migration
    pass

```

---

## 🔍 Deep Dive: Autogenerate

### Checking for New Migrations

Use the `alembic check` command (does not generate actual files):

```bash
uv run alembic check

```

**When changes exist**:

```
FAILED: New upgrade operations detected: [
  ('add_column', None, 'my_table', Column('data', String(), table=<my_table>)),
  ('add_column', None, 'my_table', Column('newcol', Integer(), table=<my_table>))]

```

**When no changes exist**:

```
No new upgrade operations detected.

```

---

### Changes Autogenerate Can Detect

| Type | Description |
| --- | --- |
| ✅ Table Add/Drop | Fully supported |
| ✅ Column Add/Drop | Fully supported |
| ✅ Column Nullable Status | Fully supported |
| ✅ Basic Index & Unique Constraints | Fully supported |
| ✅ Basic Foreign Key Constraints | Fully supported |
| ⚠️ Column Type Change | Enabled by default, controllable via `compare_type` |
| ⚠️ Server Default Change | Requires setting `compare_server_default=True` |

---

### Changes Autogenerate Cannot Detect

| Type | Description |
| --- | --- |
| ❌ Table Renaming | Detected as dropping old table + creating new table |
| ❌ Column Renaming | Detected as dropping old column + adding new column |
| ❌ Anonymous Constraints | Constraints must be named |
| ❌ Special SQLAlchemy Types | e.g., `Enum` on databases that don't support it natively |
| ❌ Certain Standalone Constraints | PRIMARY KEY, EXCLUDE, CHECK, etc. |

**Solutions**:

**Method 1**: Manually edit the autogenerated migration file

```python
def upgrade() -> None:
    # Rename column (Alembic generates drop+add, manually change to alter_column)
    op.alter_column('todos', 'old_name', new_column_name='new_name')

```

**Method 2**: Create a custom migration

```bash
uv run alembic revision -m "Rename column"
# Then write migration code manually

```

---

### Controlling Autogenerate Behavior

#### Configuring Type Comparison

**Disable Type Comparison**:

```python
# In migrations/env.py
context.configure(
    # ...
    compare_type = False
)

```

**Custom Type Comparison Function**:

```python
def my_compare_type(context, inspected_column,
                    metadata_column, inspected_type, metadata_type):
    # Return False means types are the same
    # Return None means use default comparison logic
    # Return True means types are different, generate migration
    return None

context.configure(
    # ...
    compare_type = my_compare_type
)

```

#### Filtering Specific Objects

**Filter Specific Schemas**:

```python
def include_name(name, type_, parent_names):
    if type_ == "schema":
        # Only include these schemas
        return name in [None, "schema_one", "schema_two"]
    else:
        return True

context.configure(
    # ...
    include_schemas = True,
    include_name = include_name
)

```

**Filter Specific Tables**:

```python
target_metadata = MyModel.metadata

def include_name(name, type_, parent_names):
    if type_ == "table":
        # Only include tables defined in the model
        return parent_names["schema_qualified_table_name"] in target_metadata.tables
    else:
        return True

context.configure(
    # ...
    target_metadata = target_metadata,
    include_name = include_name,
    include_schemas = True
)

```

**Object-based Filtering**:

```python
def include_object(object, name, type_, reflected, compare_to):
    # Skip columns marked with skip_autogenerate
    if (type_ == "column" and
        not reflected and
        object.info.get("skip_autogenerate", False)):
        return False
    else:
        return True

context.configure(
    # ...
    include_object = include_object
)

```

**Usage Example**:

```python
# Mark column to skip in model
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String)
    # This column will not be detected by autogenerate
    temp_field = Column(String, info={"skip_autogenerate": True})

```

---

### Using Multiple MetaData

```python
from myapp.mymodel1 import Model1Base
from myapp.mymodel2 import Model2Base

# Use a list
target_metadata = [Model1Base.metadata, Model2Base.metadata]

```

---

## ⚙️ Advanced Configuration

### Using pyproject.toml Configuration

Starting from Alembic 1.16.0, you can use `pyproject.toml` for configuration:

```bash
# Initialize using pyproject template
uv run alembic init --template pyproject migrations

```

**pyproject.toml Config Example**:

```toml
[tool.alembic]
# Script location
script_location = "%(here)s/migrations"

# File naming template
# file_template = %%(year)d_%%(month).2d_%%(day).2d_%%(hour).2d%%(minute).2d-%%(rev)s_%%(slug)s

# Additional sys.path
prepend_sys_path = [
    "."
]

# Timezone
# timezone = UTC

# Version locations
# version_locations = [
#     "%(here)s/migrations/versions",
# ]

# Recursive version locations
# recursive_version_locations = false

# Output encoding
output_encoding = "utf-8"

```

---

### Configuring Code Formatting

**Format Generated Migrations with Black**:

Configure in `alembic.ini`:

```ini
[post_write_hooks]
# Format code
hooks = black

black.type = console_scripts
black.entrypoint = black
black.options = -l 79 REVISION_SCRIPT_FILENAME

```

Or in `pyproject.toml`:

```toml
[[tool.alembic.post_write_hooks]]
name = "black"
type = "console_scripts"
entrypoint = "black"
options = "-l 79 REVISION_SCRIPT_FILENAME"

```

**Using Multiple Tools (Black + zimports)**:

```ini
[post_write_hooks]
hooks = black, zimports

black.type = console_scripts
black.entrypoint = black
black.options = -l 79 REVISION_SCRIPT_FILENAME

zimports.type = console_scripts
zimports.entrypoint = zimports
zimports.options = --style google REVISION_SCRIPT_FILENAME

```

**Using pre-commit**:

```ini
[post_write_hooks]
hooks = pre-commit

pre-commit.type = console_scripts
pre-commit.entrypoint = pre-commit
pre-commit.options = run --files REVISION_SCRIPT_FILENAME
pre-commit.cwd = %(here)s

```

---

### Custom Post-Write Hooks

Write a Python function as a hook:

```python
from alembic.script import write_hooks
import re

@write_hooks.register("spaces_to_tabs")
def convert_spaces_to_tabs(filename, options):
    lines = []
    with open(filename) as file_:
        for line in file_:
            lines.append(
                re.sub(
                    r"^(    )+",
                    lambda m: "\t" * (len(m.group(1)) // 4),
                    line
                )
            )
    with open(filename, "w") as to_write:
        to_write.write("".join(lines))

```

Use in `alembic.ini`:

```ini
[alembic]
revision_environment = true

[post_write_hooks]
hooks = spaces_to_tabs
spaces_to_tabs.type = spaces_to_tabs

```

---

### Configure Migration File Naming

Customize file naming template in `alembic.ini`:

```ini
# Use datetime prefix
file_template = %%(year)d_%%(month).2d_%%(day).2d_%%(hour).2d%%(minute).2d-%%(rev)s_%%(slug)s

# Or organize by date subdirectory (requires recursive_version_locations = true)
file_template = %%(year)d/%%(month).2d/%%(day).2d_%%(hour).2d%%(minute).2d_%%(second).2d_%%(rev)s_%%(slug)s

```

**Placeholders**:

| Placeholder | Description | Example |
| --- | --- | --- |
| `%(year)d` | 4-digit year | 2024 |
| `%(month).2d` | 2-digit month | 01 |
| `%(day).2d` | 2-digit day | 15 |
| `%(hour).2d` | 2-digit hour | 13 |
| `%(minute).2d` | 2-digit minute | 45 |
| `%(rev)s` | Revision ID | 1975ea83b712 |
| `%(slug)s` | Slugified message | create_account_table |
| `%(table)s` | Table name (if autogenerated) | todos |

---

## ❓ FAQ

### Q1: Error "No module named 'app'" when running migrations

**Cause**: Running commands from the wrong directory.

**Solution**: Ensure you run it from the `backend` directory.

```bash
cd backend
uv run alembic upgrade head

```

**Or**: Check if `sys.path` configuration in `migrations/env.py` is correct.

---

### Q2: Generated migration file is empty

**Cause**: Alembic didn't detect model changes.

**Solution**:

1. ✅ Confirm `env.py` imports all models.
2. ✅ Confirm `target_metadata = SQLModel.metadata`.
3. ✅ Confirm database connection is correct.
4. ✅ If the table already exists and matches the model, Alembic generates nothing.

---

### Q3: Database connection failed

**Checklist**:

* ✅ Docker container running: `docker-compose ps`
* ✅ Port correct: `54321`
* ✅ Connection string: `postgresql+asyncpg://postgres:password@localhost:54321/electric`
* ✅ Database name: `electric`

**Test Connection**:

```bash
docker exec -it electric_expo_db_quickstart-postgres-1 psql -U postgres -d electric -c "SELECT 1"

```

---

### Q4: Migration failed, how to rollback?

```bash
# View current version
uv run alembic current

# Rollback to previous version
uv run alembic downgrade -1

# If needed, delete the failed migration file
rm migrations/versions/xxxx_failed_migration.py

```

---

### Q5: How to apply migrations in production?

⚠️ **Production Best Practices**:

1. **Backup Database** (Mandatory!)

```bash
pg_dump -U postgres -d electric > backup_$(date +%Y%m%d).sql

```

2. **Test migration in staging environment first**
3. **Inspect Migration Content**

```bash
uv run alembic upgrade head --sql > migration.sql
# Review migration.sql file

```

4. **Apply Migration**

```bash
uv run alembic upgrade head

```

5. **Verify Data**

---

### Q6: Alembic detected changes it shouldn't have

**Issue**: Autogenerate created some unwanted migrations.

**Solution**:

1. **Use `include_object` filter**

```python
def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        # Only include specific tables
        return name == "todos"
    return True

```

2. **Use `include_name` filter**

```python
def include_name(name, type_, parent_names):
    if type_ == "column":
        # Exclude specific column
        return name != "temp_column"
    return True

```

---

### Q7: How to handle data migrations?

**Scenario**: Need to modify data in a migration, not just table structure.

**Solution**: Use bulk operations.

```python
from sqlalchemy import table, column

def upgrade() -> None:
    # Define temp table structure
    todos = table('todos',
        column('id', sa.Integer()),
        column('text', sa.String()),
        column('completed', sa.Boolean())
    )

    # Bulk update
    connection.execute(
        todos.update()
        .where(todos.c.completed == None)
        .values(completed=False)
    )

def downgrade() -> None:
    # Rollback data change
    todos = table('todos',
        column('id', sa.Integer()),
        column('completed', sa.Boolean())
    )

    connection.execute(
        todos.update()
        .where(todos.c.completed == False)
        .values(completed=None)
    )

```

---

## 💡 Best Practices

### 1. ✅ Always Review Auto-generated Migrations

According to Alembic Official Docs:

> "It is always necessary to manually review and correct the candidate migrations that autogenerate produces."

Autogenerate is not perfect; always review manually!

---

### 2. ✅ Use Descriptive Migration Messages

**Good Example**:

```bash
uv run alembic revision --autogenerate -m "Add priority and due_date to todos"

```

**Bad Example**:

```bash
uv run alembic revision --autogenerate -m "update"
uv run alembic revision --autogenerate -m "fix"

```

---

### 3. ✅ Name Your Constraints

Always name constraints to allow Autogenerate to detect them:

```python
# ❌ Bad: Anonymous Constraint
UniqueConstraint('col1', 'col2')

# ✅ Good: Named Constraint
UniqueConstraint('col1', 'col2', name="uq_col1_col2")

# ✅ Good: Named Foreign Key
ForeignKeyConstraint(['user_id'], ['users.id'], name="fk_todos_user_id")

```

---

### 4. ✅ Backup Database Before Applying Migrations

Especially in production, always backup first!

---

### 5. ✅ Test Upgrade and Downgrade

Ensure rollback is possible:

```bash
# Apply migration
uv run alembic upgrade head

# Test rollback
uv run alembic downgrade -1

# Re-apply
uv run alembic upgrade head

```

---

### 6. ✅ Commit Migration Files to Version Control

```bash
git add migrations/versions/
git commit -m "Add migration: Add priority field to todos"

```

---

### 7. ✅ Do One Thing at a Time

Don't mix unrelated changes in one migration. Each migration should be an independent, reversible unit.

**❌ Bad**:

```bash
uv run alembic revision --autogenerate -m "Add priority field and rename status column"

```

**✅ Good**:

```bash
uv run alembic revision --autogenerate -m "Add priority field to todos"
uv run alembic revision --autogenerate -m "Rename status to completed"

```

---

### 8. ✅ Use Relative Revision Identifiers

Easier to reference in scripts:

```bash
# Apply next migration
uv run alembic upgrade +1

# Rollback two migrations
uv run alembic downgrade -2

```

---

### 9. ✅ Configure Code Formatting

Keep migration file style consistent:

```ini
[post_write_hooks]
hooks = black
black.type = console_scripts
black.entrypoint = black
black.options = -l 79 REVISION_SCRIPT_FILENAME

```

---

### 10. ✅ Use alembic check

Integrate into CI/CD to ensure migrations are in sync:

```yaml
# .github/workflows/ci.yml
- name: Check for pending migrations
  run: uv run alembic check

```

---

### 11. ✅ Regularly Clean Up Old Migrations

Avoid having too many version files affecting startup performance. Consider:

* Organizing migrations by date subdirectories.
* Periodically squashing old migrations (proceed with caution).

---

## 📚 Command Cheatsheet

### Generating Migrations

```bash
uv run alembic revision --autogenerate -m "Desc"  # Auto-generate migration
uv run alembic revision -m "Desc"                 # Manually create empty migration
uv run alembic list_templates                     # List available templates

```

### Applying Migrations

```bash
uv run alembic upgrade head                       # Apply all migrations
uv run alembic upgrade +1                         # Apply next migration
uv run alembic upgrade <revision>                 # Apply to specific version

```

### Rolling Back Migrations

```bash
uv run alembic downgrade -1                       # Rollback one version
uv run alembic downgrade base                     # Rollback all migrations
uv run alembic downgrade <revision>               # Rollback to specific version

```

### Viewing Status

```bash
uv run alembic current                            # View current version
uv run alembic history                            # View migration history
uv run alembic history --verbose                  # View detailed history
uv run alembic history -r1975ea:ae1027            # View history range
uv run alembic heads                              # View all head revisions
uv run alembic branches                           # View all branches

```

### Others

```bash
uv run alembic upgrade head --sql                 # Generate SQL without executing
uv run alembic check                              # Check for unapplied migrations

```

---

## 🔗 Related Resources

### Official Documentation

* **[Alembic Official Docs](https://alembic.sqlalchemy.org/)** - Complete Alembic documentation
* **[Alembic Autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html)** - Autogenerate details
* **[SQLAlchemy Docs](https://docs.sqlalchemy.org/)** - SQLAlchemy ORM documentation
* **[SQLModel Docs](https://sqlmodel.tiangolo.com/)** - SQLModel ORM documentation
* **[FastAPI Docs](https://fastapi.tiangolo.com/)** - FastAPI framework documentation

### Project Related

* **[This project's backend/app/models.py](https://www.google.com/search?q=../app/models.py)** - Model definitions
* **[This project's backend/migrations/](https://www.google.com/search?q=../migrations/)** - Migration environment

---

## 🛠️ Tech Stack

* **FastAPI** - Modern Python Web Framework
* **SQLModel** - Python ORM for SQL Databases
* **Alembic** - Database Migration Tool
* **PostgreSQL** - Relational Database
* **Electric SQL** - Real-time Data Sync
* **asyncpg** - Async PostgreSQL Driver

---

**Happy Coding!** 🎉

If you have questions, check the [FAQ](https://www.google.com/search?q=%23faq) or refer to the [Alembic Official Docs](https://alembic.sqlalchemy.org/).