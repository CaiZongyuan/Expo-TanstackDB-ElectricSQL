import type { BridgeState, EditorBridge } from "@10play/tentap-editor";
import type { ToolbarButton } from "./toolbar-types";

export const MAIN_TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    id: "bold",
    label: "B",
    action: (e: EditorBridge) => e.toggleBold(),
    getActive: (s: BridgeState) => s.isBoldActive,
    getDisabled: (s: BridgeState) => !s.canToggleBold,
  },
  {
    id: "italic",
    label: "I",
    action: (e: EditorBridge) => e.toggleItalic(),
    getActive: (s: BridgeState) => s.isItalicActive,
    getDisabled: (s: BridgeState) => !s.canToggleItalic,
  },
  {
    id: "underline",
    label: "U",
    action: (e: EditorBridge) => e.toggleUnderline(),
    getActive: (s: BridgeState) => s.isUnderlineActive,
    getDisabled: (s: BridgeState) => !s.canToggleUnderline,
  },
  {
    id: "strikethrough",
    label: "S",
    action: (e: EditorBridge) => e.toggleStrike(),
    getActive: (s: BridgeState) => s.isStrikeActive,
    getDisabled: (s: BridgeState) => !s.canToggleStrike,
  },
  {
    id: "link",
    label: "🔗",
    action: () => {},
    getActive: (s: BridgeState) => s.isLinkActive,
    getDisabled: (s: BridgeState) => !s.isLinkActive && !s.canSetLink,
  },
  {
    id: "taskList",
    label: "☑️",
    action: (e: EditorBridge) => e.toggleTaskList(),
    getActive: (s: BridgeState) => s.isTaskListActive,
    getDisabled: (s: BridgeState) => !s.canToggleTaskList,
  },
  {
    id: "heading",
    label: "H",
    action: () => {},
    getActive: () => false,
    getDisabled: (s: BridgeState) => !s.canToggleHeading,
  },

  {
    id: "code",
    label: "</>",
    action: (e: EditorBridge) => e.toggleCode(),
    getActive: (s: BridgeState) => s.isCodeActive,
    getDisabled: (s: BridgeState) => !s.canToggleCode,
  },

  {
    id: "blockquote",
    label: '"',
    action: (e: EditorBridge) => e.toggleBlockquote(),
    getActive: (s: BridgeState) => s.isBlockquoteActive,
    getDisabled: (s: BridgeState) => !s.canToggleBlockquote,
  },

  {
    id: "bulletList",
    label: "•",
    action: (e: EditorBridge) => e.toggleBulletList(),
    getActive: (s: BridgeState) => s.isBulletListActive,
    getDisabled: (s: BridgeState) => !s.canToggleBulletList,
  },
  {
    id: "orderedList",
    label: "1.",
    action: (e: EditorBridge) => e.toggleOrderedList(),
    getActive: (s: BridgeState) => s.isOrderedListActive,
    getDisabled: (s: BridgeState) => !s.canToggleOrderedList,
  },
  {
    id: "sink",
    label: "→",
    action: (e: EditorBridge, s: BridgeState) =>
      s.canSink ? e.sink() : e.sinkTaskListItem(),
    getActive: () => false,
    getDisabled: (s: BridgeState) => !s.canSink && !s.canSinkTaskListItem,
  },
  {
    id: "lift",
    label: "←",
    action: (e: EditorBridge, s: BridgeState) =>
      s.canLift ? e.lift() : e.liftTaskListItem(),
    getActive: () => false,
    getDisabled: (s: BridgeState) => !s.canLift && !s.canLiftTaskListItem,
  },
  {
    id: "undo",
    label: "↶",
    action: (e: EditorBridge) => e.undo(),
    getActive: () => false,
    getDisabled: (s: BridgeState) => !s.canUndo,
  },
  {
    id: "redo",
    label: "↷",
    action: (e: EditorBridge) => e.redo(),
    getActive: () => false,
    getDisabled: (s: BridgeState) => !s.canRedo,
  },
];

export const HEADING_BUTTONS: ToolbarButton[] = [
  {
    id: "back",
    label: "←",
    action: () => {}, // 返回主工具栏
    getActive: () => false,
    getDisabled: () => false,
  },
  {
    id: "h1",
    label: "H1",
    action: (e: EditorBridge) => e.toggleHeading(1),
    getActive: (s: BridgeState) => s.headingLevel === 1,
    getDisabled: (s: BridgeState) => !s.canToggleHeading,
  },
  {
    id: "h2",
    label: "H2",
    action: (e: EditorBridge) => e.toggleHeading(2),
    getActive: (s: BridgeState) => s.headingLevel === 2,
    getDisabled: (s: BridgeState) => !s.canToggleHeading,
  },
  {
    id: "h3",
    label: "H3",
    action: (e: EditorBridge) => e.toggleHeading(3),
    getActive: (s: BridgeState) => s.headingLevel === 3,
    getDisabled: (s: BridgeState) => !s.canToggleHeading,
  },
  {
    id: "h4",
    label: "H4",
    action: (e: EditorBridge) => e.toggleHeading(4),
    getActive: (s: BridgeState) => s.headingLevel === 4,
    getDisabled: (s: BridgeState) => !s.canToggleHeading,
  },
  {
    id: "h5",
    label: "H5",
    action: (e: EditorBridge) => e.toggleHeading(5),
    getActive: (s: BridgeState) => s.headingLevel === 5,
    getDisabled: (s: BridgeState) => !s.canToggleHeading,
  },
  {
    id: "h6",
    label: "H6",
    action: (e: EditorBridge) => e.toggleHeading(6),
    getActive: (s: BridgeState) => s.headingLevel === 6,
    getDisabled: (s: BridgeState) => !s.canToggleHeading,
  },
];
