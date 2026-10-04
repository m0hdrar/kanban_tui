import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_PROJECT, createBoard, statusLine } from "./board"
import { runCommand } from "./cli"

const tempPath = () => join(mkdtempSync(join(tmpdir(), "kanban-")), "nested", "board.json")

test("a saved board survives a restart and never reuses ids", () => {
  const path = tempPath()
  const first = createBoard({ path })
  expect(first.cards).toEqual([])

  const a = first.create("Write docs")
  const b = first.create("Ship it")
  first.move(a, "done")
  first.remove(b)

  const second = createBoard({ path })
  expect(second.cards).toHaveLength(1)
  expect(second.cards[0]).toMatchObject({ id: "K-01", title: "Write docs", column: "done" })
  expect(second.create("Next").id).toBe("K-03")
})

test("a corrupt file is reported and left untouched", () => {
  const path = tempPath()
  createBoard({ path }).create("seed the file")
  writeFileSync(path, "{ not json")
  expect(() => createBoard({ path })).toThrow("left unchanged")
  expect(readFileSync(path, "utf8")).toBe("{ not json")
})

test("without a path the board is the in-memory demo", () => {
  expect(createBoard().cards.length).toBeGreaterThan(0)
})

test("status line counts open work and is empty when there is none", () => {
  expect(statusLine({ todo: 5, progress: 2, done: 9 })).toBe("Kanban 2 doing · 5 to-do")
  expect(statusLine({ todo: 0, progress: 0, done: 3 })).toBe("")
})

test("space-cycled priorities persist and sort To-do high to low", () => {
  const path = tempPath()
  const board = createBoard({ path })
  const a = board.create("A")
  board.create("B")
  const c = board.create("C")

  expect(board.cyclePriority(c)).toBe("high")
  expect(board.cyclePriority(a)).toBe("high")
  expect(board.cyclePriority(a)).toBe("low")
  expect(board.inColumn("todo").map((card) => card.title)).toEqual(["C", "B", "A"])
  expect(board.cyclePriority(a)).toBe("medium")
  expect(board.inColumn("todo").map((card) => card.title)).toEqual(["C", "A", "B"])

  expect(createBoard({ path }).inColumn("todo").map((card) => card.priority)).toEqual(["high", "medium", "medium"])
})

test("a renamed card keeps its id and the new title persists", () => {
  const path = tempPath()
  const board = createBoard({ path })
  const card = board.create("Typo titel")
  board.rename(card, "  Typo title  ")
  expect(createBoard({ path }).cards[0]).toMatchObject({ id: card.id, title: "Typo title" })
})

test("an open board keeps cards another process adds, and picks them up on sync", () => {
  const path = tempPath()
  const open = createBoard({ path })
  const mine = open.create("Mine")

  // An agent in another pane runs `kanban-tui add`.
  expect(runCommand(createBoard({ path }), ["add", "Fix", "flaky", "test", "--priority", "high"])).toBe("K-02")

  expect(open.sync()).toBe(true)
  expect(open.sync()).toBe(false)
  expect(open.cards).toContain(mine) // same object, so the UI's selection survives
  open.move(mine, "progress")

  const after = createBoard({ path })
  expect(after.cards.map((c) => [c.id, c.title, c.column, c.priority])).toEqual([
    ["K-01", "Mine", "progress", "medium"],
    ["K-02", "Fix flaky test", "todo", "high"],
  ])
  expect(after.create("Next").id).toBe("K-03")
})

test("cli lists, moves and removes cards by id", () => {
  const path = tempPath()
  const board = createBoard({ path })
  runCommand(board, ["add", "A"])
  runCommand(board, ["add", "B"])
  expect(runCommand(board, ["move", "k-01", "done"])).toBe("K-01 → done")
  expect(runCommand(board, ["list"])).toBe("K-02\ttodo\tmedium\tB")
  expect(runCommand(board, ["list", "--all"])).toContain("K-01\tdone")
  runCommand(board, ["rm", "K-02"])
  expect(createBoard({ path }).cards.map((c) => c.id)).toEqual(["K-01"])
  expect(() => runCommand(board, ["move", "K-01", "doing"])).toThrow("column must be one of")
  expect(() => runCommand(board, ["rm", "K-99"])).toThrow("no card K-99")
})

test("projects keep their own cards, and old boards land in the default project", () => {
  const path = tempPath()
  const board = createBoard({ path })
  board.create("Old card")
  // A board saved before projects existed has no project fields.
  writeFileSync(path, readFileSync(path, "utf8").replace(/,?\s*"projects?": ("[^"]*"|\[[^\]]*\])/g, ""))
  const old = createBoard({ path })
  expect(old.project).toBe(DEFAULT_PROJECT)
  expect(old.cards[0]!.project).toBe(DEFAULT_PROJECT)

  old.openProject("  Side gig ")
  expect(old.counts().todo).toBe(0)
  runCommand(old, ["add", "Invoice"])

  const reopened = createBoard({ path })
  expect(reopened.project).toBe("Side gig")
  expect(reopened.projects).toEqual([DEFAULT_PROJECT, "Side gig"])
  expect(runCommand(reopened, ["list"])).toBe("K-02\ttodo\tmedium\tInvoice")
  reopened.openProject(DEFAULT_PROJECT)
  expect(reopened.inColumn("todo").map((c) => c.title)).toEqual(["Old card"])
})

test("cli manages projects, and --project works without switching the open board", () => {
  const path = tempPath()
  const board = createBoard({ path })
  expect(runCommand(board, ["project", "add", "Side", "gig"])).toBe('added project "Side gig"')
  expect(() => runCommand(board, ["project", "add", "side GIG"])).toThrow("already exists")
  runCommand(board, ["project", "rename", "side gig", "side gig"]) // lookups ignore case; a case-only rename is fine
  expect(createBoard({ path }).projects).toEqual([DEFAULT_PROJECT, "side gig"])

  // An agent adds to another project; the board stays on General.
  expect(runCommand(createBoard({ path }), ["add", "Invoice", "--project", "Client"])).toBe("K-01")
  expect(createBoard({ path }).project).toBe(DEFAULT_PROJECT)
  expect(runCommand(createBoard({ path }), ["list", "--project", "client"])).toBe("K-01\ttodo\tmedium\tInvoice")
  expect(() => runCommand(createBoard({ path }), ["list", "--project", "Nope"])).toThrow('no project "Nope"')

  expect(runCommand(createBoard({ path }), ["project", "rename", "client", "Client work"])).toBe(
    'renamed "Client" to "Client work"',
  )
  expect(runCommand(createBoard({ path }), ["project", "open", "client work"])).toBe('opened "Client work"')
  expect(runCommand(createBoard({ path }), ["projects"])).toBe(
    "General\t0 to-do\t0 doing\t0 done\nside gig\t0 to-do\t0 doing\t0 done\nClient work\t1 to-do\t0 doing\t0 done\topen",
  )
  expect(() => runCommand(createBoard({ path }), ["project", "rename", "General", "side gig"])).toThrow("already exists")

  expect(runCommand(createBoard({ path }), ["project", "rm", "Client work"])).toBe(
    'deleted project "Client work" and its 1 card',
  )
  const after = createBoard({ path })
  expect(after.project).toBe(DEFAULT_PROJECT) // deleting the open project opens the first one
  expect(after.cards).toEqual([])
  runCommand(after, ["project", "rm", "side gig"])
  expect(() => runCommand(after, ["project", "rm", "General"])).toThrow("only project")
})
