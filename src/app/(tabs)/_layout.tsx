import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(diary)">
        <Label>Diary</Label>
        <Icon sf="book.fill" drawable="custom_android_drawable" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="todo">
        <Icon sf="gear" drawable="custom_settings_drawable" />
        <Label>Todo</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chatbot">
        <Icon sf="person" drawable="custom_settings_drawable" />
        <Label>Chatbot</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
