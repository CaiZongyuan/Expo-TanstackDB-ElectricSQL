import { selectTodoSchema } from "@/src/db/schema";
import { apiClient, hostname } from "@/src/utils/api-client";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { parseISO } from "date-fns";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// --- Electric DB Setup ---
const todoCollection = createCollection(
  electricCollectionOptions({
    id: `todos`,
    schema: selectTodoSchema,
    shapeOptions: {
      url: `http://${hostname}:3001/api/todos`,
      parser: {
        timestamptz: (date: string) => parseISO(date),
      },
    },
    onInsert: async ({ transaction }) => {
      const { txid } = await apiClient.createTodo(
        transaction.mutations[0].modified
      );
      return { txid };
    },
    onUpdate: async ({ transaction }) => {
      const {
        original: { id },
        changes,
      } = transaction.mutations[0];
      const { txid } = await apiClient.updateTodo(Number(id), changes);
      return { txid };
    },
    onDelete: async ({ transaction }) => {
      const { id } = transaction.mutations[0].original;
      const { txid } = await apiClient.deleteTodo(Number(id));
      return { txid };
    },
    // Normalize id to number for consistent key matching
    getKey: (item) => Number(item.id),
  })
);

const HeroButton = ({ onPress, title, color = "primary" }: any) => {
  const isPrimary = color === "primary";

  return (
    <Pressable
      onPress={onPress}
      className={`h-14 px-6 rounded-2xl justify-center items-center ${isPrimary ? "bg-[#006FEE] shadow-md" : "bg-[#F31260]"}`}
      style={({ pressed }) => pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }}
    >
      <Text className="text-white font-semibold text-base">{title}</Text>
    </Pressable>
  );
};

const HeroCheckbox = ({ checked, onPress }: any) => {
  return (
    <Pressable
      onPress={onPress}
      className={`w-6 h-6 rounded-lg border-2 justify-center items-center mr-3 ${checked ? "border-[#006FEE] bg-[#006FEE]" : "border-[#D4D4D8] bg-transparent"}`}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      {checked && <Text className="text-white text-sm font-bold">✓</Text>}
    </Pressable>
  );
};

// --- Main Screen ---
export default function HomeScreen() {
  const [newTodoText, setNewTodoText] = useState(``);
  const [isFocused, setIsFocused] = useState(false);

  // Query todos
  const { data: todos } = useLiveQuery((q) => q.from({ todoCollection }));

  const handleAddTodo = () => {
    if (newTodoText.length > 0) {
      todoCollection.insert({
        id: Math.floor(Math.random() * 1000000),
        text: newTodoText,
        completed: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      setNewTodoText(``);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text className="text-[32px] font-extrabold text-black mb-1 -tracking-tight">Tasks</Text>
          <Text className="text-base text-[#71717A] mb-6">Manage your daily goals</Text>

          {/* Input Section */}
          <View className="flex-row items-center mb-6 gap-3">
            <View className={`flex-1 rounded-2xl px-4 h-14 justify-center border-2 ${isFocused ? "bg-white border-[#006FEE]" : "bg-[#F4F4F5] border-transparent"}`}>
              <TextInput
                className="text-base text-[#3F3F46] h-full"
                value={newTodoText}
                onChangeText={setNewTodoText}
                placeholder="What needs to be done?"
                placeholderTextColor="#71717A"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>
            <HeroButton
              title="Add"
              onPress={handleAddTodo}
            />
          </View>
        </View>

        {/* Todo List */}
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <FlatList
            data={todos}
            keyExtractor={(item) => item.id.toString()}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable className="bg-white rounded-2xl p-4 border border-[#F4F4F5] shadow-sm mb-3">
                <View className="flex-row items-center">
                  <HeroCheckbox
                    checked={item.completed}
                    onPress={() => {
                      todoCollection.update(Number(item.id), (draft) => {
                        draft.completed = !draft.completed;
                      });
                    }}
                  />

                  <View className="flex-1">
                    <Text
                      className={`text-base font-medium ${item.completed ? "text-[#D4D4D8] line-through" : "text-[#3F3F46]"}`}
                      numberOfLines={2}
                    >
                      {item.text}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => todoCollection.delete(Number(item.id))}
                    className="p-2 bg-[#F4F4F5] rounded-full ml-2"
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text className="text-[#71717A] text-sm font-bold">✕</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center pt-10 opacity-50">
                <Text className="text-base text-[#71717A]">
                  No tasks yet. Add one above!
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
