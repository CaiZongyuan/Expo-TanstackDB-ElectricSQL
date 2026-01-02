import { selectDiarySchema } from "@/src/db/schema";
import { apiClient, hostname } from "@/src/utils/api-client";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { format, parseISO } from "date-fns";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { FlatList, Pressable, SafeAreaView, Text, TouchableOpacity, View } from "react-native";

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

export default function DiaryList() {
  const { data: diaries } = useLiveQuery((q) => q.from({ diaryCollection }));

  const handleCreateNew = () => {
    // Use a temporary ID - the server will return the real ID
    const tempId = Math.floor(Math.random() * 1000000);
    const tempDiary = {
      id: tempId,
      title: "Untitled Diary",
      content: "<p></p>",
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Insert optimistically - this will sync to server
    diaryCollection.insert(tempDiary);

    // Navigate immediately - the diary will be in the collection
    router.push(`./${tempId}`);
  };

  const renderDiaryItem = ({ item }: { item: any }) => (
    <Pressable
      className="bg-white rounded-2xl p-4 border border-[#F4F4F5] shadow-sm mb-3"
      onPress={() => router.push(`./${item.id}`)}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-[#3F3F46] mb-1" numberOfLines={1}>
            {item.title || "Untitled"}
          </Text>
          <Text className="text-sm text-[#71717A]">
            {format(new Date(item.updated_at), "MMM d, yyyy • h:mm a")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => diaryCollection.delete(Number(item.id))}
          className="p-2 bg-[#F4F4F5] rounded-full"
          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
        >
          <Text className="text-[#71717A] text-sm font-bold">✕</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <Text className="text-[32px] font-extrabold text-black mb-1 -tracking-tight">Diaries</Text>
        <Text className="text-base text-[#71717A] mb-6">Your personal journal</Text>

        {/* Create Button */}
        <Pressable
          onPress={handleCreateNew}
          className="bg-[#006FEE] h-14 rounded-2xl justify-center items-center mb-6 shadow-md"
          style={({ pressed }) => pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }}
        >
          <Text className="text-white font-semibold text-base">+ New Diary</Text>
        </Pressable>
      </View>

      {/* Diary List */}
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <FlatList
          data={diaries}
          keyExtractor={(item) => item.id.toString()}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderDiaryItem}
          ListEmptyComponent={
            <View className="items-center justify-center pt-10 opacity-50">
              <Text className="text-base text-[#71717A]">
                No diaries yet. Create one above!
              </Text>
            </View>
          }
        />
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
