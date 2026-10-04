import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createBoard, statusLine } from "./board"

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
