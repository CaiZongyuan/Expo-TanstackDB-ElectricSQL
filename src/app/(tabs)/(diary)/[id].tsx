import { GlassToolbar } from "@/src/components/glass-toolbar";
import { selectDiarySchema } from "@/src/db/schema";
import { apiClient, hostname } from "@/src/utils/api-client";
import { generateAPIUrl } from "@/src/utils/generateAPIUrl";
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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { marked } from "marked";

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

  // AI-related state
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [showAISection, setShowAISection] = useState(false);
  const [originalContent, setOriginalContent] = useState<string>("");

  // Setup useChat for AI streaming
  const { messages, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl("/api/chat"),
    }),
    onError: (error) => {
      console.error("AI Error:", error);
      setIsAIGenerating(false);
    },
  });

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

  // Stream AI content to editor
  useEffect(() => {
    const updateEditor = async () => {
      if (messages.length === 0) return;

      // Get the last assistant message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        // Extract text from parts
        const textPart = lastMessage.parts.find((part) => part.type === "text");
        if (textPart && textPart.type === "text") {
          // Convert markdown to HTML
          const htmlContent = await marked(textPart.text);
          // Update editor content
          editor.setContent(htmlContent);
        }
      }
    };

    updateEditor();
  }, [messages, editor]);

  // Handle AI generation state changes
  useEffect(() => {
    const handleCompletion = async () => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        // Check if streaming is complete (no more updates expected)
        const textPart = lastMessage.parts.find((part) => part.type === "text");
        if (textPart && textPart.type === "text" && textPart.text.length > 0) {
          // AI generation completed
          setIsAIGenerating(false);

          // Save the final AI-generated content
          if (latestDiary) {
            const htmlContent = await marked(textPart.text);
            debouncedSave(latestDiary.id, title, htmlContent);
          }
        }
      }
    };

    handleCompletion();
  }, [messages, latestDiary, title, debouncedSave]);

  // AI prompt handlers
  const handleSendAIPrompt = () => {
    if (aiPrompt.trim().length === 0 || !latestDiary) return;

    // Save current content as backup
    setOriginalContent(editorContent || latestDiary.content || EMPTY_HTML);
    setIsAIGenerating(true);

    // Get current diary content
    const currentContent = editorContent || latestDiary.content || "";

    // Construct prompt with diary context
    const promptWithContext = currentContent
      ? `I have a diary with the following content:\n\n${currentContent}\n\n${aiPrompt}\n\nPlease respond in markdown format.`
      : `${aiPrompt}\n\nPlease respond in markdown format.`;

    // Send prompt
    sendMessage({
      text: promptWithContext,
    });

    setAiPrompt("");
    Keyboard.dismiss();
  };

  const handleCancelAI = () => {
    stop();
    setIsAIGenerating(false);

    // Restore original content
    if (originalContent) {
      editor.setContent(originalContent);
    }
  };
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
            {isAIGenerating && (
              <Text className="text-[#006FEE] text-sm">AI is writing...</Text>
            )}
          </View>
        </View>

        {/* AI Assistant Section */}
        <View className="px-2 pb-2">
          <Pressable
            onPress={() => setShowAISection(!showAISection)}
            className="flex-row items-center gap-2 py-2"
          >
            <Text className="text-[#006FEE] font-semibold text-base">
              ✨ AI Assistant
            </Text>
            <Text className="text-[#71717A] text-sm">
              {showAISection ? "▼" : "▶"}
            </Text>
          </Pressable>

          {showAISection && (
            <View className="gap-2">
              {isAIGenerating ? (
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 bg-[#F4F4F5] rounded-xl p-3">
                    <Text className="text-[#71717A] text-sm">
                      AI is generating content...
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleCancelAI}
                    className="bg-[#F31260] px-4 py-3 rounded-xl"
                  >
                    <Text className="text-white font-semibold text-sm">Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    className="flex-1 bg-[#F4F4F5] rounded-xl px-3 py-3 text-base text-[#3F3F46]"
                    value={aiPrompt}
                    onChangeText={setAiPrompt}
                    placeholder="Ask AI to help with your diary..."
                    placeholderTextColor="#71717A"
                    editable={!isAIGenerating}
                  />
                  <Pressable
                    onPress={handleSendAIPrompt}
                    disabled={aiPrompt.trim().length === 0 || isAIGenerating}
                    className={`px-4 py-3 rounded-xl ${
                      aiPrompt.trim().length === 0 || isAIGenerating
                        ? "bg-[#E4E4E7]"
                        : "bg-[#006FEE]"
                    }`}
                  >
                    <Text className="text-white font-semibold text-sm">Send</Text>
                  </Pressable>
                </View>
              )}

              {/* Quick Action Buttons */}
              {!isAIGenerating && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {[
                      "Improve my writing",
                      "Expand on this",
                      "Fix grammar",
                      "Make it more expressive",
                    ].map((suggestion) => (
                      <Pressable
                        key={suggestion}
                        onPress={() => setAiPrompt(suggestion)}
                        className="bg-[#F4F4F5] px-3 py-2 rounded-lg"
                      >
                        <Text className="text-[#71717A] text-sm">{suggestion}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}
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
