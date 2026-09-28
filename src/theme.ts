/**
 * Palette for Flow, the kanban board.
 *
 * One deep ink surface, a violet brand accent, and a single saturated hue per
 * column so the board reads at a glance. Everything is a hex string so it can
 * be dropped into any OpenTUI colour slot.
 */
import type { ColumnId, Priority } from "./board"

export const theme = {
  // surfaces
  bg: "#0A0D16",
  panel: "#0F141F",
  panelFocused: "#121A2B",
  card: "#131A28",
  cardSelected: "#1D2745",
  composer: "#101A2E",

  // lines
  border: "#222B3F",
  borderSoft: "#19202F",
  borderFocus: "#7C8CF8",

  // type
  text: "#E9EFF9",
  textDim: "#93A0B8",
  textFaint: "#5A6579",

  // brand
  accent: "#7C8CF8",
  accentDim: "#384072",

  // columns
  todo: "#56C8FF",
  progress: "#FFC24B",
  done: "#4ADE80",

  // state
  ok: "#4ADE80",
  danger: "#FF6B8A",
  warn: "#FFC24B",
  info: "#56C8FF",
} as const

export const columnLabel: Record<ColumnId, string> = {
  todo: "To-do",
  progress: "In Progress",
  done: "Done",
}

export const priorityColor: Record<Priority, string> = {
  high: theme.danger,
  medium: theme.warn,
  low: theme.info,
}

export const priorityLabel: Record<Priority, string> = {
  high: "high",
  medium: "medium",
  low: "low",
}
