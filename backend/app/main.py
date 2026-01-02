import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from app.alembic_runner import run_migrations
from app.db import get_db
from app.models import Todo, TodoCreate, TodoUpdate, Diary, DiaryCreate, DiaryUpdate
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

logger = logging.getLogger(__name__)


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


# 初始化 App
app = FastAPI(lifespan=lifespan)

# 允许跨域 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ElectricSQL 服务地址
ELECTRIC_URL = os.getenv("ELECTRIC_URL", "http://localhost:3000")

# Electric 协议参数白名单 (与 TypeScript 版本保持一致)
ELECTRIC_PROTOCOL_QUERY_PARAMS = [
    "live",
    "live-sse",
    "handle",
    "offset",
    "live-cache-buster",
    "expired-handle",
    "log",
    "log-mode",
    "where",
    "limit",
    "order-by",
    "where-params",
    "cursor",
    "columns",
]

# === 辅助函数 ===


async def get_current_txid(session: AsyncSession) -> int:
    """获取 Postgres 当前事务 ID"""
    # 使用 pg_current_xact_id()::xid::text 以匹配 Electric 的流中的 txid
    result = await session.execute(text("SELECT pg_current_xact_id()::xid::text as txid"))
    row = result.first()
    if not row:
        raise Exception("Failed to get transaction ID")
    return int(row[0])


# === 路由定义 ===


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


# 1. 创建 Todo
@app.post("/api/todos", status_code=201)
async def create_todo(todo_in: TodoCreate, db: AsyncSession = Depends(get_db)):
    try:
        # 显式开启事务以确保获取准确的 txid
        async with db.begin():
            txid = await get_current_txid(db)

            # 创建数据模型
            new_todo = Todo(**todo_in.dict())
            db.add(new_todo)

            # 这里的 flush 会执行 insert 但不提交，以便获取 ID 和 default 值
            await db.flush()
            await db.refresh(new_todo)

            return {"todo": new_todo, "txid": txid}
            # 退出 with 块时自动 commit

    except Exception as e:
        print(f"Error creating todo: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to create todo", "details": str(e)},
        )


# 2. 更新 Todo
@app.put("/api/todos/{id}")
async def update_todo(id: int, todo_in: TodoUpdate, db: AsyncSession = Depends(get_db)):
    try:
        async with db.begin():
            txid = await get_current_txid(db)

            # 查询现有 Todo
            todo = await db.get(Todo, id)
            if not todo:
                raise HTTPException(status_code=404, detail="Todo not found")

            # 更新字段
            todo_data = todo_in.dict(exclude_unset=True)
            for key, value in todo_data.items():
                setattr(todo, key, value)

            # 手动更新 updated_at (虽然 DB 有 trigger，但显式更新能立即反映在返回值中)
            todo.updated_at = datetime.now(timezone.utc)

            db.add(todo)
            await db.flush()
            await db.refresh(todo)

            return {"todo": todo, "txid": txid}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating todo: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to update todo", "details": str(e)},
        )


# 3. 删除 Todo
@app.delete("/api/todos/{id}")
async def delete_todo(id: int, db: AsyncSession = Depends(get_db)):
    try:
        async with db.begin():
            txid = await get_current_txid(db)

            todo = await db.get(Todo, id)
            if not todo:
                raise HTTPException(status_code=404, detail="Todo not found")

            await db.delete(todo)

            return {"success": True, "txid": txid}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting todo: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to delete todo", "details": str(e)},
        )


# === Diary CRUD Endpoints ===

# 1. 创建 Diary
@app.post("/api/diaries", status_code=201)
async def create_diary(diary_in: DiaryCreate, db: AsyncSession = Depends(get_db)):
    try:
        async with db.begin():
            txid = await get_current_txid(db)

            new_diary = Diary(**diary_in.dict())
            db.add(new_diary)
            await db.flush()
            await db.refresh(new_diary)

            return {"diary": new_diary, "txid": txid}

    except Exception as e:
        print(f"Error creating diary: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to create diary", "details": str(e)},
        )


