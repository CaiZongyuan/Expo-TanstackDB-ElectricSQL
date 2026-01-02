import { generateAPIUrl } from "@/src/utils/generateAPIUrl";
import { MessageRenderer } from "@/src/components/MessageRenderer";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { StatusBar } from "expo-status-bar";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const HeroButton = ({ onPress, title, color = "primary" }: any) => {
  const isPrimary = color === "primary";

  return (
    <Pressable
      onPress={onPress}
      className={`h-14 px-6 rounded-2xl justify-center items-center ${
        isPrimary ? "bg-[#006FEE] shadow-md" : "bg-[#F31260]"
      }`}
      style={({ pressed }) =>
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
      }
    >
      <Text className="text-white font-semibold text-base">{title}</Text>
    </Pressable>
  );
};

export default function ChatbotScreen() {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { messages, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl("/api/chat"),
    }),
    onError: (error) => console.error(error, "ERROR"),
  });

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener("keyboardWillShow", () => {
      setKeyboardVisible(true);
    });
    const keyboardWillHide = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardVisible(false);
    });

    const keyboardDidShow = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  if (error) return <Text>{error.message}</Text>;

  const handleSendMessage = () => {
    if (input.trim().length > 0) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text className="text-[32px] font-extrabold text-black mb-1 -tracking-tight">
            Chatbot
          </Text>
          <Text className="text-base text-[#71717A] mb-6">
            AI-powered assistant
          </Text>
        </View>

        {/* Messages List */}
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item.role === "user") {
                return (
                  <View className="mb-4 items-end">
                    <View className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#006FEE]">
                      <Text className="text-sm font-semibold mb-1 text-white">
                        You
                      </Text>
                      {item.parts.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            <Text
                              key={`${item.id}-${i}`}
                              className="text-base text-white"
                            >
                              {part.text}
                            </Text>
                          );
                        }
                        return null;
                      })}
                    </View>
                  </View>
                );
              }

              // AI message - full width, no bubble
              return (
                <View className="mb-4">
                  <Text className="text-sm font-semibold mb-2 text-[#71717A]">
                    AI
                  </Text>
                  {item.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <View
                          key={`${item.id}-${i}`}
                          className="mb-2"
                        >
                          <MessageRenderer
                            role="assistant"
                            content={part.text}
                          />
                        </View>
                      );
                    }
                    if (part.type === "reasoning") {
                      return (
                        <View
                          key={`${item.id}-${i}`}
                          className="mb-2 p-3 bg-[#E4E4E7] rounded-lg border border-[#D4D4D8]"
                        >
                          <Text className="text-xs font-semibold text-[#71717A] mb-1">
                            💭 Thinking
                          </Text>
                          <Text className="text-sm text-[#52525B] italic leading-5">
                            {part.text}
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })}
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="items-center justify-center pt-10 opacity-50">
                <Text className="text-base text-[#71717A]">
                  Start a conversation!
                </Text>
              </View>
            }
          />
        </View>

        {/* Input Section */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: keyboardVisible ? 10 : 50,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className={`flex-1 rounded-2xl px-4 h-14 justify-center border-2 ${
                isFocused
                  ? "bg-white border-[#006FEE]"
                  : "bg-[#F4F4F5] border-transparent"
              }`}
            >
              <TextInput
                className="text-base text-[#3F3F46] h-full"
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                placeholderTextColor="#71717A"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onSubmitEditing={handleSendMessage}
              />
            </View>
            <HeroButton title="Send" onPress={handleSendMessage} />
          </View>
        </View>
      </KeyboardAvoidingView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
