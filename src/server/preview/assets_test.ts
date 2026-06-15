import { assertEquals } from "@std/assert";

import { handlePreviewAssetRequest } from "./assets.ts";

Deno.test("rejects missing and traversing asset paths", async () => {
  for (
    const pathname of [
      "/assets/",
      "/assets/missing.js",
      "/assets/../server/server.ts",
      "/assets/%2e%2e/server/server.ts",
      "/assets//etc/passwd",
    ]
  ) {
    const response = await handlePreviewAssetRequest(pathname);
    assertEquals(response.status, 404);
    assertEquals(await response.text(), "Asset not found.");
  }
});

Deno.test("serves fingerprintable assets with immutable caching", async () => {
  const response = await handlePreviewAssetRequest(
    "/assets/mermaid.esm.min.mjs",
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assertEquals(
    response.headers.get("content-type"),
    "text/javascript; charset=utf-8",
  );
  assertEquals((await response.arrayBuffer()).byteLength > 0, true);
});
