---
name: kanban
description: "Read and update the user's Flow kanban board (kanban-tui) from the shell. Use when you discover follow-up work you will not do right now (a bug you noticed, a TODO you left, a deferred refactor, a test to add later) so it lands on the board as a To-do card; when you start or finish work that is already a card; or when the user mentions their kanban, board, to-dos or cards."
---

# Kanban

The user tracks work on a kanban board (Flow, `kanban-tui`) with three columns: `todo`, `progress`, `done`. The board is often open in another pane; anything you change shows up there within a second, so you never need to open or restart it.

## Commands

```bash
kanban-tui add "<title>" [--priority high|medium|low]   # new To-do card; prints its id, e.g. K-07
kanban-tui list                                         # open cards: id, column, priority, title (tab-separated)
kanban-tui list --all                                   # also Done cards
kanban-tui move <id> todo|progress|done                 # move a card
kanban-tui rm <id>                                      # delete a card
```

Never run `kanban-tui` with no arguments: that opens the interactive board and blocks your shell.

If `kanban-tui` isn't on `PATH`, Flow may be installed only as a herdr plugin; run `bun run <plugin dir>/index.ts <command>` instead.

## When to add a card

- Add a card for real follow-up work you find but won't do in this task: a bug you noticed, a `TODO` you left in code, a deferred refactor, a missing test, something the user said to do "later".
- Don't add cards for the steps of the task you're doing now. Those belong in your own plan, not on the user's board.
- Run `kanban-tui list` first and skip anything that's already on the board.
- Write titles as short imperatives the user will understand later without context (under ~60 characters), naming the file or area: `Fix token refresh race in auth/session.ts`, not `fix bug`.
- Priority: `high` for a bug or blocker, `medium` (the default) for normal work, `low` for nice-to-haves.
- After adding, tell the user in one line, such as "Added K-07 to the board: Fix token refresh race."

## Moving cards

When the user asks you to work on a card, `move <id> progress` when you start and `move <id> done` when it's finished and verified. Don't move or delete cards you weren't asked about.
