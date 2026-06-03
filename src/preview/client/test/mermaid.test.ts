import { describe, expect, it } from "vitest";
import { initializeMermaid } from "../mermaid";

describe("initializeMermaid", () => {
  it("does not load mermaid when the page has no diagrams", async () => {
    const document = new DOMParser().parseFromString(
      "<main><p>No diagrams.</p></main>",
      "text/html",
    );
    let loaded = false;

    await initializeMermaid({
      document,
      importMermaid: async () => {
        loaded = true;
        throw new Error("unexpected import");
      },
    });

    expect(loaded).toBe(false);
  });

  it("initializes and runs mermaid for rendered diagram blocks", async () => {
    const document = new DOMParser().parseFromString(
      '<main><pre class="mermaid">graph TD; A-->B;</pre></main>',
      "text/html",
    );
    const calls: unknown[] = [];

    await initializeMermaid({
      document,
      importMermaid: async () => ({
        default: {
          initialize: (options) => calls.push(["initialize", options]),
          run: async (options) => calls.push(["run", options]),
        },
      }),
      prefersDark: () => true,
    });

    expect(calls[0]).toEqual([
      "initialize",
      { startOnLoad: false, theme: "dark" },
    ]);
    expect(calls[1]).toEqual([
      "run",
      { nodes: [document.querySelector(".mermaid")] },
    ]);
  });
});
