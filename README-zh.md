# Expo + TanStack DB + ElectricSQL 待办事项应用

**[English](README.md) | 中文**

一个基于 Expo React Native 构建的实时待办事项应用，展示了如何使用 [TanStack DB](https://tanstack.com/db/latest) 和 [ElectricSQL](https://electric-sql.com/) 实现跨设备的无缝数据同步。

## 功能特性

- **实时同步**：使用 ElectricSQL 基于 shape 的复制技术自动同步数据
- **离线优先**：本地数据库，连接恢复后自动同步
- **TanStack DB 集合**：类型安全的数据管理与实时查询
- **富文本编辑器**：基于 `@10play/tentap-editor` 构建，支持日记/日志记录
- **跨平台**：支持 iOS、Android 和 Web

## 技术栈

### 前端
- **Expo SDK 54** - React Native 开发框架
- **TanStack DB** - 本地优先数据库，支持集合操作
- **ElectricSQL** - Postgres 到应用的数据同步
- **Drizzle ORM** - TypeScript ORM，用于模式定义
- **React Navigation** - 标签页导航

### 后端
- **FastAPI** - Python 异步 Web 框架
- **SQLModel** - Pydantic + SQLAlchemy 数据库模型
- **PostgreSQL** - 主数据库

### 基础设施
- **Docker Compose** - PostgreSQL 和 ElectricSQL 服务
- **ElectricSQL** - 实时数据复制服务

## 前置要求

- **Node.js** 18+ 和 [Bun](https://bun.sh)
- **Python** 3.12+ 和 [uv](https://github.com/astral-sh/uv)
- **Docker** 和 Docker Compose
- **Expo CLI** (`bunx expo install`)

## 快速开始

### 1. 克隆仓库

```bash
git clone <repository-url>
cd Expo-TanstackDB-ElectricSQL
```

### 2. 环境配置

复制环境变量模板并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接信息：

```env
DB_HOST=localhost
DB_PORT=54321
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=electric
```

### 3. 启动基础设施服务

启动 PostgreSQL 和 ElectricSQL：

```bash
docker compose up -d
```

验证服务是否正常运行：

```bash
docker compose ps
```

### 4. 数据库迁移（首次设置）

如果是首次设置项目，需要初始化并运行数据库迁移：

```bash
cd backend

# 安装依赖
uv sync

# 生成初始迁移（创建 todos 表）
uv run alembic revision --autogenerate -m "Initial migration"

# 应用迁移到数据库
uv run alembic upgrade head
```

**注意**：后端会在启动时自动运行待处理的迁移，因此只需在开发期间手动运行迁移。

### 5. 启动后端 API

```bash
cd backend
uv sync
uv run python -m app.main
```

后端服务将运行在 `http://localhost:3001`

### 6. 安装前端依赖

```bash
bun install
```

### 7. 启动 Expo 开发服务器

```bash
bunx expo start
```

按下以下按键运行到你想要的平台：
- `a` - Android 模拟器
- `i` - iOS 模拟器
- `w` - Web 浏览器

## 项目结构

```
├── backend/                  # Python FastAPI 后端
│   ├── app/
│   │   ├── alembic_runner.py  # 启动时自动迁移
│   │   ├── main.py            # FastAPI 应用和路由
│   │   ├── models.py          # SQLModel 模型
│   │   └── db.py              # 数据库连接
│   ├── migrations/            # Alembic 数据库迁移
│   │   ├── versions/          # 迁移文件（自动生成）
│   │   ├── env.py             # 迁移环境（异步支持）
│   │   └── script.py.mako     # 迁移模板
│   ├── alembic.ini            # Alembic 配置（数据库 URL）
│   └── pyproject.toml         # Python 依赖和 Alembic 配置
├── src/
│   ├── app/(tabs)/
│   │   ├── _layout.tsx      # 标签页导航布局
│   │   └── todo.tsx         # Todo 页面（含 TanStack 集合）
│   ├── components/          # React Native 组件
│   │   ├── tentap-editor.tsx
│   │   └── glass-toolbar.tsx
│   ├── db/
│   │   └── schema.ts        # Drizzle ORM 模式
│   └── utils/
│       └── api-client.ts    # 后端 API 客户端
├── docker-compose.yml       # PostgreSQL + ElectricSQL
├── .env.example             # 环境变量模板
└── package.json
```

## 工作原理

### 数据流

1. **前端**通过 TanStack DB 集合创建/更新/删除待办事项
2. **API 客户端**将变更发送到 FastAPI 后端
3. **后端**写入 PostgreSQL 并返回事务 ID
4. **ElectricSQL** 通过 WAL 复制捕获变更
5. **Shape 流**将更新推送到所有连接的客户端

### TanStack 集合

`src/app/(tabs)/todo.tsx` 中的 `todoCollection` 使用：
- **Shape URL**：`http://${hostname}:3001/api/todos` 用于实时更新
- **变更处理器**：通过后端 API 进行插入/更新/删除操作
- **时间戳解析器**：将 ISO 字符串转换为 Date 对象

## 架构详情

### TanStack DB + ElectricSQL 集成

**前端模式（`src/db/schema.ts`）：**
- Drizzle ORM 定义 `todos` 表模式
- Zod 验证模式：`selectTodoSchema`、`insertTodoSchema`、`updateTodoSchema`

**TanStack 集合（`src/app/(tabs)/todo.tsx`）：**
- 使用 `electricCollectionOptions` 创建 `todoCollection`
- Shape 同步 URL：`http://${hostname}:3001/api/todos`
- 时间戳列（`timestamptz`）的自定义解析器
- 变更处理器：`onInsert`、`onUpdate`、`onDelete`，调用后端 API

**API 客户端（`src/utils/api-client.ts`）：**
- 独立的基于 fetch 的后端通信客户端
- 方法：`createTodo`、`updateTodo`、`deleteTodo`
- 使用 `Constants.linkingUri` 进行设备主机名检测
- 返回待办事项数据以及事务 ID（txid）

### 后端（FastAPI）

作为 API 代理和 ElectricSQL shape 流的 Python 后端：

**结构（`backend/app/`）：**
- `main.py` - FastAPI 应用，包含 CORS、CRUD 和 shape 代理路由、启动时自动迁移
- `models.py` - SQLModel 定义（`Todo`、`TodoCreate`、`TodoUpdate`）
- `db.py` - 使用 asyncpg 驱动的异步 PostgreSQL 连接
- `alembic_runner.py` - 启动时的自动迁移运行器

**API 端点：**
- `POST /api/todos` - 创建待办事项，返回 `{todo, txid}`
- `PUT /api/todos/{id}` - 更新待办事项，返回 `{todo, txid}`
- `DELETE /api/todos/{id}` - 删除待办事项，返回 `{success, txid}`
- `GET /api/todos` - 代理 ElectricSQL shape 流，提供实时更新

**Shape 流代理实现：**

后端代理（`GET /api/todos`）对 ElectricSQL 集成至关重要。它必须转发所有 ElectricSQL 协议参数：

- `live`、`live-sse` - 启用实时更新
- `handle`、`expired-handle` - 流位置标记
- `offset` - 流偏移量
- `cursor` - 事务游标
- `log`、`log-mode` - 日志模式
- `where`、`limit`、`order-by` - 查询过滤器
- `columns` - 列选择

**关键实现细节：**

1. **流管理**（main.py:200-234）：
   - 使用 `client.send(req, stream=True)` 而不是 `async with` 上下文管理器
   - 保持流打开，直到客户端完成读取
   - 在 `stream_generator` 的 `finally` 块中清理资源
   - 将超时设置为 300 秒以支持长连接

2. **透传所有状态码**：
   - 将所有状态码（包括 409 Conflict）返回给客户端
   - 切勿为非 200 响应抛出 HTTPException
   - TanStack DB Electric Collection 需要 409 来处理过期的 handle

3. **事务 ID 生成**（main.py:72-79）：
   - 使用 `pg_current_xact_id()::xid::text` 而不是 `txid_current()`
   - 在与变更相同的事务内调用
   - 使用 `::xid::text` 去除 epoch 以匹配 Electric 的流

**环境变量：**
- `DATABASE_URL` - PostgreSQL 连接字符串
- `ELECTRIC_URL` - ElectricSQL 实例（默认：`http://localhost:3000`）
- `RUN_MIGRATIONS_ON_STARTUP` - 启用/禁用自动迁移（默认：`true`）

### 数据库迁移（Alembic）

**配置：**
- 使用混合配置：`alembic.ini` 用于数据库 URL + `pyproject.toml` 用于其他设置
- `backend/migrations/env.py` - 带有 SQLModel 元数据的异步迁移支持
- `backend/migrations/script.py.mako` - 带有 `sqlmodel` 导入的迁移模板
- 使用 Black 自动格式化生成的迁移

**迁移工作流程：**
1. 修改 `backend/app/models.py`（SQLModel 模式）
2. 运行 `uv run alembic revision --autogenerate -m "描述"`
3. 检查 `backend/migrations/versions/` 中生成的文件
4. 运行 `uv run alembic upgrade head` 应用迁移
5. 后端在启动时自动运行迁移（可通过环境变量禁用）

**重要提示：**
- 在应用之前务必检查自动生成的迁移
- Autogenerate 可检测：表/列添加/删除、可空更改、索引、外键
- Autogenerate 无法检测：表/列重命名（显示为删除+添加）、匿名约束
- 使用描述性的迁移消息
- 同时测试升级和降级

**Windows 兼容性：**
- 必须使用 `alembic.ini` 作为数据库 URL（Windows 编码问题）
- 在 `alembic.ini` 和 `pyproject.toml` 中注释掉 `timezone = UTC`
- 迁移模板包含 `import sqlmodel` 以避免 `NameError`

### 基础设施（Docker）

`docker-compose.yml` 定义：
- **PostgreSQL 16**：端口 54321，WAL 级别 logical 用于复制
- **ElectricSQL**：端口 3000，连接到 PostgreSQL，开发环境使用不安全模式

### 富文本编辑器（Tentap）

核心功能是使用 `@10play/tentap-editor` 构建的富文本编辑器：

**组件：**
- `src/components/tentap-editor.tsx` - 使用 `useEditorBridge` 的主编辑器包装器
- `src/components/glass-toolbar.tsx` - 键盘显示时出现的玻璃态工具栏
  - 支持多个上下文：Main、Heading、Link
  - 上下文感知按钮状态（激活/禁用）
  - 使用 `expo-glass-effect` 实现玻璃态 UI
  - 仅在键盘可见时渲染（keyboardHeight > 0）
- `src/components/toolbar-buttons.ts` - 按钮定义（MAIN_TOOLBAR_BUTTONS、HEADING_BUTTONS）
- `src/components/toolbar-types.ts` - 工具栏系统的 TypeScript 类型

**工具栏系统：**
每个工具栏按钮具有：
- `id`、`label`、`icon`
- `action(editor, state)` - 执行命令
- `getActive(state)` - 检查格式是否激活
- `getDisabled(state)` - 检查命令是否可用

### 样式

- **Tailwind CSS v4** 通过 `tailwindcss` 包
- **Uniwind** - React Native 特定的 Tailwind（metro.config.js 集成）
- **HeroUI Native** - UI 组件库（`heroui-native`）
- **玻璃态** - `expo-glass-effect` 用于毛玻璃 UI
- 类名通过 Uniwind 的运行时工作（参见 `.vscode/settings.json` 中配置的属性）

### Provider 栈

根布局（`src/app/_layout.tsx`）使用以下内容包装应用：
1. `GestureHandlerRootView` - 用于 react-native-gesture-handler
2. `HeroUINativeProvider` - HeroUI 上下文

## 数据库连接

### DataGrip / pgAdmin

```
主机: localhost
端口: 54321
数据库: electric
用户: postgres
密码: password
```

### 直接连接

```bash
psql -h localhost -p 54321 -U postgres -d electric
```

## 数据库迁移

本项目使用 **Alembic** 进行数据库模式管理。

### 日常开发流程

修改 `backend/app/models.py` 中的模型后：

```bash
cd backend

# 基于模型变更生成迁移
uv run alembic revision --autogenerate -m "变更描述"

# 检查生成的迁移文件（位于 backend/migrations/versions/）

# 应用迁移
uv run alembic upgrade head
```

### 常用命令

```bash
# 查看当前迁移版本
uv run alembic current

# 查看迁移历史
uv run alembic history

# 回滚一个迁移
uv run alembic downgrade -1

# 回滚所有迁移
uv run alembic downgrade base

# 检查待处理的迁移（不应用）
uv run alembic check
```

### 启动时自动迁移

后端会在启动时自动运行待处理的迁移。可以通过环境变量禁用：

```bash
export RUN_MIGRATIONS_ON_STARTUP=false
```

### 重要提示

- **务必检查**自动生成的迁移后再应用
- **使用描述性的**迁移消息（例如："Add priority field to todos"）
- **同时测试** upgrade 和 downgrade 以确保回滚有效
- **提交迁移文件**到版本控制

详细文档请参考：[backend/docs/alembic-pyproject-setup.md](backend/docs/alembic-pyproject-setup.md)

## 开发

### 类型检查

```bash
bunx tsc --noEmit
```

### 代码检查

```bash
bun run lint
```

### 后端开发

```bash
cd backend
uv run python -m app.main   # 启动（已启用热重载）
```

## 故障排查

### Docker 服务无法启动

```bash
docker compose down -v  # 删除数据卷
docker compose up -d    # 重新启动
```

### ElectricSQL 连接问题

**应用启动时出现 409 Conflict**

当应用启动时，你可能会看到类似这样的日志：
```
INFO: 192.168.2.188 - "GET /api/todos?...&handle=XXX HTTP/1.1" 409 Conflict
INFO: 192.168.2.188 - "GET /api/todos?...&handle=YYY HTTP/1.1" 200 OK
```

**这是正常行为！** 409 Conflict 是 ElectricSQL 会话恢复机制的一部分：
1. 客户端尝试使用上一个会话缓存的 handle 重新连接
2. ElectricSQL 检测到 handle 已过期并返回 409
3. 客户端自动创建带有新 handle 的新连接
4. 所有后续同步正常工作

**无需任何操作** - TanStack DB Electric Collection 会自动处理这种情况。

检查 Electric 是否运行：
```bash
curl http://localhost:3000/api/health
```

### 后端 API 无响应

验证后端是否在 3001 端口运行：
```bash
curl http://localhost:3001/api/health
```

### 移动端无法连接后端

- 确保你的设备/模拟器与后端在同一网络
- 更新 `src/utils/api-client.ts` 中的 `API_BASE_URL` 为你机器的 IP 地址

### ElectricSQL 前端错误

**错误："Cannot read property 'event' of undefined"**

这表明来自后端的 shape 流存在问题。检查：
1. 后端正在运行且没有抛出错误
2. ElectricSQL 服务可访问
3. 所有 ElectricSQL 协议参数都已转发（参见 `backend/app/main.py`）

**错误："Stream has been closed"**

流响应被过早关闭。这种情况发生在：
- 后端的代理函数在发送响应之前关闭了流
- 连接超时时间太短

**解决方案**：确保后端使用 `client.send(req, stream=True)` 并保持流打开直到客户端完成读取（参见 `backend/app/main.py:200-234`）。

### 乐观更新未同步

如果变更似乎有效但数据没有从后端同步：

**问题：txid 不匹配**
- 后端返回的 txid 与 Postgres 中的实际事务不匹配
- 这发生在 `pg_current_xact_id()` 在变更事务之外调用时

**解决方案**：确保 `get_current_txid()` 在与变更相同的事务内调用（参见 `backend/app/main.py:72-79`）。

**启用调试日志**以诊断 txid 问题：
```javascript
// 在浏览器控制台中
localStorage.debug = 'ts/db:electric'
```

这将显示 txid 何时被请求以及它们何时从流中到达。

### 迁移相关问题

**Autogenerate 生成空迁移**
- 确保 `migrations/env.py` 从 `app.models` 导入了所有模型
- 检查 `target_metadata = SQLModel.metadata`（不是 `None`）
- 验证数据库连接是否正确

**迁移应用失败并出现编码错误（Windows）**
- 这是正常现象 - 请参阅 [backend/docs/alembic-pyproject-setup.md](backend/docs/alembic-pyproject-setup.md) 了解 Windows 特定设置

**ElectricSQL 报告迁移后表被删除/重命名**
```bash
docker compose restart electric
```

**想要禁用启动时自动迁移**
```bash
export RUN_MIGRATIONS_ON_STARTUP=false
```

## 许可证

MIT

## 相关资源

- [TanStack DB 文档](https://tanstack.com/db/latest)
- [ElectricSQL 文档](https://electric-sql.com/docs)
- [Expo 文档](https://docs.expo.dev/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Alembic 教程](backend/docs/complete-migration-guide.md) - 完整迁移指南
- [Alembic 设置计划](backend/docs/alembic-pyproject-setup.md) - 项目特定设置指南
