/**
 * Non-interactive commands, so scripts and coding agents can read and change
 * the board while it is open in another pane.
 */
import { statusLine, type Board, type Card, type ColumnId, type Priority } from "./board"

export const USAGE = `usage:
  kanban-tui                                          open the board
  kanban-tui add <title> [--priority high|medium|low] add a card to To-do; prints its id
  kanban-tui list [--all]                             To-do and In Progress cards (--all adds Done)
  kanban-tui move <id> todo|progress|done             move a card
  kanban-tui rm <id>                                  delete a card
  kanban-tui status                                   one line for status bars`

const COLUMNS: readonly ColumnId[] = ["todo", "progress", "done"]
const PRIORITIES: readonly Priority[] = ["high", "medium", "low"]

function oneOf<T extends string>(value: string | undefined, options: readonly T[], what: string): T {
  if (options.includes(value as T)) return value as T
  throw new Error(`${what} must be one of: ${options.join(", ")}`)
}

function find(board: Board, id: string | undefined): Card {
  const card = board.cards.find((c) => c.id.toLowerCase() === id?.toLowerCase())
  if (!card) throw new Error(`no card ${id ?? ""}; run \`kanban-tui list --all\` to see ids`)
  return card
}

/** Runs one command and returns what to print. Throws with a message on bad input. */
export function runCommand(board: Board, [command, ...args]: string[]): string {
  switch (command) {
    case "status":
      return statusLine(board.counts())

    case "add": {
      let priority: Priority = "medium"
      const flag = args.indexOf("--priority")
      if (flag >= 0) priority = oneOf(args.splice(flag, 2)[1], PRIORITIES, "priority")
      const title = args.join(" ").trim()
      if (!title) throw new Error("add needs a title")
      return board.create(title, { priority }).id
    }

    case "list": {
      const columns = args.includes("--all") ? COLUMNS : COLUMNS.slice(0, 2)
      return columns
        .flatMap((column) => board.inColumn(column))
        .map((card) => `${card.id}\t${card.column}\t${card.priority}\t${card.title}`)
        .join("\n")
    }

    case "move": {
      const card = find(board, args[0])
      const column = oneOf(args[1], COLUMNS, "column")
      board.move(card, column)
      return `${card.id} → ${column}`
    }

    case "rm": {
      const card = find(board, args[0])
      board.remove(card)
      return `${card.id} deleted`
    }

    case "help":
    case "--help":
    case "-h":
      return USAGE

    default:
      throw new Error(`unknown command: ${command}\n${USAGE}`)
  }
}
