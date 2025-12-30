import type { BridgeState, EditorBridge } from "@10play/tentap-editor";

export enum ToolbarContext {
  Main = "main",
  Heading = "heading",
  Link = "link",
}

export interface ToolbarButton {
  id: string;
  label: string;
  icon?: string;
  action: (editor: EditorBridge, state: BridgeState) => void;
  getActive: (state: BridgeState) => boolean;
  getDisabled: (state: BridgeState) => boolean;
}

export interface GlassToolbarProps {
  editor: EditorBridge;
  initiallyVisible?: boolean;
}
