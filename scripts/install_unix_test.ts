import { assertEquals, assertRejects } from "@std/assert";

import {
  getUnixInstallPath,
  installUnix,
  supportsUnixInstall,
} from "./install_unix.ts";

Deno.test("supports macOS and Linux installs", () => {
  assertEquals(supportsUnixInstall("darwin"), true);
  assertEquals(supportsUnixInstall("linux"), true);
  assertEquals(supportsUnixInstall("windows"), false);
});

Deno.test("builds the install path under the user home directory", () => {
  assertEquals(
    getUnixInstallPath("/home/mdview-user"),
    "/home/mdview-user/.local/bin/mdview",
  );
});

Deno.test("rejects unsupported operating systems", async () => {
  await assertRejects(
    () =>
      installUnix({
        home: "/tmp/mdview-home",
        os: "windows",
      }),
    Error,
    "This installer supports only macOS and Linux.",
  );
});

Deno.test("installs an executable compiled binary", async () => {
  const home = await Deno.makeTempDir({ prefix: "mdview-install-test-" });

  try {
    const installPath = await installUnix({
      compileArgs: ["--version", "1.2.3"],
      compileBinary: async (buildPath, compileArgs) => {
        assertEquals(compileArgs, ["--version", "1.2.3"]);
        await Deno.writeTextFile(buildPath, "compiled mdview");
      },
      home,
      os: "linux",
    });

    assertEquals(installPath, getUnixInstallPath(home));
    assertEquals(await Deno.readTextFile(installPath), "compiled mdview");
    assertEquals((await Deno.stat(installPath)).mode! & 0o777, 0o755);
  } finally {
    await Deno.remove(home, { recursive: true });
  }
});
