# Startup

Programs to launch when you log in, each within its own days and time window.

Split out of the Schedules plugin, which had Startup, App Timer and Power Timer as tabs. Rust starts the programs at logon; the plugin owns the list and the interface.

## What it exports

| Export | Where it renders |
|---|---|
| `default` | the tab |
| `mcp` | adding, switching and removing startup programs, for an agent |

## Build

```sh
node plugins/startup/build.mjs
```

See [../README.md](../README.md) for how the build and the shims work.

## Install

Copy `plugin.json`, `plugin.js` and `mcp.js` into `%APPDATA%\Deck\plugins\startup\` (`Deck-Dev` for a
debug build) and restart Deck.
