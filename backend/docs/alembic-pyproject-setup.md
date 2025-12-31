# Alembic 迁移计划：使用 pyproject.toml + 自动迁移

## 概述

为 backend 项目从零开始配置 Alembic，使用现代的 `pyproject.toml` 配置方式（不使用 `alembic.ini`），并启用：
1. **autogenerate 功能**：自动检测模型变化生成迁移
2. **应用启动时自动运行迁移**：FastAPI 启动时自动执行待处理的迁移

## 环境信息

- **数据库**：PostgreSQL 16 (localhost:54321/electric)
- **驱动**：asyncpg (异步)
- **ORM**：SQLModel + SQLAlchemy 2.0
- **Alembic 版本**：>= 1.17.2 (支持 pyproject.toml 配置)
- **现有模型**：app/models.py (Todo)

## 实施步骤

### 第 1 步：初始化 Alembic 环境

使用 `pyproject` 模板初始化 Alembic：

```bash
cd backend
uv run alembic init --template pyproject migrations
```

这会创建：
- `migrations/` 目录
- `migrations/env.py`（需手动修改以支持异步）
- `migrations/script.py.mako`
- `migrations/versions/` 目录
- 在 `pyproject.toml` 中添加 `[tool.alembic]` 配置节

**注意**：不会创建 `alembic.ini` 文件（符合要求）

---

### 第 2 步：配置 pyproject.toml

在 `backend/pyproject.toml` 末尾添加以下配置：

```toml
[tool.alembic]
# 迁移脚本位置
script_location = "migrations"

# 文件命名模板（使用日期时间前缀）
file_template = "%%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d-%%(rev)s_%%(slug)s"

# 额外的 sys.path
prepend_sys_path = ["."]

# 时区
timezone = "UTC"

# 输出编码
output_encoding = "utf-8"

# 数据库 URL（可被环境变量覆盖）
sqlalchemy.url = "postgresql+asyncpg://postgres:password@localhost:54321/electric"

# 自动代码格式化
[[tool.alembic.post_write_hooks]]
name = "black"
type = "console_scripts"
entrypoint = "black"
options = "-l 79 REVISION_SCRIPT_FILENAME"

[project.optional-dependencies]
dev = ["black>=24.0.0"]

[tool.black]
line-length = 79
target-version = ['py312']
```

安装 Black 开发依赖：

```bash
cd backend
uv sync --extra dev
```

---

### 第 3 步：配置异步支持

修改 `backend/migrations/env.py` 以支持异步数据库：

**关键修改**：

1. **导入依赖**（文件顶部）：
```python
import asyncio
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool
```

2. **配置 target_metadata**（找到 `target_metadata = None`，替换为）：
```python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import SQLModel
from app.models import Todo  # 导入所有模型

target_metadata = SQLModel.metadata
```

3. **创建异步运行函数**（替换 `run_migrations_online()` 函数）：
```python
def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    """Run migrations in 'online' mode with async support."""
    configuration = config.get_section(config.config_ini_section)

    # 优先使用环境变量中的 DATABASE_URL
    configuration["sqlalchemy.url"] = os.getenv(
        "DATABASE_URL",
        configuration["sqlalchemy.url"]
    )

    connectable = async_engine_from_config(
        configuration,
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()
```

4. **更新主执行逻辑**（文件末尾）：
```python
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

---

### 第 4 步：创建自动迁移运行器

创建新文件 `backend/app/alembic_runner.py`：

```python
"""Auto-run Alembic migrations on FastAPI startup."""
import os
import asyncio
import logging
from pathlib import Path
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import pool

logger = logging.getLogger(__name__)

# 从环境变量读取配置
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:54321/electric"
)

# 是否在启动时自动运行迁移（可通过环境变量关闭）
RUN_MIGRATIONS_ON_STARTUP = os.getenv("RUN_MIGRATIONS_ON_STARTUP", "true").lower() == "true"


