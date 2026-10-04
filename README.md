# Flow

[![Release](https://img.shields.io/github/v/release/m0hdrar/kanban_tui)](https://github.com/m0hdrar/kanban_tui/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)

A keyboard-first kanban board for your terminal, built with [Bun](https://bun.sh) and [OpenTUI](https://github.com/sst/opentui).

![Flow kanban board with To-do, In Progress and Done columns](assets/screenshot.png)

## Features

- **Three columns:** To-do, In Progress and Done, moved between with a single key
- **Priorities:** each card is marked high, medium or low at a glance
- **Card age:** see how long a card has waited, been in progress, or been done
- **Progress:** a live progress bar and card counts in the header
- **Quick capture:** press `n`, type a title, press `Enter`; press `e` to edit a title
- **Local storage:** no account and no cloud; your board is saved on your machine after every change
- **Scriptable:** `kanban-tui add`, `list`, `move` and `rm` change the board from the shell, and an open board shows the change within a second, so coding agents can add cards themselves

## Installation

Install with [Homebrew](https://brew.sh):

```sh
brew install m0hdrar/tap/kanban-tui
```

Then run:

```sh
kanban-tui
```

Supports macOS on Apple Silicon and Intel.

### As a herdr plugin

Run Flow in a [herdr](https://herdr.dev) pane (needs [Bun](https://bun.sh)):

```sh
herdr plugin install m0hdrar/kanban_tui
```

Bind a key that jumps to the board pane (and opens one if none is open) in `~/.config/herdr/config.toml`:

```toml
[[keys.command]]
key = "prefix+t"
type = "plugin_action"
command = "m0hdrar.kanban.open"
description = "kanban"
```

### Open work in the herdr tab bar

`kanban-tui status` prints your open work as one line, such as `Kanban 2 doing · 5 to-do`, and prints nothing when To-do and In Progress are empty. To show it at the right of herdr's tab bar:

```toml
[ui]
tab_bar_right = [
  { type = "command", command = "kanban-tui status", interval_seconds = 5, timeout_seconds = 2 },
]
```

Then run `herdr server reload-config`.

## Usage

### Board

| Key | Action |
| --- | --- |
| `←` / `→` or `h` / `l` | Switch column |
| `↑` / `↓` or `k` / `j` | Select a card |
| `n` | Add a card to To-do |
| `p` | Move the selected card to In Progress |
| `d` | Move the selected card to Done |
| `t` | Move the selected card back to To-do |
| `e` | Edit the selected card's title |
| `Space` | Change the selected card's priority (medium → high → low); cards sort high to low |
| `x` / `Delete` | Delete the selected card |
| `c` | Pick a colour theme (`↑`/`↓` preview, `Enter` keep, `Esc` cancel): follow herdr, flow, vesper, tokyonight, catppuccin, gruvbox, nord, rose-pine, dracula |
| `q` / `Ctrl+C` | Quit |

### New or edited card

| Key | Action |
| --- | --- |
| `Enter` | Add the card, or save the edited title |
| `Esc` | Cancel |

## Coding agents

Agents such as Claude Code or Codex, in herdr panes or anywhere else, can manage the board from the shell. If the board is open, the change appears within a second, and your selection stays on the card it was on.

| Command | Action |
| --- | --- |
| `kanban-tui add "<title>" [--priority high\|medium\|low]` | Add a card to To-do; prints its id, such as `K-07` |
| `kanban-tui list` | List To-do and In Progress cards: id, column, priority and title, tab-separated |
| `kanban-tui list --all` | Also list Done cards |
| `kanban-tui move <id> todo\|progress\|done` | Move a card |
| `kanban-tui rm <id>` | Delete a card |
| `kanban-tui help` | Show these commands |

These commands need Flow 0.5.0 or newer; older versions open the board instead.

### The kanban skill

The [`kanban` skill](skills/kanban/SKILL.md) teaches agents to use these commands. With it, an agent:

- Adds a card for follow-up work it finds but won't do now, such as a bug it noticed or a `TODO` it left
- Doesn't add the steps of its current task
- Checks `kanban-tui list` first so it doesn't add duplicates
- Moves a card to In Progress and Done when you ask it to work on that card
- Tells you the id of each card it adds

Install it with:

```sh
npx skills add m0hdrar/kanban_tui
```

Or copy `skills/kanban` into `~/.claude/skills/` for Claude Code, or `~/.agents/skills/` for Codex and other agents.

## Data

Your board is saved after every change to one file:

```text
~/Library/Application Support/kanban_tui/board.json
```

Other processes, such as `kanban-tui add`, can change the file while the board is open. The open board reloads it within a second, and it re-reads the file before each change, so it doesn't overwrite theirs.

Your theme choice is kept next to it in `theme`. Until you pick one, Flow follows the `[theme] name` in `~/.config/herdr/config.toml` (live, while it runs) and falls back to `flow` for herdr themes it doesn't have.

If the file is corrupted, Flow shows an error and exits without overwriting it.

## Development

Requires [Bun](https://bun.sh) 1.3 or newer.

```sh
bun install
bun run dev          # run in watch mode
bun test             # run the tests
bun run typecheck    # check types
bun run preview      # render a snapshot of the board to preview/
```

### Project layout

```text
index.ts             entry point: renderer, keys, shutdown
src/app.ts           header, columns, cards, composer and footer
src/board.ts         card and column model, saved to board.json
src/theme.ts         colour themes
src/format.ts        clock, date and age helpers
src/widgets.ts       progress bar and key hints
src/cli.ts           add, list, move, rm and status commands
skills/kanban/       agent skill for the commands
scripts/preview.ts   headless snapshot (txt, ans, svg)
```

### Releasing

```sh
scripts/release.sh 0.3.0
```

This command does three things:

- Builds the macOS binaries
- Publishes a GitHub release
- Updates the formula in [m0hdrar/homebrew-tap](https://github.com/m0hdrar/homebrew-tap)

## License

[MIT](LICENSE)
