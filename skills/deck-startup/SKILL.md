---
name: deck-startup
description: >
  Manage what launches when Hasan logs in, each program within its own days and time window,
  through the Startup plugin's Deck MCP tools. TRIGGER when asked to add, remove, enable or
  disable a program that starts at logon.
---

# Deck Startup programs

`deck_add_startup` / `deck_set_startup_enabled` / `deck_remove_startup`, from the Startup plugin:
the tools exist only while it is installed. `deck_list` shows the current list.

```
deck_add_startup  name: "Slack", path: "%LOCALAPPDATA%\slack\slack.exe",
                  days: ["Monday",...,"Friday"], start: "08:00", end: "17:00"
```

The point is the **window**: the program launches at logon only on those days between `start`
and `end`, so work apps don't open on a Sunday evening. Defaults are Mon–Fri 08:00–17:00; pass
`days` explicitly for weekend programs.

- `name` is the key: adding the same name again updates the existing entry rather than
  duplicating it. `%VARS%` are expanded in `path`.
- Prefer `deck_set_startup_enabled` over removing something Hasan may want back.
- Times are 24-hour `HH:mm`, local. Days are full English names (`"Monday"`).
- The tools write to the **installed** Deck's config, not a dev build (`Deck-Dev`).
