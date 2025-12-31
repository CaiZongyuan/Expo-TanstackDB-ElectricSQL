# Alembic 数据库迁移完整指南

> 新手友好的 Alembic 数据库迁移教程 - 从零开始到熟练使用

本教程基于 Alembic 官方文档编写，结合项目实际情况，提供从基础到高级的完整指南。

---

## 📋 目录

- [快速开始](#快速开始)
- [Alembic 基础概念](#alembic-基础概念)
- [首次设置](#首次设置)
- [日常使用](#日常使用)
- [自动生成迁移详解](#自动生成迁移详解)
- [高级配置](#高级配置)
- [常见问题](#常见问题)
- [最佳实践](#最佳实践)
- [常用命令速查](#常用命令速查)

---

## ⚡ 快速开始

### 一键复制命令（首次设置）

```bash
# 1. 启动数据库
docker-compose up -d

# 2. 初始化 Alembic
cd backend
uv run alembic init migrations

# 3. 配置文件（需要手动编辑，见下方详细步骤）
# - alembic.ini: 修改数据库连接
# - migrations/env.py: 导入模型和配置异步

# 4. 生成迁移
uv run alembic revision --autogenerate -m "Initial migration"

# 5. 应用迁移
uv run alembic upgrade head
```

### 日常使用命令

```bash
# 修改模型后，生成并应用迁移
cd backend
uv run alembic revision --autogenerate -m "描述变更"
uv run alembic upgrade head

# 查看当前版本
uv run alembic current

# 查看迁移历史
uv run alembic history
```

---

## 📚 Alembic 基础概念

### 什么是迁移环境？

Alembic 的使用从创建**迁移环境**开始。这是一个特定于应用程序的脚本目录，只需创建一次，然后与应用程序的源代码一起维护。

### 迁移环境目录结构

```
backend/
├── alembic.ini           # Alembic 主配置文件
├── pyproject.toml        # 现代 Python 项目配置文件
└── migrations/           # 迁移环境目录（可自定义名称）
    ├── env.py           # 每次运行迁移时执行的 Python 脚本
    ├── README           # 说明文件
    ├── script.py.mako   # 生成新迁移文件的 Mako 模板
    └── versions/        # 存放迁移脚本的目录
        ├── 3512b954651e_add_account.py
        ├── 2b1ae634e5cd_add_order_id.py
        └── 3adcc9a56557_rename_username_field.py
```

### 各文件说明

| 文件/目录 | 说明 |
|-----------|------|
| `alembic.ini` | Alembic 的主配置文件，包含数据库 URL、脚本位置等配置 |
| `migrations/env.py` | 运行迁移时执行的脚本，负责配置数据库连接和迁移引擎 |
| `migrations/script.py.mako` | Mako 模板文件，用于生成新的迁移脚本 |
| `migrations/versions/` | 存放具体迁移脚本的目录 |

---

## 🎯 首次设置

### 第一步：启动数据库

在**项目根目录**打开终端，运行：

```bash
docker-compose up -d
```

✅ 这会启动 PostgreSQL 和 Electric SQL 服务

**验证服务运行**：
```bash
docker-compose ps
```

---

### 第二步：初始化 Alembic

进入 `backend` 目录：

```bash
cd backend
uv run alembic init migrations
```

✅ 这会创建：
- `migrations/` 目录
- `migrations/env.py` - 环境配置文件
- `migrations/script.py.mako` - 迁移模板
- `migrations/versions/` - 迁移脚本目录
- `alembic.ini` - Alembic 配置文件

### 使用不同模板

Alembic 提供多种环境模板：

```bash
# 查看可用模板
uv run alembic list_templates
```

可用模板：

| 模板 | 说明 |
|------|------|
| `generic` | 通用单数据库配置（默认） |
| `pyproject` | 符合 PEP-621 的配置，使用 pyproject.toml |
| `async` | 支持异步数据库的通用配置 |
| `multidb` | 多数据库配置 |

使用特定模板创建：

```bash
# 使用 async 模板（本项目推荐）
uv run alembic init --template async migrations
```

---

### 第三步：配置数据库连接

打开 `backend/alembic.ini`，找到 `sqlalchemy.url` 配置：

```ini
# 默认配置
sqlalchemy.url = driver://user:pass@localhost/dbname
```

**替换为项目配置**：

```ini
sqlalchemy.url = postgresql+asyncpg://postgres:password@localhost:54321/electric
```

💡 **提示**：这是连接本地 Docker 数据库的地址

#### 数据库 URL 格式说明

**PostgreSQL 示例：**

```ini
# 基本格式
postgresql://scott:tiger@localhost:5432/mydb

# 使用 asyncpg 驱动（异步）
postgresql+asyncpg://scott:tiger@localhost:5432/mydb

# 使用 psycopg2 驱动（同步）
postgresql+psycopg2://scott:tiger@localhost:5432/mydb
```

#### 特殊字符转义

如果密码中包含特殊字符（如 `%`、`@`），需要进行双重转义：

1. **URL 转义**（SQLAlchemy 要求）：
   - `%` → `%25`
   - `@` → `%40`

2. **ConfigParser 转义**（alembic.ini 要求）：
   - 将 `%` 替换为 `%%`

**示例：** 密码为 `P@ssw%rd`

```python
# Python 中生成正确转义的 URL
import urllib.parse

password = "P@ssw%rd"
# 第一步：URL 转义
url_escaped = urllib.parse.quote_plus(password)
# 结果：P%40ssw%25rd

# 第二步：ConfigParser 转义
config_escaped = url_escaped.replace("%", "%%")
# 结果：P%%40ssw%%25rd

# 最终配置
# sqlalchemy.url = postgresql://scott:P%%40ssw%%25rd@localhost:5432/mydb
```

---

### 第四步：配置模型导入

打开 `backend/migrations/env.py`，找到 `target_metadata` 配置：

```python
# 原始内容
# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = None
```

**替换为**：

```python
# 导入项目路径
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 导入 SQLModel 和所有模型
from sqlmodel import SQLModel
from app.models import Todo  # 如果有更多模型，都要导入

# 设置元数据
target_metadata = SQLModel.metadata
```

💡 **为什么要这样做？**
根据 [Alembic 官方文档](https://alembic.sqlalchemy.org/en/latest/autogenerate.html)，Alembic 需要访问您的模型元数据才能自动检测变化。

---

### 第五步：配置异步支持

在同一个 `env.py` 文件中，找到 `run_migrations_online()` 函数，**完整替换为**：

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

然后找到文件**最后几行**的调用部分：

```python
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**替换为**：

```python
if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_migrations_online())
```

---

### 第六步：生成初始迁移

```bash
uv run alembic revision --autogenerate -m "Initial migration"
```

✅ 这会在 `migrations/versions/` 生成一个迁移文件

**Alembic 自动检测的内容**：

| 类型 | 说明 |
|------|------|
| ✅ **完全支持** | 表的添加/删除、列的添加/删除、列的可空状态变化、索引和外键约束的基本变化 |
| ⚠️ **可选检测** | 列类型变化（默认启用）、服务器默认值变化（需配置） |
| ❌ **无法检测** | 表名/列名重命名、约束重命名、匿名约束变化 |

---

### 第七步：检查生成的迁移

打开 `migrations/versions/xxxx_initial_migration.py`，确认包含创建表的代码：

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
    # 创建 todos 表
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
    # 删除 todos 表
    op.drop_table('todos')
```

⚠️ **重要**：始终检查自动生成的代码是否正确！Alembic 不是完美的。

**常用迁移操作**：

| 操作 | 说明 |
|------|------|
| `op.create_table()` | 创建表 |
| `op.drop_table()` | 删除表 |
| `op.add_column()` | 添加列 |
| `op.drop_column()` | 删除列 |
| `op.alter_column()` | 修改列 |
| `op.create_index()` | 创建索引 |
| `op.drop_index()` | 删除索引 |
| `op.create_foreign_key()` | 创建外键 |
| `op.drop_foreign_key()` | 删除外键 |

---

### 第八步：应用迁移

```bash
uv run alembic upgrade head
```

✅ 这会在数据库中创建表

**预期输出**：

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> xxxx, Initial migration
```

**升级选项**：

```bash
# 升级到最新版本
uv run alembic upgrade head

# 升级到指定版本（使用完整版本号）
uv run alembic upgrade 1975ea83b712

# 升级到指定版本（使用部分版本号，只要唯一即可）
uv run alembic upgrade 1975

# 相对升级（前进 N 个版本）
uv run alembic upgrade +2
```

---

### 第九步：验证

```bash
# 查看当前迁移版本
uv run alembic current

# 查看数据库表
docker exec -it electric_expo_db_quickstart-postgres-1 psql -U postgres -d electric -c "\dt"

# 查看 todos 表结构
docker exec -it electric_expo_db_quickstart-postgres-1 psql -U postgres -d electric -c "\d todos"
```

🎉 **完成！** 数据库已初始化

---

## 🔄 日常使用

### 修改模型后如何更新数据库？

#### 1. 修改模型

例如在 `app/models.py` 中添加新字段：

```python
class Todo(SQLModel, table=True):
    # ... 现有字段
    priority: Optional[str] = Field(default="normal")  # 新字段
```

#### 2. 生成迁移

```bash
cd backend
uv run alembic revision --autogenerate -m "Add priority field to todos"
```

#### 3. 检查生成的迁移

打开新生成的文件，确认变更正确：

```python
def upgrade() -> None:
    op.add_column('todos', sa.Column('priority', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('todos', 'priority')
```

#### 4. 应用迁移

```bash
uv run alembic upgrade head
```

✅ 数据库已更新！

---

### 回滚迁移

```bash
# 回滚一个版本
uv run alembic downgrade -1

# 回滚到特定版本
uv run alembic downgrade <revision_id>

# 回滚所有迁移
uv run alembic downgrade base

# 相对降级
uv run alembic downgrade -2
```

**降级内部流程**：
1. 检查数据库中 `alembic_version` 表的当前版本
2. 计算从当前版本到目标版本的降级路径
3. 依次执行每个迁移文件的 `downgrade()` 方法

---

### 查看迁移信息

```bash
# 查看当前版本
uv run alembic current

# 查看所有迁移
uv run alembic history

# 查看详细历史
uv run alembic history --verbose

# 查看历史范围
uv run alembic history -r1975ea:ae1027  # 从 1975ea 到 ae1027
uv run alembic history -r-3:current      # 最近 3 个版本到当前
uv run alembic history -r1975ea:        # 从 1975ea 到最新

# 查看所有分支
uv run alembic branches

# 查看所有头版本
uv run alembic heads
```

**输出示例**：

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
Current revision for postgresql://scott:XXXXX@localhost/test: 1975ea83b712 -> ae1027a6acf (head), Add a column
```

---

### 手动创建迁移

有时需要手动编写迁移（例如数据迁移、复杂变更）：

```bash
# 创建空迁移文件
uv run alembic revision -m "Custom data migration"
```

然后手动编辑生成的文件：

```python
def upgrade() -> None:
    # 执行数据迁移
    from sqlalchemy import table, column
    todos = table('todos',
        column('id', sa.Integer()),
        column('text', sa.String())
    )

    # 批量更新数据
    connection.execute(
        todos.update()
        .where(todos.c.id == 1)
        .values(text='Updated text')
    )

def downgrade() -> None:
    # 回滚数据迁移
    pass
```

---

## 🔍 自动生成迁移详解

### 检查是否有新的迁移

使用 `alembic check` 命令（不生成实际文件）：

```bash
uv run alembic check
```

**有变化时**：

```
FAILED: New upgrade operations detected: [
  ('add_column', None, 'my_table', Column('data', String(), table=<my_table>)),
  ('add_column', None, 'my_table', Column('newcol', Integer(), table=<my_table>))]
```

**无变化时**：

```
No new upgrade operations detected.
```

---

### 自动生成可以检测的变化

| 类型 | 说明 |
|------|------|
| ✅ 表的添加/删除 | 完全支持 |
| ✅ 列的添加/删除 | 完全支持 |
| ✅ 列的可空状态变化 | 完全支持 |
| ✅ 索引和唯一约束的基本变化 | 完全支持 |
| ✅ 外键约束的基本变化 | 完全支持 |
| ⚠️ 列类型变化 | 默认启用，可通过 `compare_type` 控制 |
| ⚠️ 服务器默认值变化 | 需设置 `compare_server_default=True` |

---

### 自动生成无法检测的变化

| 类型 | 说明 |
|------|------|
| ❌ 表名重命名 | 会检测为删除旧表 + 创建新表 |
| ❌ 列名重命名 | 会检测为删除旧列 + 添加新列 |
| ❌ 匿名约束 | 需要给约束命名 |
| ❌ 特殊 SQLAlchemy 类型 | 如 `Enum` 在不支持它的数据库上 |
| ❌ 某些独立约束 | PRIMARY KEY、EXCLUDE、CHECK 等 |

**解决方案**：

**方法 1**：手动编辑自动生成的迁移文件

```python
def upgrade() -> None:
    # 重命名列（Alembic 会生成删除+添加，需要手动改为重命名）
    op.alter_column('todos', 'old_name', new_column_name='new_name')
```

**方法 2**：创建自定义迁移

```bash
uv run alembic revision -m "Rename column"
# 然后手动编写迁移代码
```

---

### 控制自动生成行为

#### 配置类型比较

**禁用类型比较**：

```python
# 在 migrations/env.py 中
context.configure(
    # ...
    compare_type = False
)
```

**自定义类型比较函数**：

```python
def my_compare_type(context, inspected_column,
                    metadata_column, inspected_type, metadata_type):
    # 返回 False 表示类型相同
    # 返回 None 表示使用默认比较逻辑
    # 返回 True 表示类型不同，需要生成迁移
    return None

context.configure(
    # ...
    compare_type = my_compare_type
)
```

#### 过滤特定对象

**过滤特定 schema**：

```python
def include_name(name, type_, parent_names):
    if type_ == "schema":
        # 只包含这些 schema
        return name in [None, "schema_one", "schema_two"]
    else:
        return True

context.configure(
    # ...
    include_schemas = True,
    include_name = include_name
)
```

**过滤特定表**：

```python
target_metadata = MyModel.metadata

def include_name(name, type_, parent_names):
    if type_ == "table":
        # 只包含模型中定义的表
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

**基于对象的过滤**：

```python
def include_object(object, name, type_, reflected, compare_to):
    # 跳过带有 skip_autogenerate 标记的列
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

**使用示例**：

```python
# 在模型中标记要跳过的列
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String)
    # 这个列不会被 autogenerate 检测
    temp_field = Column(String, info={"skip_autogenerate": True})
```

---

### 使用多个 MetaData

```python
from myapp.mymodel1 import Model1Base
from myapp.mymodel2 import Model2Base

# 使用列表
target_metadata = [Model1Base.metadata, Model2Base.metadata]
```

---

## ⚙️ 高级配置

### 使用 pyproject.toml 配置

从 Alembic 1.16.0 开始，可以使用 `pyproject.toml` 进行配置：

```bash
# 使用 pyproject 模板初始化
uv run alembic init --template pyproject migrations
```

**pyproject.toml 配置示例**：

```toml
[tool.alembic]
# 迁移脚本路径
script_location = "%(here)s/migrations"

# 文件命名模板
# file_template = %%(year)d_%%(month).2d_%%(day).2d_%%(hour).2d%%(minute).2d-%%(rev)s_%%(slug)s

# 额外的 sys.path
prepend_sys_path = [
    "."
]

# 时区
# timezone = UTC

# 版本文件位置
# version_locations = [
#     "%(here)s/migrations/versions",
# ]

# 递归搜索版本文件
# recursive_version_locations = false

# 输出编码
output_encoding = "utf-8"
```

---

### 配置代码格式化

**使用 Black 格式化生成的迁移文件**：

在 `alembic.ini` 中配置：

```ini
[post_write_hooks]
# 格式化代码
hooks = black

black.type = console_scripts
black.entrypoint = black
black.options = -l 79 REVISION_SCRIPT_FILENAME
```

在 `pyproject.toml` 中配置：

```toml
[[tool.alembic.post_write_hooks]]
name = "black"
type = "console_scripts"
entrypoint = "black"
options = "-l 79 REVISION_SCRIPT_FILENAME"
```

**使用多个工具（Black + zimports）**：

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

**使用 pre-commit**：

```ini
[post_write_hooks]
hooks = pre-commit

pre-commit.type = console_scripts
pre-commit.entrypoint = pre-commit
pre-commit.options = run --files REVISION_SCRIPT_FILENAME
pre-commit.cwd = %(here)s
```

---

### 自定义后处理钩子

编写 Python 函数作为钩子：

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

在 `alembic.ini` 中使用：

```ini
[alembic]
revision_environment = true

[post_write_hooks]
hooks = spaces_to_tabs
spaces_to_tabs.type = spaces_to_tabs
```

---

### 配置迁移文件命名

在 `alembic.ini` 中自定义文件命名模板：

```ini
# 使用日期时间前缀
file_template = %%(year)d_%%(month).2d_%%(day).2d_%%(hour).2d%%(minute).2d-%%(rev)s_%%(slug)s

# 或使用日期子目录组织（需要 recursive_version_locations = true）
file_template = %%(year)d/%%(month).2d/%%(day).2d_%%(hour).2d%%(minute).2d_%%(second).2d_%%(rev)s_%%(slug)s
```

**占位符说明**：

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `%(year)d` | 4 位年份 | 2024 |
| `%(month).2d` | 2 位月份 | 01 |
| `%(day).2d` | 2 位日期 | 15 |
| `%(hour).2d` | 2 位小时 | 13 |
| `%(minute).2d` | 2 位分钟 | 45 |
| `%(rev)s` | 修订 ID | 1975ea83b712 |
| `%(slug)s` | 消息的简短版本 | create_account_table |
| `%(table)s` | 表名（如果自动生成） | todos |

---

## ❓ 常见问题

### Q1: 运行迁移时报错 "No module named 'app'"

**原因**：不在正确的目录下运行命令

**解决方案**：确保在 `backend` 目录下运行

```bash
cd backend
uv run alembic upgrade head
```

**或**：检查 `migrations/env.py` 中的 `sys.path` 配置是否正确

---

### Q2: 生成的迁移文件是空的

**原因**：Alembic 没有检测到模型变化

**解决方案**：
1. ✅ 确认 `env.py` 导入了所有模型
2. ✅ 确认 `target_metadata = SQLModel.metadata`
3. ✅ 确认数据库连接正确
4. ✅ 如果表已存在且没有变化，Alembic 不会生成迁移

---

### Q3: 数据库连接失败

**检查清单**：
- ✅ Docker 容器运行中：`docker-compose ps`
- ✅ 端口正确：`54321`
- ✅ 连接字符串：`postgresql+asyncpg://postgres:password@localhost:54321/electric`
- ✅ 数据库名称：`electric`

**测试连接**：

```bash
docker exec -it electric_expo_db_quickstart-postgres-1 psql -U postgres -d electric -c "SELECT 1"
```

---

### Q4: 迁移应用失败，如何回滚？

```bash
# 查看当前版本
uv run alembic current

# 回滚到上一个版本
uv run alembic downgrade -1

# 如果需要，删除失败的迁移文件
rm migrations/versions/xxxx_failed_migration.py
```

---

### Q5: 如何在生产环境应用迁移？

⚠️ **生产环境最佳实践**：

1. **备份数据库**（必须！）
```bash
pg_dump -U postgres -d electric > backup_$(date +%Y%m%d).sql
```

2. **在测试环境先测试迁移**

3. **检查迁移内容**
```bash
uv run alembic upgrade head --sql > migration.sql
# 审查 migration.sql 文件
```

4. **应用迁移**
```bash
uv run alembic upgrade head
```

5. **验证数据**

---

### Q6: Alembic 检测到了不应检测的变化

**问题**：autogenerate 生成了一些不需要的迁移

**解决方案**：

1. **使用 `include_object` 过滤**
```python
def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        # 只包含特定表
        return name == "todos"
    return True
```

2. **使用 `include_name` 过滤**
```python
def include_name(name, type_, parent_names):
    if type_ == "column":
        # 排除特定列
        return name != "temp_column"
    return True
```

---

### Q7: 如何处理数据迁移？

**场景**：需要在迁移中修改数据，而不是修改表结构

**解决方案**：使用批量操作

```python
from sqlalchemy import table, column

def upgrade() -> None:
    # 定义临时表结构
    todos = table('todos',
        column('id', sa.Integer()),
        column('text', sa.String()),
        column('completed', sa.Boolean())
    )

    # 批量更新
    connection.execute(
        todos.update()
        .where(todos.c.completed == None)
        .values(completed=False)
    )

def downgrade() -> None:
    # 回滚数据变更
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

## 💡 最佳实践

### 1. ✅ 始终检查自动生成的迁移

根据 Alembic 官方文档：

> "It is always necessary to manually review and correct the candidate migrations that autogenerate produces."

自动生成不是完美的，务必手动审查！

---

### 2. ✅ 使用描述性的迁移消息

**好的示例**：
```bash
uv run alembic revision --autogenerate -m "Add priority and due_date to todos"
```

**不好的示例**：
```bash
uv run alembic revision --autogenerate -m "update"
uv run alembic revision --autogenerate -m "fix"
```

---

### 3. ✅ 命名约束

始终给约束命名，便于自动生成检测：

```python
# ❌ 不好：匿名约束
UniqueConstraint('col1', 'col2')

# ✅ 好：命名约束
UniqueConstraint('col1', 'col2', name="uq_col1_col2")

# ✅ 好：命名外键
ForeignKeyConstraint(['user_id'], ['users.id'], name="fk_todos_user_id")
```

---

### 4. ✅ 在应用迁移前备份数据库

特别是在生产环境，始终先备份！

---

### 5. ✅ 测试迁移的 upgrade 和 downgrade

确保可以回滚：

```bash
# 应用迁移
uv run alembic upgrade head

# 测试回滚
uv run alembic downgrade -1

# 重新应用
uv run alembic upgrade head
```

---

### 6. ✅ 提交迁移文件到版本控制

```bash
git add migrations/versions/
git commit -m "Add migration: Add priority field to todos"
```

---

### 7. ✅ 一次只做一件事

不要在一个迁移中混合多个不相关的变更。每个迁移应该是一个独立的、可回滚的单元。

**❌ 不好**：
```bash
uv run alembic revision --autogenerate -m "Add priority field and rename status column"
```

**✅ 好**：
```bash
uv run alembic revision --autogenerate -m "Add priority field to todos"
uv run alembic revision --autogenerate -m "Rename status to completed"
```

---

### 8. ✅ 使用相对版本标识

便于在脚本中引用：

```bash
# 应用下一个迁移
uv run alembic upgrade +1

# 回滚两个迁移
uv run alembic downgrade -2
```

---

### 9. ✅ 配置代码格式化

保持迁移文件风格一致：

```ini
[post_write_hooks]
hooks = black
black.type = console_scripts
black.entrypoint = black
black.options = -l 79 REVISION_SCRIPT_FILENAME
```

---

### 10. ✅ 使用 alembic check

在 CI/CD 中集成，确保迁移同步：

```yaml
# .github/workflows/ci.yml
- name: Check for pending migrations
  run: uv run alembic check
```

---

### 11. ✅ 定期清理旧迁移

避免版本文件过多影响启动性能。可以考虑：
- 使用日期子目录组织迁移
- 定期合并旧的迁移（需要谨慎）

---

## 📚 常用命令速查

### 迁移生成

```bash
uv run alembic revision --autogenerate -m "描述"  # 自动生成迁移
uv run alembic revision -m "描述"                # 手动创建空迁移
uv run alembic list_templates                     # 查看可用模板
```

### 迁移应用

```bash
uv run alembic upgrade head                      # 应用所有迁移
uv run alembic upgrade +1                        # 应用下一个迁移
uv run alembic upgrade <revision>                # 应用到特定版本
```

### 迁移回滚

```bash
uv run alembic downgrade -1                      # 回滚一个版本
uv run alembic downgrade base                    # 回滚所有迁移
uv run alembic downgrade <revision>              # 回滚到特定版本
```

### 查看状态

```bash
uv run alembic current                           # 查看当前版本
uv run alembic history                           # 查看迁移历史
uv run alembic history --verbose                 # 查看详细历史
uv run alembic history -r1975ea:ae1027          # 查看历史范围
uv run alembic heads                             # 查看所有头版本
uv run alembic branches                           # 查看所有分支
```

### 其他

```bash
uv run alembic upgrade head --sql                # 生成 SQL 而不执行
uv run alembic check                             # 检查是否有未应用的迁移
```

---

## 🔗 相关资源

### 官方文档
- **[Alembic 官方文档](https://alembic.sqlalchemy.org/)** - 完整的 Alembic 文档
- **[Alembic 自动生成](https://alembic.sqlalchemy.org/en/latest/autogenerate.html)** - 自动生成详细说明
- **[SQLAlchemy 文档](https://docs.sqlalchemy.org/)** - SQLAlchemy ORM 文档
- **[SQLModel 文档](https://sqlmodel.tiangolo.com/)** - SQLModel ORM 文档
- **[FastAPI 文档](https://fastapi.tiangolo.com/)** - FastAPI 框架文档

### 项目相关
- **[本项目的 backend/app/models.py](../app/models.py)** - 模型定义
- **[本项目的 backend/migrations/](../migrations/)** - 迁移环境

---

## 🛠️ 技术栈

- **FastAPI** - 现代 Python Web 框架
- **SQLModel** - SQL 数据库的 Python ORM
- **Alembic** - 数据库迁移工具
- **PostgreSQL** - 关系型数据库
- **Electric SQL** - 实时数据同步
- **asyncpg** - 异步 PostgreSQL 驱动

---

**祝您使用愉快！** 🎉

如有问题，请查看 [常见问题](#常见问题) 或参考 [Alembic 官方文档](https://alembic.sqlalchemy.org/)。
