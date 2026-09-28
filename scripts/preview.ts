#!/usr/bin/env bun
/**
 * Render the board headlessly and write three artefacts to `preview/`:
 *
 *   preview.txt   plain text, for diffing and for reading in a terminal
 *   preview.ans   truecolor ANSI, for `cat` in a capable terminal
 *   preview.svg   a faithful picture, for docs / web / image viewers
 *
 * The simulation clock is pinned, so the output is byte-for-byte reproducible.
 *
 *   bun run preview
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { TextAttributes, type CapturedFrame, type CapturedSpan } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createKanbanApp, type KanbanApp } from "../src/app"
import { createBoard } from "../src/board"
import { theme } from "../src/theme"

const WIDTH = Number(process.env.WIDTH ?? 110)
const HEIGHT = Number(process.env.HEIGHT ?? 34)
const OUT_DIR = resolve(import.meta.dir, "..", "preview")

// A fixed start time keeps the clock and every "x ago" label stable.
const START_AT = Date.UTC(2026, 8, 27, 14, 32, 5)

// Cell metrics for the SVG output (roughly a 13px monospace font on an 18px line).
const FONT_STACK =
  '"Cascadia Mono","JetBrains Mono","Fira Code","SF Mono",Menlo,Consolas,monospace'
const CELL_W = 8.4
const CELL_H = 18
const PAD = 14

const setup = await createTestRenderer({
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: theme.bg,
})

let app: KanbanApp | undefined

try {
  const clock = () => START_AT
  const board = createBoard({ now: clock })
  app = createKanbanApp(setup.renderer, board, { now: clock })
  setup.renderer.root.add(app.root)

  // Stage a little activity so the snapshot shows the board in motion:
  // ship two cards from In Progress, then compose a new card in To-do.
  app.focusColumn(1)
  app.moveSelected("done")
  app.moveSelected("done")
  app.focusColumn(-1)
  app.moveSelection(1)
  app.openComposer("Polish the launch checklist")

  await setup.renderOnce()
  const frame = setup.captureSpans()

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, "preview.txt"), `${setup.captureCharFrame()}\n`, "utf8")
  writeFileSync(resolve(OUT_DIR, "preview.ans"), toAnsi(frame), "utf8")
  writeFileSync(resolve(OUT_DIR, "preview.svg"), toSvg(frame), "utf8")

  console.log(`rendered ${frame.cols}x${frame.rows} · wrote preview/preview.txt, preview/preview.ans, preview/preview.svg`)
} finally {
  // Stop the app's toast/flash timers before the renderables go away.
  app?.destroy()
  setup.renderer.destroy()
}

// ------------------------------------------------------------------ helpers

function rgb(color: { toInts(): [number, number, number, number] }): string {
  const [r, g, b] = color.toInts()
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

function toAnsi(frame: CapturedFrame): string {
  const out: string[] = []
  for (const line of frame.lines) {
    for (const span of line.spans) {
      if (span.text.length === 0) continue
      const codes = [
        "0",
        ...(span.attributes & TextAttributes.BOLD ? ["1"] : []),
        ...(span.attributes & TextAttributes.DIM ? ["2"] : []),
        ...(span.attributes & TextAttributes.ITALIC ? ["3"] : []),
        ...(span.attributes & TextAttributes.UNDERLINE ? ["4"] : []),
        `38;2;${hexToRgb(span.fg)}`,
        `48;2;${hexToRgb(span.bg)}`,
      ]
      out.push(`\x1b[${codes.join(";")}m`, span.text, "\x1b[0m")
    }
    out.push("\x1b[0m\n")
  }
  return out.join("")
}

function hexToRgb(color: { toInts(): [number, number, number, number] }): string {
  const [r, g, b] = color.toInts()
  return `${r};${g};${b}`
}

function toSvg(frame: CapturedFrame): string {
  const width = frame.cols * CELL_W + PAD * 2
  const height = frame.rows * CELL_H + PAD * 2
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" ` +
      `viewBox="0 0 ${round(width)} ${round(height)}">`,
  )
  parts.push(`<rect width="100%" height="100%" fill="${theme.bg}"/>`)

  frame.lines.forEach((line, row) => {
    let col = 0
    for (const span of line.spans) {
      const spanWidth = cellWidth(span)
      const x = PAD + col * CELL_W
      const y = PAD + row * CELL_H

      // Paint the cell background first so card fills and keycaps show up.
      const [, , , alpha] = span.bg.toInts()
      if (alpha > 0) {
        parts.push(
          `<rect x="${round(x)}" y="${round(y)}" width="${round(spanWidth)}" height="${CELL_H}" fill="${rgb(
            span.bg,
          )}"${alpha < 255 ? ` fill-opacity="${round(alpha / 255)}"` : ""}/>`,
        )
      }

      if (span.text.trim().length > 0) {
        if (span.attributes & TextAttributes.UNDERLINE) {
          parts.push(
            `<rect x="${round(x)}" y="${round(y + CELL_H - 3)}" width="${round(spanWidth)}" height="1" fill="${rgb(
              span.fg,
            )}"/>`,
          )
        }
        if (span.attributes & TextAttributes.STRIKETHROUGH) {
          parts.push(
            `<rect x="${round(x)}" y="${round(y + CELL_H / 2)}" width="${round(spanWidth)}" height="1" fill="${rgb(
              span.fg,
            )}"/>`,
          )
        }

        parts.push(
          `<text x="${round(x)}" y="${round(y + CELL_H * 0.75)}" fill="${rgb(span.fg)}" ` +
            `xml:space="preserve" ` +
            `font-family='${FONT_STACK}' font-size="13" ` +
            `${span.attributes & TextAttributes.BOLD ? 'font-weight="700"' : 'font-weight="400"'} ` +
            `${span.attributes & TextAttributes.ITALIC ? 'font-style="italic"' : ""} ` +
            `${span.attributes & TextAttributes.DIM ? 'opacity="0.6"' : ""}>` +
            `${escapeXml(span.text)}</text>`,
        )
      }
      col += cellWidth(span)
    }
  })

  parts.push("</svg>")
  return parts.join("\n")
}

function cellWidth(span: CapturedSpan): number {
  return span.width > 0 ? span.width : 1
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
