import { afterEach, expect, test } from "bun:test"
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { createKanbanApp, type KanbanApp } from "./app"
import { createBoard } from "./board"
import { theme } from "./theme"

let setup: TestRendererSetup | undefined
let app: KanbanApp | undefined

afterEach(() => {
  app?.destroy()
  setup?.renderer.destroy()
  setup = app = undefined
})

test("frees old cards on every redraw (no native memory leak)", async () => {
  setup = await createTestRenderer({ width: 110, height: 34, backgroundColor: theme.bg })
  // In-memory board seeded with sample cards; nothing is written to disk.
  app = createKanbanApp(setup.renderer, createBoard({ now: () => Date.UTC(2026, 8, 27) }))
  setup.renderer.root.add(app.root)
  await setup.renderOnce()

  const before = app.root.findDescendantById("K-01")
  expect(before).toBeDefined()
  app.moveSelection(1)
  const after = app.root.findDescendantById("K-01")
  expect(after).toBeDefined()
  expect(after).not.toBe(before)
  // The replaced card, and the text buffers inside it, must be destroyed, not just detached.
  expect(before!.isDestroyed).toBe(true)
})
