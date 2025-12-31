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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const theme = {
  colors: {
    background: "#FFFFFF",
    content1: "#FFFFFF", // Card background
    content2: "#F4F4F5", // Input background / Hover
    primary: "#006FEE",
    primaryForeground: "#FFFFFF",
    danger: "#F31260",
    dangerForeground: "#FFFFFF",
    default: "#3F3F46", // Text color
    default300: "#D4D4D8", // Border/Disabled
    default500: "#71717A", // Subtext
    overlay: "rgba(0, 0, 0, 0.4)",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  shadow: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: "#006FEE",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};

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
      const { txid } = await apiClient.updateTodo(id, changes);
      return { txid };
    },
    onDelete: async ({ transaction }) => {
      const { id } = transaction.mutations[0].original;
      const { txid } = await apiClient.deleteTodo(id);
      return { txid };
    },
    getKey: (item) => item.id,
  })
);

const HeroButton = ({ onPress, title, color = "primary", style }: any) => {
  const isPrimary = color === "primary";
  const bg = isPrimary ? theme.colors.primary : theme.colors.danger;
  const fg = isPrimary
    ? theme.colors.primaryForeground
    : theme.colors.dangerForeground;
  const shadow = isPrimary ? theme.shadow.md : {};

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        shadow,
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
};

const HeroCheckbox = ({ checked, onPress }: any) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.checkbox,
        checked ? styles.checkboxChecked : styles.checkboxUnchecked,
        pressed && { opacity: 0.7 },
      ]}
    >
      {checked && <Text style={styles.checkmark}>✓</Text>}
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.headerTitle}>Tasks</Text>
          <Text style={styles.headerSubtitle}>Manage your daily goals</Text>

          {/* Input Section */}
          <View style={styles.inputWrapper}>
            <View
              style={[
                styles.inputContainer,
                isFocused && styles.inputContainerFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                value={newTodoText}
                onChangeText={setNewTodoText}
                placeholder="What needs to be done?"
                placeholderTextColor={theme.colors.default500}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>
            <HeroButton
              title="Add"
              onPress={handleAddTodo}
              style={styles.addButton}
            />
          </View>

          {/* Todo List */}
          <FlatList
            data={todos}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable style={styles.card}>
                <View style={styles.cardRow}>
                  <HeroCheckbox
                    checked={item.completed}
                    onPress={() => {
                      todoCollection.update(item.id, (draft) => {
                        draft.completed = !draft.completed;
                      });
                    }}
                  />

                  <View style={styles.textWrapper}>
                    <Text
                      style={[
                        styles.todoText,
                        item.completed && styles.todoTextCompleted,
                      ]}
                      numberOfLines={2}
                    >
                      {item.text}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => todoCollection.delete(item.id)}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.deleteIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.default500,
    marginBottom: 24,
  },
  // Input Styles
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: theme.colors.content2,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    height: 56, // Tall input for modern feel
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  inputContainerFocused: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.primary,
  },
  input: {
    fontSize: 16,
    color: theme.colors.default,
    height: "100%",
  },
  addButton: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: theme.radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  button: {
    // Base button styles handled in component
  },
  // List Styles
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.content1,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.content2,
    // Soft shadow
    ...theme.shadow.sm,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Checkbox
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8, // Rounded square
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxUnchecked: {
    borderColor: theme.colors.default300,
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkmark: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  // Text
  textWrapper: {
    flex: 1,
  },
  todoText: {
    fontSize: 16,
    color: theme.colors.default,
    fontWeight: "500",
  },
  todoTextCompleted: {
    color: theme.colors.default300,
    textDecorationLine: "line-through",
  },
  // Delete
  deleteButton: {
    padding: 8,
    backgroundColor: theme.colors.content2,
    borderRadius: theme.radius.full,
    marginLeft: 8,
  },
  deleteIcon: {
    color: theme.colors.default500,
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.default500,
  },
});
