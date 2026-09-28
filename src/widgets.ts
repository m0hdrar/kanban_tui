import { StyledText, bg, fg, type TextChunk } from "@opentui/core"
import { clamp01 } from "./format"
import { theme } from "./theme"

/** Concatenate styled chunks (and whole StyledTexts) into a single StyledText. */
export function joinChunks(parts: Array<TextChunk | StyledText>): StyledText {
  const chunks: TextChunk[] = []
  for (const part of parts) {
    if (part instanceof StyledText) chunks.push(...part.chunks)
    else chunks.push(part)
  }
  return new StyledText(chunks)
}

const BAR_FILLED = "█"
const BAR_EMPTY = "░"

/** `████████░░░░░░░░` — a filled-proportion bar. */
export function progressBar(ratio: number, width: number, color: string): StyledText {
  const filled = Math.round(clamp01(ratio) * width)
  return joinChunks([
    fg(color)(BAR_FILLED.repeat(filled)),
    fg(theme.borderSoft)(BAR_EMPTY.repeat(Math.max(0, width - filled))),
  ])
}

export interface KeyHint {
  key: string
  action: string
}

/** Keycap-style legend: ` n  new   p  progress  …`. */
export function keyHints(hints: KeyHint[]): StyledText {
  const chunks: TextChunk[] = []
  hints.forEach((hint, index) => {
    if (index > 0) chunks.push(fg(theme.textFaint)("  "))
    chunks.push(bg(theme.accentDim)(fg(theme.text)(hint.key)))
    chunks.push(fg(theme.textDim)(` ${hint.action}`))
  })
  return joinChunks(chunks)
}
