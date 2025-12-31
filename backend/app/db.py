import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

# 加载 .env 文件
load_dotenv()

# 使用 asyncpg 驱动 (注意：postgres:// 需要改为 postgresql+asyncpg://)
# 原连接串: postgres://postgres:password@localhost:54321/electric
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:54321/electric"
)

# 创建异步引擎
engine = create_async_engine(DATABASE_URL, echo=False, future=True)

# 创建 Session 工厂
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# 依赖注入函数 (Dependency)
async def get_db():
    async with async_session() as session:
        yield session
