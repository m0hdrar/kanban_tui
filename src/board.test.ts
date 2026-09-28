import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createBoard } from "./board"

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
