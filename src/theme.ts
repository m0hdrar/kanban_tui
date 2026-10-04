/**
 * Palettes for Flow, the kanban board.
 *
 * Each theme is one surface family, a brand accent, and a single saturated hue
 * per column so the board reads at a glance. Everything is a hex string so it
 * can be dropped into any OpenTUI colour slot.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { defaultBoardPath, type ColumnId, type Priority } from "./board"

export type Palette = Record<
  | "bg" | "panel" | "panelFocused" | "card" | "cardSelected" | "composer"
  | "border" | "borderSoft" | "borderFocus"
  | "text" | "textDim" | "textFaint"
  | "accent" | "accentDim"
  | ColumnId
  | "ok" | "danger" | "warn" | "info",
  string
>

export const themes = {
  flow: {
    bg: "#0A0D16", panel: "#0F141F", panelFocused: "#121A2B", card: "#131A28", cardSelected: "#1D2745", composer: "#101A2E",
    border: "#222B3F", borderSoft: "#19202F", borderFocus: "#7C8CF8",
    text: "#E9EFF9", textDim: "#93A0B8", textFaint: "#5A6579",
    accent: "#7C8CF8", accentDim: "#384072",
    todo: "#56C8FF", progress: "#FFC24B", done: "#4ADE80",
    ok: "#4ADE80", danger: "#FF6B8A", warn: "#FFC24B", info: "#56C8FF",
  },
  vesper: {
    bg: "#101010", panel: "#141414", panelFocused: "#1A1A1A", card: "#1C1C1C", cardSelected: "#282828", composer: "#181818",
    border: "#343434", borderSoft: "#232323", borderFocus: "#FFC799",
    text: "#FFFFFF", textDim: "#A0A0A0", textFaint: "#5C5C5C",
    accent: "#FFC799", accentDim: "#4A3A2C",
    todo: "#99FFE4", progress: "#FFC799", done: "#99FFE4",
    ok: "#99FFE4", danger: "#FF8080", warn: "#FFC799", info: "#A0A0A0",
  },
  tokyonight: {
    bg: "#1A1B26", panel: "#1F2030", panelFocused: "#24283B", card: "#24283B", cardSelected: "#2F3549", composer: "#222436",
    border: "#3B4261", borderSoft: "#292E42", borderFocus: "#7AA2F7",
    text: "#C0CAF5", textDim: "#A9B1D6", textFaint: "#565F89",
    accent: "#7AA2F7", accentDim: "#3D59A1",
    todo: "#7DCFFF", progress: "#E0AF68", done: "#9ECE6A",
    ok: "#9ECE6A", danger: "#F7768E", warn: "#E0AF68", info: "#7DCFFF",
  },
  catppuccin: {
    bg: "#1E1E2E", panel: "#181825", panelFocused: "#232336", card: "#313244", cardSelected: "#45475A", composer: "#11111B",
    border: "#45475A", borderSoft: "#313244", borderFocus: "#CBA6F7",
    text: "#CDD6F4", textDim: "#A6ADC8", textFaint: "#6C7086",
    accent: "#CBA6F7", accentDim: "#585B70",
    todo: "#89B4FA", progress: "#F9E2AF", done: "#A6E3A1",
    ok: "#A6E3A1", danger: "#F38BA8", warn: "#FAB387", info: "#89DCEB",
  },
  gruvbox: {
    bg: "#1D2021", panel: "#282828", panelFocused: "#32302F", card: "#3C3836", cardSelected: "#504945", composer: "#32302F",
    border: "#504945", borderSoft: "#3C3836", borderFocus: "#FE8019",
    text: "#EBDBB2", textDim: "#BDAE93", textFaint: "#7C6F64",
    accent: "#FE8019", accentDim: "#665C54",
    todo: "#83A598", progress: "#FABD2F", done: "#B8BB26",
    ok: "#B8BB26", danger: "#FB4934", warn: "#FABD2F", info: "#83A598",
  },
  nord: {
    bg: "#2E3440", panel: "#323946", panelFocused: "#3B4252", card: "#3B4252", cardSelected: "#434C5E", composer: "#3B4252",
    border: "#4C566A", borderSoft: "#434C5E", borderFocus: "#88C0D0",
    text: "#ECEFF4", textDim: "#D8DEE9", textFaint: "#7B88A1",
    accent: "#88C0D0", accentDim: "#4C566A",
    todo: "#81A1C1", progress: "#EBCB8B", done: "#A3BE8C",
    ok: "#A3BE8C", danger: "#BF616A", warn: "#D08770", info: "#81A1C1",
  },
  "rose-pine": {
    bg: "#191724", panel: "#1F1D2E", panelFocused: "#232136", card: "#26233A", cardSelected: "#393552", composer: "#1F1D2E",
    border: "#403D52", borderSoft: "#2A273F", borderFocus: "#C4A7E7",
    text: "#E0DEF4", textDim: "#908CAA", textFaint: "#6E6A86",
    accent: "#C4A7E7", accentDim: "#524F67",
    todo: "#9CCFD8", progress: "#F6C177", done: "#31748F",
    ok: "#9CCFD8", danger: "#EB6F92", warn: "#F6C177", info: "#9CCFD8",
  },
  dracula: {
    bg: "#21222C", panel: "#282A36", panelFocused: "#2E303E", card: "#343746", cardSelected: "#44475A", composer: "#2E303E",
    border: "#44475A", borderSoft: "#343746", borderFocus: "#BD93F9",
    text: "#F8F8F2", textDim: "#BFBFBF", textFaint: "#6272A4",
    accent: "#BD93F9", accentDim: "#4D4A6E",
    todo: "#8BE9FD", progress: "#F1FA8C", done: "#50FA7B",
    ok: "#50FA7B", danger: "#FF5555", warn: "#FFB86C", info: "#8BE9FD",
  },
} satisfies Record<string, Palette>

export type ThemeName = keyof typeof themes
export const themeNames = Object.keys(themes) as ThemeName[]

/** The live palette. Mutated in place by `setTheme`, so `theme.x` always reads the current one. */
export const theme: Palette = { ...themes.flow }
export let themeName: ThemeName = "flow"

