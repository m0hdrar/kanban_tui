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
 *   space        cycle the selected card's priority (medium → high → low)
 *   x / del      delete the selected card
 *   o            projects: switch, create (+ new project), rename (r), delete (x twice)
 *   c            pick a colour theme, or follow herdr's (remembered between sessions)
 *   q / ctrl+c   quit
 *
 *   bun run start add|list|move|rm|status|projects|project   commands for scripts and agents (see src/cli.ts)
 */
import { createBoard, defaultBoardPath } from "./src/board"

// Any argument runs a one-shot command instead of the board; the UI isn't loaded.
const args = process.argv.slice(2)
if (args.length > 0) {
  const { runCommand } = await import("./src/cli")
  try {
    console.log(runCommand(createBoard({ path: defaultBoardPath() }), args))
  } catch (error) {
    // An unreadable board just leaves the status line empty.
    if (args[0] !== "status") {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }
  process.exit(0)
}

const { createCliRenderer } = await import("@opentui/core")
const { createKanbanApp } = await import("./src/app")
const { loadSavedTheme, syncHerdrTheme, theme } = await import("./src/theme")
loadSavedTheme()

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
  // Opening the debug console allocates a full-width buffer; if an error came
  // from native memory running out, that allocation fails too and hides the cause.
  openConsoleOnError: false,
})

const app = createKanbanApp(renderer, board)
renderer.root.add(app.root)

renderer.setTerminalTitle("Flow · kanban board")

// Keeps the clock, ages and toast timers honest, and shows cards that agents
// add from other panes (`kanban-tui add`) within a second.
const clock = setInterval(() => {
  app.syncBoard()
  // ponytail: re-reads herdr's config every tick while following it; it's tiny
  if (syncHerdrTheme()) app.applyTheme()
  app.refresh()
}, 1000)

let shuttingDown = false

/** Terminal modes the renderer turns on: mouse tracking, alternate screen, hidden cursor. */
const RESET_TERMINAL =
  "\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?2004l\x1b[?1049l\x1b[?25h\x1b[0m"

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(clock)
  // Each step is guarded: after a fatal error the renderer itself may fail to
  // clean up, and the terminal must never be left sending mouse codes.
  try {
    app.destroy()
  } catch {}
  try {
    renderer.destroy()
  } catch {}
  try {
    process.stdout.write(RESET_TERMINAL)
  } catch {}
}

// A failed save surfaces here (from a keypress or the composer's enter). Stop
// rather than let the user keep editing a board that isn't being saved.
function fatal(error: unknown) {
  shutdown()
  console.error(`kanban-tui stopped: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
process.on("uncaughtException", fatal)
process.on("unhandledRejection", fatal)

renderer.keyInput.on("keypress", (key) => {
  const result = app.handleKey(key)
  // Consume keys the board handled so they don't also reach a focused input.
  if (result !== "ignored") key.preventDefault()
  if (result === "quit") shutdown()
})

renderer.on("resize", () => app.applyTheme())

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
