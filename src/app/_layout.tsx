import "@/global.css";
import { Slot } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-random-uuid";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <Slot />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