async def run_migrations():
    """Run Alembic migrations programmatically."""
    if not RUN_MIGRATIONS_ON_STARTUP:
        logger.info("Auto-migration disabled by environment variable")
        return

    logger.info("Running database migrations...")

    # 获取 migrations 目录路径
    backend_dir = Path(__file__).parent.parent
    alembic_ini = backend_dir / "pyproject.toml"

    # 创建 Alembic 配置
    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))

    # 从环境变量读取数据库 URL
    configuration = {
        "sqlalchemy.url": DATABASE_URL
    }

    # 导入 target_metadata
    import sys
    sys.path.insert(0, str(backend_dir))
    from sqlmodel import SQLModel
    from app.models import Todo
    target_metadata = SQLModel.metadata

    # 创建异步引擎
    from alembic.runtime.environment import EnvironmentContext
    from sqlalchemy.ext.asyncio import async_engine_from_config

    connectable = async_engine_from_config(
        configuration,
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    def do_run_migrations(connection):
        context = EnvironmentContext(
            alembic_cfg,
            ScriptDirectory.from_config(alembic_cfg)
        )

        def upgrade(rev, context):
            # 自动升级到最新版本
            return context.script._upgrade_revs("head", rev)

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            fn=upgrade
        )

        with context.begin_transaction():
            context.run_migrations()

    try:
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)

        await connectable.dispose()
        logger.info("Migrations completed successfully")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise
```

**关键文件**：`backend/app/alembic_runner.py`

---

### 第 5 步：集成到 FastAPI 启动流程

修改 `backend/app/main.py`，添加 lifespan 上下文管理器：

**在文件顶部导入**：
```python
from contextlib import asynccontextmanager
from app.alembic_runner import run_migrations
import logging

logger = logging.getLogger(__name__)
```

**添加 lifespan 函数**（在 `app = FastAPI()` 之前）：
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    # Startup: Run migrations
    if os.getenv("RUN_MIGRATIONS_ON_STARTUP", "true").lower() == "true":
        logger.info("Running database migrations on startup...")
        try:
            await run_migrations()
            logger.info("Migrations completed successfully")
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

    yield

    # Shutdown: Cleanup if needed
    pass
```

**修改 FastAPI 初始化**（将第 14 行的 `app = FastAPI()` 替换为）：
```python
app = FastAPI(lifespan=lifespan)
```

**关键文件**：`backend/app/main.py` (line 14)

---

### 第 6 步：添加环境变量配置

创建 `backend/.env` 文件：

```env
# 数据库连接
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:54321/electric

# ElectricSQL 服务地址
ELECTRIC_URL=http://localhost:3000

# 是否在启动时自动运行迁移（可选，默认为 true）
# RUN_MIGRATIONS_ON_STARTUP=true
```

更新 `backend/app/db.py` 以加载 .env 文件（在文件顶部添加）：

```python
import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()
```

**关键文件**：`backend/app/db.py`

---

### 第 7 步：生成并应用初始迁移

确保 Docker 服务运行：

```bash
# 从项目根目录
docker-compose up -d
```

生成初始迁移：

```bash
cd backend
uv run alembic revision --autogenerate -m "Initial migration - create todos table"
```

检查生成的迁移文件（`migrations/versions/*.py`），确认包含：

```python
def upgrade() -> None:
    op.create_table(
        'todos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('text', sa.String(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('todos')
```

应用迁移：

```bash
uv run alembic upgrade head
```

验证：

```bash
# 查看当前版本
uv run alembic current

# 查看数据库表
docker exec -it electric_expo_db_quickstart-postgres-1 psql -U postgres -d electric -c "\dt"
```

---

### 第 8 步：测试自动迁移功能

**测试 autogenerate**：

修改 `app/models.py`，添加一个新字段：

```python
class Todo(SQLModel, table=True):
    # ... 现有字段
    priority: Optional[str] = Field(default="normal")  # 新字段
```

生成迁移：

```bash
cd backend
uv run alembic revision --autogenerate -m "Add priority field to todos"
```

