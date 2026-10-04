---
name: kanban
description: "Read and update the user's Flow kanban board (kanban-tui) from the shell. Use when you discover follow-up work you will not do right now (a bug you noticed, a TODO you left, a deferred refactor, a test to add later) so it lands on the board as a To-do card; when you start or finish work that is already a card; or when the user mentions their kanban, board, to-dos, cards or board projects."
---

# Kanban

The user tracks work on a kanban board (Flow, `kanban-tui`) with three columns: `todo`, `progress`, `done`. The board is often open in another pane; anything you change shows up there within a second, so you never need to open or restart it.

The board is split into projects, each with its own cards. Card commands work on the project open on the board unless you pass `--project <name>`, which uses that project without switching what the user sees.

## Commands

```bash
kanban-tui add "<title>" [--priority high|medium|low]   # new To-do card; prints its id, e.g. K-07
kanban-tui list                                         # open cards: id, column, priority, title (tab-separated)
kanban-tui list --all                                   # also Done cards
kanban-tui move <id> todo|progress|done                 # move a card
kanban-tui rm <id>                                      # delete a card

kanban-tui projects                                     # projects: name, to-do, doing, done counts, "open" on the open one
kanban-tui project add "<name>"                         # create a project (doesn't open it)
kanban-tui project open "<name>"                        # open a project on the user's board
kanban-tui project rename "<name>" "<new name>"         # rename a project
kanban-tui project rm "<name>"                          # delete a project AND all its cards
```

Add `--project "<name>"` to `add`, `list` or `status` to use a project other than the open one. Project names ignore case. Card ids are unique across projects, so `move` and `rm` find a card in any project.

Never run `kanban-tui` with no arguments: that opens the interactive board and blocks your shell.

If `kanban-tui` isn't on `PATH`, Flow may be installed only as a herdr plugin; run `bun run <plugin dir>/index.ts <command>` instead.

## Picking the project

- Run `kanban-tui projects` before adding cards.
- If a project matches the repo or area you're working in (by name, ignoring case), pass `--project` with that name to `list` and `add`, even if the user has another project open.
- Otherwise use the open project, with no `--project`.
- `add --project` creates a missing project, so only pass names that `kanban-tui projects` listed, unless the user asked for a new project.

## When to add a card

- Add a card for real follow-up work you find but won't do in this task: a bug you noticed, a `TODO` you left in code, a deferred refactor, a missing test, something the user said to do "later".
- Don't add cards for the steps of the task you're doing now. Those belong in your own plan, not on the user's board.
- Run `kanban-tui list` first, with the same `--project`, and skip anything that's already on the board.
- Write titles as short imperatives the user will understand later without context (under ~60 characters), naming the file or area: `Fix token refresh race in auth/session.ts`, not `fix bug`.
- Priority: `high` for a bug or blocker, `medium` (the default) for normal work, `low` for nice-to-haves.
- After adding, tell the user in one line, naming the project, such as "Added K-07 to Flow: Fix token refresh race."

## Moving cards

When the user asks you to work on a card, `move <id> progress` when you start and `move <id> done` when it's finished and verified. Don't move or delete cards you weren't asked about.

## Managing projects

Create, open, rename or delete projects only when the user asks. `project rm` deletes every card in the project and can't be undone, so confirm with the user first unless they asked for that exact deletion. Don't `project open` to do your own work; use `--project` so the user's view stays put.
