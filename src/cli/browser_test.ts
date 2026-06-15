import { assertEquals } from "@std/assert";
import { buildOpenBrowserCommand } from "./browser.ts";

Deno.test("builds browser open commands for supported platforms", () => {
  assertEquals(buildOpenBrowserCommand("http://127.0.0.1:3334/", "darwin"), {
    command: "open",
    args: ["http://127.0.0.1:3334/"],
  });
  assertEquals(buildOpenBrowserCommand("http://127.0.0.1:3334/", "linux"), {
    command: "xdg-open",
    args: ["http://127.0.0.1:3334/"],
  });
  assertEquals(buildOpenBrowserCommand("http://127.0.0.1:3334/", "windows"), {
    command: "cmd",
    args: ["/c", "start", "", "http://127.0.0.1:3334/"],
  });
});

Deno.test("uses an explicit browser command when provided", () => {
  assertEquals(
    buildOpenBrowserCommand(
      "http://127.0.0.1:3334/",
      "linux",
      "explorer.exe",
    ),
    {
      command: "explorer.exe",
      args: ["http://127.0.0.1:3334/"],
    },
  );
  assertEquals(
    buildOpenBrowserCommand(
      "http://127.0.0.1:3334/",
      "linux",
      `"chrome.exe" --new-window %s`,
    ),
    {
      command: "chrome.exe",
      args: ["--new-window", "http://127.0.0.1:3334/"],
    },
  );
});

Deno.test("returns undefined for unsupported platforms", () => {
  assertEquals(
    buildOpenBrowserCommand("http://127.0.0.1:3334/", "freebsd"),
    undefined,
  );
});
