#!/usr/bin/env bun
/**
 * Flow — a kanban board for the terminal, built with OpenTUI.
 *
 *   bun run start
 *
 * Keys:
 *   ←/→ or h/l   switch column
 *   ↑/↓ or k/j   select a card
 *   n            new card (created in To-do)
 *   p            move the selected card to In Progress
 *   d            move the selected card to Done
 *   t            move the selected card back to To-do
 *   x / del      delete the selected card
 *   q / ctrl+c   quit
 */
import { createCliRenderer } from "@opentui/core"
import { createKanbanApp } from "./src/app"
import { createBoard, defaultBoardPath } from "./src/board"
import { theme } from "./src/theme"

// Load before the renderer takes over the terminal, so a bad file is reported plainly.
let board: ReturnType<typeof createBoard>
try {
  board = createBoard({ path: defaultBoardPath() })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  backgroundColor: theme.bg,
  targetFps: 30,
  consoleMode: "console-overlay",
})

const app = createKanbanApp(renderer, board)
renderer.root.add(app.root)

renderer.setTerminalTitle("Flow · kanban board")

// Keeps the clock, ages and toast timers honest.
const clock = setInterval(() => app.refresh(), 1000)

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(clock)
  app.destroy()
  renderer.destroy()
}

// A failed save surfaces here (from a keypress or the composer's enter). Stop
// rather than let the user keep editing a board that isn't being saved.
process.on("uncaughtException", (error) => {
  shutdown()
  console.error(`kanban-tui stopped: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})

renderer.keyInput.on("keypress", (key) => {
  const result = app.handleKey(key)
  // Consume keys the board handled so they don't also reach a focused input.
  if (result !== "ignored") key.preventDefault()
  if (result === "quit") shutdown()
})

renderer.on("resize", () => app.refresh())

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
