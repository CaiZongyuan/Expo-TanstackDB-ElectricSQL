import { GlassToolbar } from "@/src/components/glass-toolbar";
import { selectDiarySchema } from "@/src/db/schema";
import { apiClient, hostname } from "@/src/utils/api-client";
import {
  RichText,
  TenTapStartKit,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { parseISO } from "date-fns";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// --- Electric DB Setup ---
const diaryCollection = createCollection(
  electricCollectionOptions({
    id: `diaries`,
    schema: selectDiarySchema,
    shapeOptions: {
      url: `http://${hostname}:3001/api/diaries`,
      parser: {
        timestamptz: (date: string) => parseISO(date),
      },
    },
    onInsert: async ({ transaction }) => {
      const { txid } = await apiClient.createDiary(
        transaction.mutations[0].modified
      );
      return { txid };
    },
    onUpdate: async ({ transaction }) => {
      const {
        original: { id },
        changes,
      } = transaction.mutations[0];
      const { txid } = await apiClient.updateDiary(Number(id), changes);
      return { txid };
    },
    onDelete: async ({ transaction }) => {
      const { id } = transaction.mutations[0].original;
      const { txid } = await apiClient.deleteDiary(Number(id));
      return { txid };
    },
    getKey: (item) => Number(item.id),
  })
);

const EMPTY_HTML = "<p></p>";

export default function Diary() {
  const { id: diaryIdFromParams } = useLocalSearchParams<{ id: string }>();
  const isNewDiary =
    diaryIdFromParams === "new" || diaryIdFromParams === undefined;

  // Query diaries
  const { data: diaries } = useLiveQuery((q) => q.from({ diaryCollection }));

  // Find current diary by ID
  const currentDiary = diaries?.find((d) => d.id === Number(diaryIdFromParams));

  // For new diaries that haven't synced yet, find by most recent
  const latestDiary =
    isNewDiary || !currentDiary
      ? diaries?.sort((a, b) => {
          const bTime = new Date(b.updated_at).getTime();
          const aTime = new Date(a.updated_at).getTime();
          return bTime - aTime;
        })[0]
      : currentDiary;

  // Local state
  const [title, setTitle] = useState(latestDiary?.title || "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // TenTap editor setup
  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: latestDiary?.content || EMPTY_HTML,
    bridgeExtensions: [...TenTapStartKit],
  });

  // Monitor editor content changes
  const editorContent = useEditorContent(editor, { type: "html" });

  // Update title when diary data changes
  useEffect(() => {
    if (latestDiary) {
      setTitle(latestDiary.title);
    }
  }, [latestDiary]);

  // Debounced save function
  const debouncedSave = useCallback(
    (id: number, newTitle: string, newContent: string) => {
      if (isSaving) return;

      setIsSaving(true);

      try {
        diaryCollection.update(id, (draft) => {
          draft.title = newTitle;
          draft.content = newContent;
        });
        setIsDirty(false);
      } catch (error) {
        console.error("Failed to save diary:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving]
  );

  // Auto-save content changes
  useEffect(() => {
    if (
      latestDiary &&
      editorContent !== undefined &&
      editorContent !== latestDiary.content
    ) {
      setIsDirty(true);
      const timeoutId = setTimeout(() => {
        debouncedSave(latestDiary.id, title, editorContent);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [editorContent, latestDiary, title, debouncedSave]);

  // Auto-save title changes
  useEffect(() => {
    if (
      latestDiary &&
      title !== latestDiary.title &&
      title !== ""
    ) {
      setIsDirty(true);
      const timeoutId = setTimeout(() => {
        const contentToSave = editorContent || latestDiary.content || EMPTY_HTML;
        debouncedSave(latestDiary.id, title, contentToSave);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [title, latestDiary, editorContent, debouncedSave]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      edges={["bottom"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Title Input */}
        <View className="px-2 py-2">
          <View className="flex-row items-center justify-between">
            <TextInput
              className="text-[28px] font-extrabold text-black -tracking-tight flex-1"
              value={title}
              onChangeText={setTitle}
              onEndEditing={() => {
                // Trigger immediate save when user finishes editing title
                if (latestDiary && title !== latestDiary.title) {
                  const contentToSave = editorContent || latestDiary.content || EMPTY_HTML;
                  debouncedSave(latestDiary.id, title, contentToSave);
                }
              }}
              placeholder="Diary Title..."
              placeholderTextColor="#A1A1AA"
              submitBehavior="blurAndSubmit"
            />
          </View>

          {/* Save Status */}
          <View className="flex-row items-center gap-3">
            {isSaving && (
              <Text className="text-[#71717A] text-sm">Saving...</Text>
            )}
            {isDirty && !isSaving && (
              <Text className="text-[#F31260] text-sm">Unsaved</Text>
            )}
          </View>
        </View>

        {/* Editor */}
        <View className="flex-1 ">
          <RichText editor={editor} />
        </View>

        {/* Toolbar */}
        <GlassToolbar editor={editor} initiallyVisible={true} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
