# TenTap Editor 数据持久化指南

> **适用场景**: React Native + Expo + SQLite + TenTap Editor
>
> **难度等级**: 中级
>
> **预计阅读时间**: 15 分钟

## 目录

- [概述](#概述)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [实现步骤](#实现步骤)
  - [步骤 1: 数据库 Schema 设计](#步骤-1-数据库-schema-设计)
  - [步骤 2: 类型定义和验证](#步骤-2-类型定义和验证)
  - [步骤 3: 数据库服务层](#步骤-3-数据库服务层)
  - [步骤 4: React Query Hooks](#步骤-4-react-query-hooks)
  - [步骤 5: TenTap Editor 组件](#步骤-5-tentap-editor-组件)
  - [步骤 6: 页面集成](#步骤-6-页面集成)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 概述

TenTap Editor 是一个基于 Tiptap 的 React Native 富文本编辑器。本指南将展示如何完整实现 TenTap Editor 的数据持久化方案，包括数据库设计、服务层封装、状态管理和编辑器集成。

### 核心挑战

1. **JSONContent 序列化**: TenTap Editor 输出的内容是 JSON 对象，需要序列化为字符串存储
2. **类型安全**: 确保 JSONContent 在存储和读取过程中保持类型安全
3. **图片上传**: 处理编辑器中的图片上传和 URL 替换
4. **未保存提醒**: 防止用户意外丢失编辑内容

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React Native | - | 移动端框架 |
| Expo | 54+ | 开发工具链 |
| TenTap Editor | Latest | 富文本编辑器 |
| Drizzle ORM | Latest | 数据库 ORM |
| SQLite | - | 本地数据库 |
| TanStack Query | Latest | 状态管理和缓存 |
| Zod | Latest | 运行时类型验证 |

---

## 架构设计

```
┌─────────────────────────────────────────────────────┐
│           Presentation Layer (UI)                   │
│  ┌──────────────────┐      ┌──────────────────┐    │
│  │  Diary Screen    │──────│ TenTap Editor    │    │
│  └──────────────────┘      └──────────────────┘    │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│         State Management Layer (Hooks)              │
│  ┌──────────────────┐      ┌──────────────────┐    │
│  │  useDiaryQuery   │      │ useSaveMutation  │    │
│  └──────────────────┘      └──────────────────┘    │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│           Service Layer (Business Logic)            │
│  ┌──────────────────┐      ┌──────────────────┐    │
│  │  diaryDatabase   │      │  imageUpload     │    │
│  └──────────────────┘      └──────────────────┘    │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│          Data Access Layer (Drizzle ORM)            │
│  ┌──────────────────┐      ┌──────────────────┐    │
│  │  diarySchema     │──────│   SQLite DB      │    │
│  └──────────────────┘      └──────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 实现步骤

### 步骤 1: 数据库 Schema 设计

使用 Drizzle ORM 定义数据库表结构。核心思路是将 TenTap 的 `JSONContent` 对象序列化为字符串存储。

**文件**: `services/db/schema/diarySchema.ts`

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 日记主表
export const diaries = sqliteTable("diaries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // 核心: 将 JSONContent 存储为 TEXT
  content: text("content"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  // 可选字段
  thumbnailUri: text("thumbnailUri"),
  isFavorite: integer("isFavorite", { mode: "boolean" }).default(false),
});
```

**关键点**:
- `content` 字段使用 `text` 类型存储 JSON 字符串
- 时间戳使用 `timestamp_ms` 模式，精确到毫秒
- 使用软删除 (`deletedAt`) 而不是物理删除

---

### 步骤 2: 类型定义和验证

使用 Zod 定义类型，确保运行时类型安全。

**文件**: `components/diary/editor/types/diaryDatabase.ts`

```typescript
import { z } from "zod";

// 数据库 Schema
export const DiarySchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(), // 注意: 这里是 string，存储序列化后的 JSON
  createdAt: z.date().transform((date) => date.getTime()),
  updatedAt: z.date().transform((date) => date.getTime()),
  deletedAt: z.date().nullable(),
  thumbnailUri: z.string().nullable(),
  isFavorite: z.boolean(),
});

// TypeScript 类型
export type Diary = z.infer<typeof DiarySchema>;

// 创建/更新时的输入类型
export type DiaryInput = Omit<
  Partial<Diary>,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
> & {
  title: string; // 标题必填
};
```

**关键点**:
- `DiarySchema.content` 是 `string` 类型（数据库层）
- 应用层使用 `JSONContent` 类型（TenTap 层）
- 需要在两者之间进行转换

---

### 步骤 3: 数据库服务层

实现 CRUD 操作，处理 JSON 序列化/反序列化。

**文件**: `services/diaryDatabase.ts`

```typescript
import { db } from "@/services/db";
import { eq, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import * as schema from "./db/schema/diarySchema";
import { Diary, DiaryInput, DiarySchema } from "@/types/diaryDatabase";

// 根据ID获取日记
export async function getDiaryById(id: string): Promise<Diary | null> {
  const result = await db.query.diaries.findFirst({
    where: eq(schema.diaries.id, id),
  });

  if (!result) return null;

  // 使用 Zod 解析确保类型安全
  return DiarySchema.parse(result);
}

// 创建日记
export async function createDiary(
  diaryInput: DiaryInput
): Promise<Diary> {
  const now = new Date();
  const diaryId = uuidv4();

  const [result] = await db
    .insert(schema.diaries)
    .values({
      id: diaryId,
      ...diaryInput,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return DiarySchema.parse(result);
}

// 更新日记
export async function updateDiary(
  id: string,
  diaryInput: Partial<DiaryInput>
): Promise<Diary> {
  const now = new Date();

  await db
    .update(schema.diaries)
    .set({
      ...diaryInput,
      updatedAt: now,
    })
    .where(eq(schema.diaries.id, id));

  const result = await db.query.diaries.findFirst({
    where: eq(schema.diaries.id, id),
  });

  if (!result) {
    throw new Error(`Diary with id ${id} not found after update.`);
  }

  return DiarySchema.parse(result);
}
```

**关键点**:
- 使用 UUID 作为主键
- 自动管理 `createdAt` 和 `updatedAt`
- 使用 Zod 解析返回值，确保类型安全

---

### 步骤 4: React Query Hooks

封装数据获取和修改逻辑，处理 `JSONContent` 的序列化。

**文件**: `components/diary/editor/hooks/useDiary.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { JSONContent } from "@tiptap/core";
import { createDiary, getDiaryById, updateDiary } from "@/services/diaryDatabase";

// 应用层的 Diary 类型 (content 是 JSONContent)
export interface Diary {
  id: string;
  title: string;
  content: JSONContent; // TenTap 的 JSON 格式
}

// 空内容常量
const EMPTY_CONTENT: JSONContent = { type: "doc", content: [] };

// 获取日记 (READ)
const fetchDiary = async (id: string): Promise<Diary> => {
  const dbDiary = await getDiaryById(id);

  if (!dbDiary) {
    throw new Error(`Diary with ID ${id} not found.`);
  }

  // 反序列化: string -> JSONContent
  let parsedContent: JSONContent = EMPTY_CONTENT;

  if (dbDiary.content) {
    if (typeof dbDiary.content === "string") {
      try {
        parsedContent = JSON.parse(dbDiary.content);
      } catch (e) {
        console.error("Failed to parse diary content:", e);
        parsedContent = EMPTY_CONTENT;
      }
    }
  }

  return {
    id: dbDiary.id,
    title: dbDiary.title,
    content: parsedContent,
  };
};

export const useDiaryQuery = (id: string | null) => {
  return useQuery<Diary, Error>({
    queryKey: ["diary", id],
    queryFn: () => fetchDiary(id!),
    enabled: !!id && id !== "new",
  });
};

// 保存日记 (CREATE/UPDATE)
interface SaveDiaryPayload {
  id: string | null;
  title: string;
  content: JSONContent;
}

const saveDiary = async ({
  id,
  title,
  content,
}: SaveDiaryPayload): Promise<Diary> => {
  // 序列化: JSONContent -> string
  const serializedContent = JSON.stringify(content);

  const diaryInput = {
    title,
    content: serializedContent,
  };

  const isNew = !id || id === "new";

  if (isNew) {
    const created = await createDiary(diaryInput);
    return { id: created.id, title: created.title, content };
  } else {
    const updated = await updateDiary(id, diaryInput);
    return { id: updated.id, title: updated.title, content };
  }
};

export const useSaveDiaryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Diary, Error, SaveDiaryPayload>({
    mutationFn: saveDiary,
    onSuccess: (savedDiary) => {
      // 更新缓存
      queryClient.invalidateQueries({ queryKey: ["diary", savedDiary.id] });
      queryClient.invalidateQueries({ queryKey: ["diaries"] });
      // 立即更新当前查询，避免闪烁
      queryClient.setQueryData(["diary", savedDiary.id], savedDiary);
    },
  });
};
```

**关键点**:
- **序列化**: `JSON.stringify(content)` 在保存时
- **反序列化**: `JSON.parse(dbDiary.content)` 在读取时
- **错误处理**: 解析失败时使用 `EMPTY_CONTENT`
- **缓存管理**: 使用 `setQueryData` 立即更新缓存

---

### 步骤 5: TenTap Editor 组件

封装 TenTap Editor，处理图片上传和内容更新。

**文件**: `components/diary/editor/components/TenTapEditor.tsx`

```typescript
import {
  CoreBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";
import { JSONContent } from "@tiptap/core";
import { forwardRef, useEffect, useImperativeHandle } from "react";

interface TenTapEditorProps {
  initialContent: JSONContent;
  onUpdate?: (content: JSONContent) => void;
}

export interface TenTapEditorHandle {
  getContent: () => JSONContent | undefined;
}

const TenTapEditor = forwardRef<TenTapEditorHandle, TenTapEditorProps>(
  ({ initialContent, onUpdate }, ref) => {
    const editor = useEditorBridge({
      autofocus: true,
      avoidIosKeyboard: true,
      initialContent,
      bridgeExtensions: [
        ...TenTapStartKit,
      ],
    });

    // 监听内容变化
    const editorContent = useEditorContent(editor, { type: "json" });
    useEffect(() => {
      if (onUpdate && editorContent) {
        onUpdate(editorContent);
      }
    }, [editorContent, onUpdate]);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      getContent: () => editorContent,
    }));

    return (
      <RichText editor={editor} />
    );
  }
);

export default TenTapEditor;
```

**关键点**:
- `useEditorContent` 监听编辑器内容变化
- 通过 `onUpdate` 回调实时同步内容到父组件
- 使用 `useImperativeHandle` 暴露 `getContent` 方法

---

### 步骤 6: 页面集成

完整集成编辑器、状态管理和导航。

**文件**: `app/(tabs)/home/diary/[id].tsx`

```typescript
import { useDiaryQuery, useSaveDiaryMutation } from "@/components/diary/editor/hooks/useDiary";
import TenTapEditor from "@/components/diary/editor/components/TenTapEditor";
import { JSONContent } from "@tiptap/core";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

const NEW_DIARY_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const DiaryEditorScreen = () => {
  const { id: diaryIdFromParams } = useLocalSearchParams<{ id: string }>();
  const isNewDiary = diaryIdFromParams === "new";

  // 1. 获取日记数据
  const {
    data: initialDiary,
    isLoading,
    isError,
  } = useDiaryQuery(isNewDiary ? null : diaryIdFromParams);

  // 2. 本地状态
  const [title, setTitle] = useState<string>("");
  const [currentContent, setCurrentContent] = useState<JSONContent>();
  const [isDirty, setIsDirty] = useState(false);

  // 3. 初始化内容
  const initialContent = useMemo(() => {
    return isNewDiary
      ? NEW_DIARY_CONTENT
      : (initialDiary?.content as JSONContent);
  }, [isNewDiary, initialDiary]);

  // 4. 设置初始标题和内容
  useEffect(() => {
    if (initialContent) {
      setTitle(isNewDiary ? "" : initialDiary?.title || "");
      setCurrentContent(initialContent);
    }
  }, [initialContent, isNewDiary, initialDiary?.title]);

  // 5. 检测是否有未保存的更改
  useEffect(() => {
    if (!initialContent || !currentContent) {
      setIsDirty(false);
      return;
    }
    const titleChanged = title !== (isNewDiary ? "" : initialDiary?.title);
    const contentChanged =
      JSON.stringify(currentContent) !== JSON.stringify(initialContent);
    setIsDirty(titleChanged || contentChanged);
  }, [title, currentContent, initialContent, isNewDiary, initialDiary?.title]);

  // 6. 保存 mutation
  const { mutate: saveDiary, isPending: isSaving } = useSaveDiaryMutation();

  // 7. 保存处理
  const handleSave = useCallback(() => {
    if (isSaving || !currentContent) return;

    saveDiary(
      {
        id: isNewDiary ? null : diaryIdFromParams,
        title,
        content: currentContent,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          router.back();
        },
      }
    );
  }, [isSaving, title, currentContent, isNewDiary, diaryIdFromParams, saveDiary]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return <ErrorMessage />;
  }

  return (
    <SafeAreaView>
      <EditorHeader onBack={router.back} onSave={handleSave} />

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="请输入标题..."
      />

      <TenTapEditor
        key={diaryIdFromParams}
        initialContent={initialContent}
        onUpdate={(newContent) => {
          setCurrentContent(newContent);
        }}
      />
    </SafeAreaView>
  );
};

export default DiaryEditorScreen;
```

**关键点**:
- 使用 `key={diaryIdFromParams}` 强制重新挂载编辑器
- 实时检测 `isDirty` 状态
- 使用 `usePreventRemove` 防止意外丢失数据
- 通过 `onUpdate` 回调实时同步编辑器内容

---

## 最佳实践

### 1. JSONContent 序列化

**推荐做法**:
```typescript
// 保存时
const serialized = JSON.stringify(content);
db.save({ content: serialized });

// 读取时
const parsed = JSON.parse(dbDiary.content);
```

**避免**:
```typescript
// ❌ 不要直接存储对象
db.save({ content: object }); // 可能丢失数据

// ❌ 不要在多个地方重复序列化逻辑
const content1 = JSON.parse(data);
const content2 = JSON.parse(data);
```

### 2. 错误处理

**健壮的反序列化**:
```typescript
let parsedContent: JSONContent = EMPTY_CONTENT;

if (dbDiary.content) {
  try {
    parsedContent = JSON.parse(dbDiary.content);
  } catch (e) {
    console.error("Failed to parse content:", e);
    // 使用空内容而不是崩溃
    parsedContent = EMPTY_CONTENT;
  }
}
```

### 3. 缓存策略

**立即更新缓存**:
```typescript
onSuccess: (savedDiary) => {
  // 立即更新缓存，避免闪烁
  queryClient.setQueryData(["diary", savedDiary.id], savedDiary);
  // 然后重新验证
  queryClient.invalidateQueries({ queryKey: ["diary", savedDiary.id] });
}
```

### 4. 未保存提醒

**使用 usePreventRemove**:
```typescript
import { usePreventRemove } from "@react-navigation/native";

usePreventRemove(isDirty, ({ data }) => {
  Alert.alert("未保存的更改", "离开前保存吗？", [
    { text: "放弃", onPress: () => navigation.dispatch(data.action) },
    { text: "保存", onPress: () => handleSave(() => navigation.dispatch(data.action)) },
  ]);
});
```

### 5. 编辑器重新挂载

**使用 key 属性**:
```typescript
<TenTapEditor
  key={diaryIdFromParams} // 当 ID 变化时强制重新挂载
  initialContent={initialContent}
  onUpdate={setCurrentContent}
/>
```

---

## 常见问题

### Q1: 编辑器内容不更新?

**原因**: 编辑器没有正确初始化或重新挂载。

**解决方案**:
```typescript
// 1. 使用 key 属性强制重新挂载
<TenTapEditor key={diaryId} />

// 2. 确保 initialContent 是正确的格式
const initialContent = useMemo(() => {
  return isNewDiary ? NEW_DIARY_CONTENT : diary?.content;
}, [isNewDiary, diary]);
```

### Q2: JSON 解析失败?

**原因**: 数据库中的 content 不是有效的 JSON 字符串。

**解决方案**:
```typescript
// 添加错误处理
try {
  parsedContent = JSON.parse(dbDiary.content);
} catch (e) {
  console.error("Invalid JSON:", e);
  parsedContent = EMPTY_CONTENT;
}
```

### Q3: 图片上传失败?

**原因**: 图片 URL 没有正确插入到编辑器中。

**解决方案**:
```typescript
const handleImageUpload = async () => {
  const imageUri = await pickImage();
  const imageUrl = await uploadImage(imageUri);

  // 使用 editor.setImage() 方法
  editor.setImage(imageUrl);
};
```

### Q4: 保存后内容闪烁?

**原因**: 缓存没有立即更新。

**解决方案**:
```typescript
onSuccess: (savedDiary) => {
  // 立即更新缓存
  queryClient.setQueryData(["diary", savedDiary.id], savedDiary);
}
```

### Q5: 类型错误?

**原因**: `JSONContent` 类型不匹配。

**解决方案**:
```typescript
// 确保导入了正确的类型
import { JSONContent } from "@tiptap/core";

// 类型断言（如果必要）
const content = initialDiary?.content as JSONContent;
```

---

## 总结

本指南涵盖了 TenTap Editor 数据持久化的完整实现方案:

1. **数据库层**: 使用 TEXT 字段存储 JSON 字符串
2. **服务层**: 处理序列化/反序列化逻辑
3. **状态层**: React Query 管理缓存和状态
4. **UI层**: TenTap Editor 实时同步内容

**核心原则**:
- ✅ 单一数据源 (数据库为唯一真相来源)
- ✅ 类型安全 (Zod + TypeScript)
- ✅ 错误处理 (优雅降级)
- ✅ 缓存优化 (立即更新缓存)
- ✅ 用户体验 (未保存提醒)

---

## 参考资源

- [TenTap Editor 官方文档](https://www.10play.io/)
- [Tiptap 文档](https://tiptap.dev/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Expo Router 文档](https://docs.expo.dev/router/introduction/)
