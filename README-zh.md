# Expo + TanStack DB + ElectricSQL 待办事项应用

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
