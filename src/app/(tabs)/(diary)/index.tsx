import { Link } from "expo-router";
import { View } from "react-native";

export default function DiaryList() {
  return (
    <View className="flex-1 items-center justify-center">
      <Link href="./1" className="text-2xl">
        Diary 1
      </Link>
    </View>
  );
}
