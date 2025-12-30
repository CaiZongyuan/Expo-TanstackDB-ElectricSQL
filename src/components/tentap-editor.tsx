import { RichText, useEditorBridge } from "@10play/tentap-editor";
import { View } from "react-native";
import { GlassToolbar } from "./glass-toolbar";

export const TentapEditor = () => {
  const initialContent = `<p>This is a basic example!</p>`;

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent,
  });

  return (
    <View className="flex-1">
      <RichText editor={editor} />
      <GlassToolbar editor={editor} initiallyVisible={true} />
    </View>
  );
};