应用迁移：

```bash
uv run alembic upgrade head
```

**测试启动时自动迁移**：

回滚迁移：

```bash
uv run alembic downgrade -1
```

启动 FastAPI 应用（应自动运行迁移）：

```bash
cd backend
uv run python -m app.main
```

观察日志输出，应包含：
```
INFO:     Running database migrations on startup...
INFO:     Migrations completed successfully
INFO:     Application startup complete.
```

---

## 需要创建/修改的文件

### 新建文件：

1. **`backend/app/alembic_runner.py`** - 自动迁移运行器
2. **`backend/.env`** - 环境变量配置
3. **`backend/migrations/env.py`** - Alembic 环境配置（由命令生成，需手动修改）
4. **`backend/migrations/versions/*.py`** - 迁移文件（由命令自动生成）

### 修改文件：

1. **`backend/pyproject.toml`** - 添加 `[tool.alembic]` 配置、Black 配置、开发依赖
2. **`backend/app/main.py`** - 添加 lifespan 上下文管理器
3. **`backend/app/db.py`** - 添加 dotenv 加载

---

## 日常使用命令

```bash
cd backend

# 生成迁移（基于模型变化）
uv run alembic revision --autogenerate -m "描述变更"

# 手动创建空迁移
uv run alembic revision -m "描述"

# 应用所有迁移
uv run alembic upgrade head

# 应用下一个迁移
uv run alembic upgrade +1

# 回滚一个版本
uv run alembic downgrade -1

# 回滚所有迁移
uv run alembic downgrade base

# 查看当前版本
uv run alembic current

# 查看迁移历史
uv run alembic history

# 检查是否有未生成的迁移
uv run alembic check
```

---

## 注意事项

1. **始终检查自动生成的迁移**：autogenerate 不是完美的，务必审查生成的文件
2. **使用描述性的迁移消息**：例如 "Add priority field to todos" 而不是 "update"
3. **测试 upgrade 和 downgrade**：确保可以回滚
4. **提交迁移文件到版本控制**：`git add migrations/versions/`
5. **生产环境备份数据库**：应用迁移前先备份
6. **环境变量优先级**：DATABASE_URL > pyproject.toml 配置
7. **可禁用自动迁移**：设置 `RUN_MIGRATIONS_ON_STARTUP=false`

---

## 故障排查

### 问题 1：Black 格式化失败

```bash
# 手动安装 Black
cd backend
uv add --dev black
```

### 问题 2：迁移文件未自动格式化

检查 `pyproject.toml` 中的 `[tool.alembic.post_write_hooks]` 配置是否正确

### 问题 3：启动时迁移失败

检查日志，确认：
- Docker 服务正在运行
- DATABASE_URL 环境变量正确
- 数据库连接正常

可临时禁用自动迁移：
```bash
export RUN_MIGRATIONS_ON_STARTUP=false
```

### 问题 4：autogenerate 生成空文件

确认：
- `migrations/env.py` 导入了所有模型
- `target_metadata = SQLModel.metadata`
- 数据库连接正确

---

## 验证清单

完成实施后，验证以下功能：

- [ ] `uv run alembic current` 显示当前版本
- [ ] `uv run alembic history` 显示迁移历史
- [ ] `uv run alembic check` 能检测模型变化
- [ ] 启动 FastAPI 时自动运行迁移（检查日志）
- [ ] 迁移文件自动被 Black 格式化
- [ ] 可以回滚迁移：`uv run alembic downgrade -1`
- [ ] 可以重新应用：`uv run alembic upgrade head`
- [ ] todos 表存在于 PostgreSQL 中
- [ ] 修改模型后，autogenerate 能正确生成迁移

---

## 相关文档

- **[Alembic 官方文档 - pyproject.toml 配置](https://alembic.sqlalchemy.org/en/latest/tutorial.html#editing-the-ini-file)**
- **[项目完整迁移指南](backend/docs/complete-migration-guide.md)**
