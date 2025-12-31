"""Auto-run Alembic migrations on FastAPI startup."""

import logging
import os
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import pool

logger = logging.getLogger(__name__)

# 从环境变量读取配置
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:54321/electric"
)

# 是否在启动时自动运行迁移（可通过环境变量关闭）
RUN_MIGRATIONS_ON_STARTUP = (
    os.getenv("RUN_MIGRATIONS_ON_STARTUP", "true").lower() == "true"
)


async def run_migrations():
    """Run Alembic migrations programmatically."""
    if not RUN_MIGRATIONS_ON_STARTUP:
        logger.info("Auto-migration disabled by environment variable")
        return

    logger.info("Running database migrations...")

    # 获取 migrations 目录路径
    backend_dir = Path(__file__).parent.parent
    # 使用 alembic.ini 而不是 pyproject.toml 以避免 Windows 编码问题
    alembic_ini = backend_dir / "alembic.ini"

    # 创建 Alembic 配置
    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))

    # 从环境变量读取数据库 URL
    configuration = {"sqlalchemy.url": DATABASE_URL}

    # 导入 target_metadata
    import sys

    sys.path.insert(0, str(backend_dir))
    from sqlmodel import SQLModel

    target_metadata = SQLModel.metadata

    # 创建异步引擎
    from alembic.runtime.environment import EnvironmentContext
    from sqlalchemy.ext.asyncio import async_engine_from_config

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    def do_run_migrations(connection):
        context = EnvironmentContext(
            alembic_cfg, ScriptDirectory.from_config(alembic_cfg)
        )

        def upgrade(rev, context):
            # 自动升级到最新版本
            return context.script._upgrade_revs("head", rev)

        context.configure(
            connection=connection, target_metadata=target_metadata, fn=upgrade
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
