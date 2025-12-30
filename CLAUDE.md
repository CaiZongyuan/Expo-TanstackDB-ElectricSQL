# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Expo React Native app that appears to be a diary/journal application with a rich text editor. The project name mentions "TanstackDB" and "ElectricSQL" suggesting these may be planned integrations for data management and sync.

## Commands

### Development
```bash
bun install          # Install dependencies
bunx expo start     # Start Expo dev server (npx expo start)
bun run android      # Start with Android emulator
bun run ios          # Start with iOS simulator
bun run web          # Start web version
```

## Architecture

### Rich Text Editor (Tentap)
The core feature is a rich text editor built with `@10play/tentap-editor`:

**Components:**
- `src/components/tentap-editor.tsx` - Main editor wrapper using `useEditorBridge`
- `src/components/glass-toolbar.tsx` - Glassmorphic toolbar that appears when keyboard is shown
  - Supports multiple contexts: Main, Heading, Link
  - Context-aware button states (active/disabled)
  - Uses `expo-glass-effect` for glassmorphism UI
  - Only renders when keyboard is visible (keyboardHeight > 0)
- `src/components/toolbar-buttons.ts` - Button definitions (MAIN_TOOLBAR_BUTTONS, HEADING_BUTTONS)
- `src/components/toolbar-types.ts` - TypeScript types for toolbar system

**Toolbar System:**
Each toolbar button has:
- `id`, `label`, `icon`
- `action(editor, state)` - Execute command
- `getActive(state)` - Check if format is active
- `getDisabled(state)` - Check if command is available

### Styling
- **Tailwind CSS v4** via `tailwindcss` package
- **Uniwind** - React Native-specific Tailwind (metro.config.js integration)
- **HeroUI Native** - UI component library (`heroui-native`)
- **Glassmorphism** - `expo-glass-effect` for frosted glass UI
- Class names work via Uniwind's runtime (see `.vscode/settings.json` for configured attributes)

### Provider Stack
Root layout (`src/app/_layout.tsx`) wraps app with:
1. `GestureHandlerRootView` - For react-native-gesture-handler
2. `HeroUINativeProvider` - HeroUI context

## Code Quality Requirements

**CRITICAL:** After completing any coding work and before delivering, you MUST run the following checks:

```bash
# Type checking
bun run tsc --noEmit

# Linting
bun run lint
```

Both commands must pass with no errors before considering the work complete. If there are any TypeScript or ESLint errors, fix them before delivery.

## Git Commit Guidelines

After completing a meaningful amount of work (e.g., new feature, bug fix, refactor), you may recommend creating a git commit. The process should be:

1. **Recommend commit** - Suggest creating a commit when significant work is complete
2. **Run pre-commit review** - Before generating commit message, run the Linus-style code review:
   - Use the `/pre-commit-review` skill to check staged changes
   - This will review code for errors, performance issues, and code quality problems
   - Fix any critical issues found before proceeding
3. **Generate commit message** - If user agrees, generate an English commit message following conventional commit format:
   - Use format: `type: description`
   - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
   - Write clear, concise descriptions focusing on "why" rather than "what"
   - **IMPORTANT**: Do NOT include Claude Code attribution or "Co-Authored-By" tags
4. **Create commit** - If user approves the message, create the commit using standard git commands

### Pre-Commit Review Skill

The project includes a `pre-commit-review` skill that performs Linus Torvalds-style code review:
- **Brutally honest** feedback on code quality
- Checks for: errors, performance issues, bad patterns, security vulnerabilities
- React/React Native specific: missing dependencies, state mutations, memory leaks
- TypeScript specific: `any` types, missing types, improper assertions

Run it before committing:
```
/pre-commit-review
```

Example commit message format:
```
feat: Add component name and description

- Detail 1
- Detail 2

Additional context about the change.
```
