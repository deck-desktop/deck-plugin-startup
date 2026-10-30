# Startup for Deck

Programs that start when you log in, each on the days and within the hours you choose. Open it
from the **+** beside your tabs and choose **Startup**.

- **Programs**: search your installed apps, type a path (`%VARS%` such as `%LOCALAPPDATA%` work),
  or browse for an `.exe`, with optional arguments.
- **Active days** and a **start and end time** for each. Outside that window the program is
  left alone, so a work app need not open on a Sunday or in the evening.
- **A switch per program** to pause it without removing it, and a **Would launch now** mark on
  each one whose window covers the current time.

Deck launches the matching programs once, when it starts. Set Deck to start at logon and that is
when you log in. A program that already seems to be running is not started a second time.

The list is kept in `data\startup\startup.json` in Deck's config folder.

## For agents

The plugin brings `deck_add_startup` (which adds a program, or replaces one with the same name),
`deck_set_startup_enabled` and `deck_remove_startup` to Deck's MCP server.