# 2. 更新 Diary
@app.put("/api/diaries/{id}")
async def update_diary(id: int, diary_in: DiaryUpdate, db: AsyncSession = Depends(get_db)):
    try:
        async with db.begin():
            txid = await get_current_txid(db)

            diary = await db.get(Diary, id)
            if not diary:
                raise HTTPException(status_code=404, detail="Diary not found")

            diary_data = diary_in.dict(exclude_unset=True)
            for key, value in diary_data.items():
                setattr(diary, key, value)

            diary.updated_at = datetime.now(timezone.utc)

            db.add(diary)
            await db.flush()
            await db.refresh(diary)

            return {"diary": diary, "txid": txid}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating diary: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to update diary", "details": str(e)},
        )


# 3. 删除 Diary
@app.delete("/api/diaries/{id}")
async def delete_diary(id: int, db: AsyncSession = Depends(get_db)):
    try:
        async with db.begin():
            txid = await get_current_txid(db)

            diary = await db.get(Diary, id)
            if not diary:
                raise HTTPException(status_code=404, detail="Diary not found")

            await db.delete(diary)

            return {"success": True, "txid": txid}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting diary: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to delete diary", "details": str(e)},
        )


# 4. Electric Shape 代理 (核心功能)
@app.get("/api/todos")
async def proxy_electric_shape(request: Request):
    """
    代理 Electric Shape 请求
    复制原始 TS 实现的行为：
    1. 只传递 Electric 协议参数
    2. 强制设置 table 参数
    3. 复制响应头（排除 content-encoding 和 content-length）
    4. 流式传输响应
    """
    electric_shape_url = f"{ELECTRIC_URL}/v1/shape"

    # 构造查询参数
    params = {}
    for key, value in request.query_params.items():
        if key in ELECTRIC_PROTOCOL_QUERY_PARAMS:
            params[key] = value

    # 强制指定 table
    params["table"] = "todos"

    try:
        # 创建 HTTP 客户端，设置更长的超时时间
        client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))

        try:
            # 发起流式请求
            req = client.build_request("GET", electric_shape_url, params=params)
            response = await client.send(req, stream=True)

            # 复制响应头（排除 content-encoding 和 content-length）
            headers = {}
            for key, value in response.headers.items():
                if key.lower() not in ["content-encoding", "content-length"]:
                    headers[key] = value

            # 对于所有状态码（包括 409 Conflict），都原样传递响应给客户端
            # 客户端需要根据状态码来处理 handle 过期等情况
            async def stream_generator():
                try:
                    async for chunk in response.aiter_bytes():
                        yield chunk
                except Exception as e:
                    print(f"Proxy stream error: {e}")
                    raise
                finally:
                    await response.aclose()
                    await client.aclose()

            return StreamingResponse(
                stream_generator(), status_code=response.status_code, headers=headers
            )

        except Exception as e:
            await client.aclose()
            raise

    except HTTPException:
        raise
    except Exception as e:
        print(f"Proxy error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Internal server error", "details": str(e)},
        )


# 5. Electric Shape 代理 for Diaries
@app.get("/api/diaries")
async def proxy_electric_shape_diaries(request: Request):
    """代理 Electric Shape 请求 for Diaries table"""
    electric_shape_url = f"{ELECTRIC_URL}/v1/shape"

    # 构造查询参数
    params = {}
    for key, value in request.query_params.items():
        if key in ELECTRIC_PROTOCOL_QUERY_PARAMS:
            params[key] = value

    # 强制指定 table
    params["table"] = "diaries"

    try:
        client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))

        try:
            req = client.build_request("GET", electric_shape_url, params=params)
            response = await client.send(req, stream=True)

            headers = {}
            for key, value in response.headers.items():
                if key.lower() not in ["content-encoding", "content-length"]:
                    headers[key] = value

            async def stream_generator():
                try:
                    async for chunk in response.aiter_bytes():
                        yield chunk
                except Exception as e:
                    print(f"Proxy stream error: {e}")
                    raise
                finally:
                    await response.aclose()
                    await client.aclose()

            return StreamingResponse(
                stream_generator(), status_code=response.status_code, headers=headers
            )

        except Exception as e:
            await client.aclose()
            raise

    except HTTPException:
        raise
    except Exception as e:
        print(f"Proxy error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Internal server error", "details": str(e)},
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=3001, reload=True)
