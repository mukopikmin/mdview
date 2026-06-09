import {
  assertEquals,
  assertInstanceOf,
  assertMatch,
  assertThrows,
} from "@std/assert";
import { CliUsageError, parseArgs, usage, version } from "./args.ts";

Deno.test("uses the default host and port", () => {
  assertEquals(parseArgs(["README.md"]), {
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
});

Deno.test("parses host and port options", () => {
  assertEquals(
    parseArgs(["README.md", "--host", "0.0.0.0", "--port", "4000"]),
    {
      file: "README.md",
      force: false,
      host: "0.0.0.0",
      keepAlive: false,
      open: true,
      port: 4000,
    },
  );
});

Deno.test("parses no-open option", () => {
  assertEquals(parseArgs(["README.md", "--no-open"]), {
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: false,
    port: 3334,
  });
});

Deno.test("parses keep-alive option", () => {
  assertEquals(parseArgs(["README.md", "--keep-alive"]), {
    file: "README.md",
    force: false,
    host: "127.0.0.1",
    keepAlive: true,
    open: true,
    port: 3334,
  });
});

Deno.test("parses comments list command", () => {
  assertEquals(parseArgs(["comments", "list"]), {
    command: "comments-list",
    file: undefined,
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
});

Deno.test("parses comments rm command", () => {
  assertEquals(parseArgs(["comments", "rm", "README.md-12345678.json"]), {
    command: "comments-rm",
    commentFile: "README.md-12345678.json",
    file: undefined,
    force: false,
    host: "127.0.0.1",
    keepAlive: false,
    open: true,
    port: 3334,
  });
  assertEquals(
    parseArgs(["comments", "rm", "README.md-12345678.json", "--force"]),
    {
      command: "comments-rm",
      commentFile: "README.md-12345678.json",
      file: undefined,
      force: true,
      host: "127.0.0.1",
      keepAlive: false,
      open: true,
      port: 3334,
    },
  );
});

Deno.test("parses help", () => {
  assertEquals(parseArgs(["--help"]).help, true);
  assertMatch(usage, /Defaults to 3334/);
  assertMatch(usage, /comments list/);
  assertMatch(usage, /comments rm/);
  assertMatch(usage, /--keep-alive/);
});

Deno.test("parses version", () => {
  assertEquals(parseArgs(["--version"]).version, true);
  assertEquals(parseArgs(["-v"]).version, true);
  assertMatch(usage, /--version/);
});

Deno.test("uses the development version by default", () => {
  assertEquals(version, "0.0.0-dev");
});

Deno.test("throws usage errors for invalid options", () => {
  assertInstanceOf(
    assertThrows(() => parseArgs(["README.md", "--port", "nope"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["README.md", "--unknown"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["README.md", "--port"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["README.md", "--host"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["a.md", "b.md"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() => parseArgs(["comments", "list", "--port", "4000"])),
    CliUsageError,
  );
  assertInstanceOf(
    assertThrows(() =>
      parseArgs(["comments", "rm", "README.md-12345678.json", "--port", "4000"])
    ),
    CliUsageError,
  );
});
