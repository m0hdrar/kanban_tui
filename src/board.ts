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
  /** Change a card's title. */
  rename(card: Card, title: string): void
  /** Step a card's priority medium → high → low → medium. Returns the new one. */
  cyclePriority(card: Card): Priority
  /** Cards of one column, in display order: by priority, except Done, which is newest-first. */
  inColumn(column: ColumnId): Card[]
  counts(): Record<ColumnId, number>
  /**
   * Pick up changes another process (such as `kanban-tui add`) wrote to the
   * file. Returns true when the cards changed. Cards that still exist keep
   * their object identity, so references held by the UI stay valid.
   */
  sync(): boolean
}

/** One line for status bars such as herdr's tab bar; empty when there's nothing to do. */
export function statusLine(counts: Record<ColumnId, number>): string {
  if (!counts.todo && !counts.progress) return ""
  return `Kanban ${counts.progress} doing · ${counts.todo} to-do`
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
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const NEXT_PRIORITY: Record<Priority, Priority> = { medium: "high", high: "low", low: "medium" }
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

/** Parses a saved board; throws (so the caller leaves the file alone) when it is unreadable. */
function parseBoard(text: string, path: string): SavedBoard {
  let data: any
  try {
    data = JSON.parse(text)
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

/** Writes atomically and returns the text written. */
function saveBoard(path: string, data: SavedBoard): string {
  mkdirSync(dirname(path), { recursive: true })
  const text = `${JSON.stringify(data, null, 2)}\n`
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, path) // atomic: a crash mid-write never leaves a half-written board
  return text
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

  let nextNumber = 1
  const cards: Card[] = []
  let lastText = "" // the file's contents when this process last read or wrote it

  const makeId = () => `K-${String(nextNumber++).padStart(2, "0")}`
  const persist = () => {
    if (path) lastText = saveBoard(path, { version: 1, nextNumber, cards })
  }

  const sync = (): boolean => {
    if (!path || !existsSync(path)) return false
    const text = readFileSync(path, "utf8")
    if (text === lastText) return false
    const saved = parseBoard(text, path)
    const mine = new Map(cards.map((card) => [card.id, card]))
    const next = saved.cards.map((card) => {
      const existing = mine.get(card.id)
      if (!existing) return card
      delete existing.completedAt
      return Object.assign(existing, card)
    })
    cards.splice(0, cards.length, ...next)
    nextNumber = saved.nextNumber
    lastText = text
    return true
  }
  sync()

  // ponytail: each change re-reads the file first, then writes, so agents adding
  // cards from other processes aren't overwritten. Two writes landing in the same
  // millisecond can still race; add a lock file if that ever bites.
  const has = (card: Card) => {
    sync()
    return cards.includes(card)
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
      sync()
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
      if (!has(card) || card.column === column) return false
      const at = time()
      card.column = column
      card.movedAt = at
      if (column === "done") card.completedAt = at
      else delete card.completedAt
      persist()
      return true
    },

    cyclePriority(card) {
      if (!has(card)) return card.priority
      card.priority = NEXT_PRIORITY[card.priority]
      persist()
      return card.priority
    },

    rename(card, title) {
      if (!has(card)) return
      card.title = title.trim()
      persist()
    },

    remove(card) {
      sync()
      const index = cards.indexOf(card)
      if (index >= 0) cards.splice(index, 1)
      persist()
    },

    inColumn(column) {
      const list = cards.filter((card) => card.column === column)
      // Done reads newest-first; the other columns go high → low, keeping creation order within a priority.
      if (column === "done") {
        list.sort((a, b) => (b.completedAt ?? b.movedAt) - (a.completedAt ?? a.movedAt))
      } else {
        list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
      }
      return list
    },

    counts() {
      const out: Record<ColumnId, number> = { todo: 0, progress: 0, done: 0 }
      for (const card of cards) out[card.column]++
      return out
    },

    sync,
  }

  return board
}
