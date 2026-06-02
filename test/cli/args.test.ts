import {
  assertEquals,
  assertInstanceOf,
  assertMatch,
  assertThrows,
} from "@std/assert";
import { CliUsageError, parseArgs, usage } from "../../src/cli/args.ts";

Deno.test("uses the default host and port", () => {
  assertEquals(parseArgs(["README.md"]), {
    file: "README.md",
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
    host: "127.0.0.1",
    keepAlive: false,
    open: false,
    port: 3334,
  });
});

Deno.test("parses keep-alive option", () => {
  assertEquals(parseArgs(["README.md", "--keep-alive"]), {
    file: "README.md",
    host: "127.0.0.1",
    keepAlive: true,
    open: true,
    port: 3334,
  });
});

Deno.test("parses help", () => {
  assertEquals(parseArgs(["--help"]).help, true);
  assertMatch(usage, /Defaults to 3334/);
  assertMatch(usage, /--keep-alive/);
});

Deno.test("parses version", () => {
  assertEquals(parseArgs(["--version"]).version, true);
  assertEquals(parseArgs(["-v"]).version, true);
  assertMatch(usage, /--version/);
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
});