export const columnLabel: Record<ColumnId, string> = {
  todo: "To-do",
  progress: "In Progress",
  done: "Done",
}

export const priorityColor: Record<Priority, string> = { high: "", medium: "", low: "" }

export const priorityLabel: Record<Priority, string> = {
  high: "high",
  medium: "medium",
  low: "low",
}

export function setTheme(name: ThemeName) {
  themeName = name
  Object.assign(theme, themes[name])
  Object.assign(priorityColor, { high: theme.danger, medium: theme.warn, low: theme.info })
}
setTheme("flow")

/** What the user picked: a theme, or `herdr` to follow herdr's `[theme] name`. */
export type ThemeChoice = ThemeName | "herdr"
export const themeChoices: ThemeChoice[] = ["herdr", ...themeNames]
export let themeChoice: ThemeChoice = "herdr"

const squash = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "")

/**
 * The herdr theme as one of ours (`tokyo-night` → `tokyonight`), or undefined
 * when herdr isn't configured or uses a theme Flow doesn't have.
 */
export function herdrTheme(): ThemeName | undefined {
  const dir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  let config: string
  try {
    config = readFileSync(join(dir, "herdr", "config.toml"), "utf8")
  } catch {
    return undefined
  }
  // ponytail: regex, not a TOML parser; only `name = "…"` directly under `[theme]` is read
  const name = config.match(/^\[theme\][^[]*?^\s*name\s*=\s*"([^"]*)"/m)?.[1]
  return name ? themeNames.find((n) => squash(n) === squash(name)) : undefined
}

/** Apply a choice; `herdr` resolves to herdr's theme, or flow when there's no match. */
export function chooseTheme(choice: ThemeChoice) {
  themeChoice = choice
  setTheme(choice === "herdr" ? (herdrTheme() ?? "flow") : choice)
}

/** While following herdr, pick up a theme change made there. Returns true when the theme changed. */
export function syncHerdrTheme(): boolean {
  if (themeChoice !== "herdr") return false
  const before = themeName
  chooseTheme("herdr")
  return themeName !== before
}

const themeFile = () => join(dirname(defaultBoardPath()), "theme")

/** Apply the choice saved by the last session; with none, follow herdr. */
export function loadSavedTheme() {
  let saved = "herdr"
  try {
    saved = readFileSync(themeFile(), "utf8").trim()
  } catch {} // nothing picked yet
  chooseTheme(themeChoices.includes(saved as ThemeChoice) ? (saved as ThemeChoice) : "herdr")
}

export function saveTheme() {
  mkdirSync(dirname(themeFile()), { recursive: true })
  writeFileSync(themeFile(), `${themeChoice}\n`)
}
