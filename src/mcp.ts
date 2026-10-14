// The agent-facing tools for startup programs, in the `startup` file.
//
// Nothing is imported at run time — the server passes its own zod and store helpers in. The type
// import below is erased at build time.
import type { DeckMcp, McpServer, StartupProgram, Weekday } from "../shim/mcp.js";

export function register(server: McpServer, deck: DeckMcp) {
  const { z, ok, weekday, readJson, writeJson, ALL_DAYS } = deck;

  server.tool(
    "deck_add_startup",
    "Add a startup program that launches at logon within a day + time window.",
    {
      name: z.string(),
      path: z.string().describe("full path to the .exe (%VARS% allowed)"),
      args: z.array(z.string()).default([]),
      days: z.array(weekday).default(ALL_DAYS.slice(0, 5) as Weekday[]),
      start: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).default("08:00"),
      end: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).default("17:00"),
      enabled: z.boolean().default(true),
    },
    async ({ name, path, args, days, start, end, enabled }) => {
      const list = readJson<StartupProgram[]>("startup", []);
      const entry: StartupProgram = { Name: name, Path: path, Args: args, Days: days, Start: start, End: end, Enabled: enabled };
      const i = list.findIndex((p) => p.Name.toLowerCase() === name.toLowerCase());
      if (i >= 0) list[i] = entry; else list.push(entry);
      writeJson("startup", list);
      return ok(`${i >= 0 ? "Updated" : "Added"} startup program '${name}'.`);
    },
  );

  server.tool(
    "deck_set_startup_enabled",
    "Enable or disable a startup program by name.",
    { name: z.string(), enabled: z.boolean() },
    async ({ name, enabled }) => {
      const list = readJson<StartupProgram[]>("startup", []);
      const p = list.find((x) => x.Name.toLowerCase() === name.toLowerCase());
      if (!p) return ok(`No startup program named '${name}'.`);
      p.Enabled = enabled;
      writeJson("startup", list);
      return ok(`${enabled ? "Enabled" : "Disabled"} '${name}'.`);
    },
  );

  server.tool(
    "deck_remove_startup",
    "Remove a startup program by name.",
    { name: z.string() },
    async ({ name }) => {
      const list = readJson<StartupProgram[]>("startup", []);
      const next = list.filter((p) => p.Name.toLowerCase() !== name.toLowerCase());
      writeJson("startup", next);
      return ok(next.length === list.length ? `No startup program named '${name}'.` : `Removed '${name}'.`);
    },
  );
}
