from datetime import datetime
from typing import Optional

from sqlmodel import Column, DateTime, Field, SQLModel, func


# === 数据库表定义 (Table Schema) ===
class Todo(SQLModel, table=True):
    __tablename__ = "todos"

    id: Optional[int] = Field(default=None, primary_key=True)
    text: str = Field(nullable=False)
    completed: bool = Field(default=False, nullable=False)

    # 使用 sa_column 直接映射 Postgres 的 timestamp with time zone 和 defaultNow()
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), nullable=False
        ),
    )

    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),  # 自动更新时间
            nullable=False,
        ),
    )


# === Pydantic 模型 (用于请求体校验) ===
# 对应 validateInsertTodo: 只接收 text
class TodoCreate(SQLModel):
    text: str


# 对应 validateUpdateTodo: 接收部分字段更新
class TodoUpdate(SQLModel):
    text: Optional[str] = None
    completed: Optional[bool] = None
