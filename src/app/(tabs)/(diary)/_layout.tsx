import { router, Stack } from "expo-router";
import { Button } from "react-native";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTransparent: true,
          headerTitle: "DiaryList",
          headerRight: () => (
            <Button onPress={() => router.push("/(diary)/new")} title="New" />
          ),
        }}
      />
    </Stack>
  );
}
