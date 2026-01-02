import React from "react";
import { useMarkdown } from "react-native-marked";

interface MessageProps {
  role: "user" | "assistant";
  content: string;
}

export const MessageRenderer: React.FC<MessageProps> = ({ role, content }) => {
  const markdownElements = useMarkdown(content, {});

  return <>{markdownElements}</>;
};
