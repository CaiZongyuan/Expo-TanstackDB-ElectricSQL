import { useBridgeState } from "@10play/tentap-editor";
import { GlassContainer, GlassView } from "expo-glass-effect";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { HEADING_BUTTONS, MAIN_TOOLBAR_BUTTONS } from "./toolbar-buttons";
import { GlassToolbarProps, ToolbarContext } from "./toolbar-types";

export const GlassToolbar = ({ editor }: GlassToolbarProps) => {
  const [context, setContext] = useState<ToolbarContext>(ToolbarContext.Main);
  const [linkUrl, setLinkUrl] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const editorState = useBridgeState(editor);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Get current context buttons
  const getCurrentButtons = () => {
    switch (context) {
      case ToolbarContext.Heading:
        return HEADING_BUTTONS;
      case ToolbarContext.Main:
      default:
        return MAIN_TOOLBAR_BUTTONS;
    }
  };

  // Deal with button click
  const handleButtonPress = (button: (typeof MAIN_TOOLBAR_BUTTONS)[0]) => {
    // Deal with special buttons
    if (button.id === "heading") {
      setContext(ToolbarContext.Heading);
      return;
    }

    if (button.id === "link") {
      setLinkUrl(editorState.activeLink || "");
      setContext(ToolbarContext.Link);
      return;
    }

    if (button.id === "back") {
      setContext(ToolbarContext.Main);
      return;
    }

    // Deal with button actions
    button.action(editor, editorState);
  };

  if (keyboardHeight === 0) return null;

  return (
    <Animated.View
      style={[
        styles.toolbarWrapper,
        {
          bottom: keyboardHeight - 40,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <GlassContainer spacing={10} style={styles.container}>
        <GlassView style={styles.toolbarContainer} isInteractive>
          {/* Link edit context */}
          {context === ToolbarContext.Link && (
            <LinkEditBar
              linkUrl={linkUrl}
              onLinkUrlChange={setLinkUrl}
              onSave={() => {
                editor.setLink(linkUrl);
                editor.focus();
                setContext(ToolbarContext.Main);
              }}
              onCancel={() => {
                setContext(ToolbarContext.Main);
                editor.focus();
              }}
            />
          )}

          <FlatList
            data={getCurrentButtons()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarContent}
            keyExtractor={(item) => item.id}
            renderItem={({ item: button }) => {
              const isActive = button.getActive(editorState);
              const isDisabled = button.getDisabled(editorState);

              return (
                <TouchableOpacity
                  onPress={() => handleButtonPress(button)}
                  disabled={isDisabled}
                  style={styles.touchableWrapper}
                  activeOpacity={0.7}
                >
                  <GlassView
                    style={[
                      styles.glassButton,
                      isActive && styles.activeGlassButton,
                      isDisabled && styles.disabledButton,
                    ]}
                    isInteractive
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isActive && styles.activeText,
                        isDisabled && styles.disabledText,
                      ]}
                    >
                      {button.label}
                    </Text>
                  </GlassView>
                </TouchableOpacity>
              );
            }}
          />
        </GlassView>
      </GlassContainer>
    </Animated.View>
  );
};

// Link edit bar component
const LinkEditBar = ({
  linkUrl,
  onLinkUrlChange,
  onSave,
  onCancel,
}: {
  linkUrl: string;
  onLinkUrlChange: (url: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <View style={styles.linkEditBar}>
    <TextInput
      style={styles.linkInput}
      value={linkUrl}
      onChangeText={onLinkUrlChange}
      placeholder="Type link ..."
      placeholderTextColor="rgba(0, 0, 0, 0.5)"
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
    />
    <TouchableOpacity onPress={onSave} style={styles.linkActionButton}>
      <GlassView isInteractive style={styles.linkActionGlassButton}>
        <Text style={styles.linkActionText}>✓</Text>
      </GlassView>
    </TouchableOpacity>
    <TouchableOpacity onPress={onCancel} style={styles.linkActionButton}>
      <GlassView isInteractive style={styles.linkActionGlassButton}>
        <Text style={styles.linkActionText}>✕</Text>
      </GlassView>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  toolbarWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 35,
    overflow: "hidden",
  },
  toolbarContainer: {
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 10,
  },
  toolbarContent: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 5,
  },
  touchableWrapper: {
    width: 40,
    height: 40,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  activeGlassButton: {
    backgroundColor: "#FFD700",
    transform: [{ scale: 1.1 }],
  },
  disabledButton: {
    opacity: 0.3,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  activeText: {
    fontWeight: "700",
  },
  disabledText: {
    color: "#666",
  },
  toggleButton: {
    position: "absolute",
    right: 20,
    width: 50,
    height: 50,
  },
  toggleGlassButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  linkEditBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 10,
  },
  linkInput: {
    flex: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#000",
  },
  linkActionButton: {
    width: 35,
    height: 35,
  },
  linkActionGlassButton: {
    width: 35,
    height: 35,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  linkActionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
});
