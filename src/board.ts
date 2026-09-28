/**
 * Domain model for the kanban board: cards, columns and the handful of
 * operations the UI performs on them. Deliberately framework-free so it can be
 * exercised from tests or the headless preview without a renderer.
 */

export type ColumnId = "todo" | "progress" | "done"
export type Priority = "high" | "medium" | "low"

export interface Card {
  /** user-facing id such as `K-04` */
  id: string
  title: string
  column: ColumnId
  priority: Priority
  /** epoch ms the card was created */
  createdAt: number
  /** epoch ms the card last entered its current column */
  movedAt: number
  /** epoch ms the card landed in `done`, if it ever has */
  completedAt?: number
}

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export interface Board {
  cards: Card[]
  /** Create a card, appending it to the given column (To-do by default). */
  create(title: string, opts?: { column?: ColumnId; priority?: Priority }): Card
  /** Move a card between columns. Returns true when the column changed. */
  move(card: Card, column: ColumnId): boolean
  remove(card: Card): void
  /** Cards of one column, in display order. */
  inColumn(column: ColumnId): Card[]
  counts(): Record<ColumnId, number>
}

/** Where the installed app keeps your board. */
export function defaultBoardPath(): string {
  return join(homedir(), "Library", "Application Support", "kanban_tui", "board.json")
}

interface SavedBoard {
  version: 1
  nextNumber: number
  cards: Card[]
}

const COLUMNS: readonly unknown[] = ["todo", "progress", "done"]
const PRIORITIES: readonly unknown[] = ["high", "medium", "low"]

function isCard(value: any): value is Card {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    COLUMNS.includes(value.column) &&
    PRIORITIES.includes(value.priority) &&
    Number.isFinite(value.createdAt) &&
    Number.isFinite(value.movedAt) &&
    (value.completedAt === undefined || Number.isFinite(value.completedAt))
  )
}

/** Returns null when there is no file yet; throws (leaving the file alone) when it is unreadable. */
function loadBoard(path: string): SavedBoard | null {
  if (!existsSync(path)) return null
  let data: any
  try {
    data = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new Error(`Invalid JSON in ${path}; the file was left unchanged.`)
  }
  if (
    data?.version !== 1 ||
    !Number.isInteger(data.nextNumber) ||
    !Array.isArray(data.cards) ||
    !data.cards.every(isCard)
  ) {
    throw new Error(`Unrecognised board data in ${path}; the file was left unchanged.`)
  }
  return data
}

function saveBoard(path: string, data: SavedBoard) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`)
  renameSync(tmp, path) // atomic: a crash mid-write never leaves a half-written board
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

interface SeedCard {
  title: string
  column: ColumnId
  priority: Priority
  /** how long before "now" the card was created */
  createdAgoMs: number
  /** how long before "now" the card entered its current column (defaults to createdAgoMs) */
  columnSinceAgoMs?: number
}

/** A believable sprint, seeded so a fresh board looks alive. */
const SEED: SeedCard[] = [
  // To-do
  { title: "Ship the onboarding checklist", column: "todo", priority: "high", createdAgoMs: 2.4 * HOUR },
  { title: "Fix token refresh race", column: "todo", priority: "high", createdAgoMs: 5 * HOUR },
  { title: "Design empty states", column: "todo", priority: "medium", createdAgoMs: 9 * HOUR },
  { title: "Add CSV export to reports", column: "todo", priority: "low", createdAgoMs: 26 * HOUR },
  // In progress
  {
    title: "Migrate auth to OIDC",
    column: "progress",
    priority: "high",
    createdAgoMs: 30 * HOUR,
    columnSinceAgoMs: 40 * MINUTE,
  },
  {
    title: "Dark-mode contrast audit",
    column: "progress",
    priority: "medium",
    createdAgoMs: 20 * HOUR,
    columnSinceAgoMs: 3 * HOUR,
  },
  {
    title: "Instrument checkout funnel",
    column: "progress",
    priority: "medium",
    createdAgoMs: 12 * HOUR,
    columnSinceAgoMs: 5 * HOUR,
  },
  // Done
  {
    title: "Cut release 1.4.0",
    column: "done",
    priority: "medium",
    createdAgoMs: 28 * HOUR,
    columnSinceAgoMs: 1.5 * HOUR,
  },
  {
    title: "Upgrade CI runners",
    column: "done",
    priority: "low",
    createdAgoMs: 50 * HOUR,
    columnSinceAgoMs: 4 * HOUR,
  },
  {
    title: "Refactor billing webhooks",
    column: "done",
    priority: "high",
    createdAgoMs: 72 * HOUR,
    columnSinceAgoMs: 8 * HOUR,
  },
  {
    title: "Publish API reference",
    column: "done",
    priority: "low",
    createdAgoMs: 80 * HOUR,
    columnSinceAgoMs: 26 * HOUR,
  },
]

/**
 * With a `path`, the board is loaded from that file and saved to it on every
 * change, starting empty on first run. Without one it is an in-memory board
 * seeded with sample cards (used by the preview).
 */
export function createBoard(options: { now?: () => number; path?: string } = {}): Board {
  const time = options.now ?? (() => Date.now())
  const start = time()
  const { path } = options
  const saved = path ? loadBoard(path) : null

  let nextNumber = saved?.nextNumber ?? 1
  const cards: Card[] = saved?.cards ?? []

  const makeId = () => `K-${String(nextNumber++).padStart(2, "0")}`
  const persist = () => {
    if (path) saveBoard(path, { version: 1, nextNumber, cards })
  }

  for (const seed of path ? [] : SEED) {
    const createdAt = start - seed.createdAgoMs
    const movedAt = start - (seed.columnSinceAgoMs ?? seed.createdAgoMs)
    const card: Card = {
      id: makeId(),
      title: seed.title,
      column: seed.column,
      priority: seed.priority,
      createdAt,
      movedAt,
    }
    if (seed.column === "done") card.completedAt = movedAt
    cards.push(card)
  }

  const board: Board = {
    cards,

    create(title, opts = {}) {
      const at = time()
      const card: Card = {
        id: makeId(),
        title: title.trim(),
        column: opts.column ?? "todo",
        priority: opts.priority ?? "medium",
        createdAt: at,
        movedAt: at,
      }
      cards.push(card)
      persist()
      return card
    },

    move(card, column) {
      if (card.column === column) return false
      const at = time()
      card.column = column
      card.movedAt = at
      if (column === "done") card.completedAt = at
      else delete card.completedAt
      persist()
      return true
    },

    remove(card) {
      const index = cards.indexOf(card)
      if (index >= 0) cards.splice(index, 1)
      persist()
    },

    inColumn(column) {
      const list = cards.filter((card) => card.column === column)
      // Done reads newest-first; the other columns keep their creation order.
      if (column === "done") {
        list.sort((a, b) => (b.completedAt ?? b.movedAt) - (a.completedAt ?? a.movedAt))
      }
      return list
    },

    counts() {
      const out: Record<ColumnId, number> = { todo: 0, progress: 0, done: 0 }
      for (const card of cards) out[card.column]++
      return out
    },
  }

  return board
}
