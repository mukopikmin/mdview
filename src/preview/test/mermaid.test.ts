import { describe, expect, it } from "vitest";
import { initializeMermaid, initializeMermaidZoom } from "../mermaid";

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
      '<main><div class="mermaid-container"><pre class="mermaid">graph TD; A-->B;</pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );
    const calls: unknown[] = [];

    await initializeMermaid({
      document,
      importMermaid: async () => ({
        default: {
          initialize: (options) => calls.push(["initialize", options]),
          run: async (options) => {
            calls.push(["run", options]);
            document.querySelector(".mermaid")!.innerHTML =
              '<svg viewBox="0 0 10 10"><title>Diagram</title></svg>';
          },
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
    expect(
      document.querySelector<HTMLElement>(".mermaid-container")?.dataset
        .mermaidZoomInitialized,
    ).toBe("true");
  });
});

describe("initializeMermaidZoom", () => {
  it("opens a zoom dialog from the button and removes it from close controls", () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid"><svg viewBox="0 0 10 10"><title>Diagram</title></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );

    initializeMermaidZoom(document);

    expect(
      document.querySelector<HTMLElement>(".mermaid-container")?.dataset
        .mermaidZoomInitialized,
    ).toBe("true");

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();

    expect(document.querySelector(".mermaid-zoom-dialog")).not.toBeNull();
    expect(document.querySelectorAll(".mermaid-zoom-dialog svg")).toHaveLength(
      1,
    );

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-close")?.click();

    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();
  });

  it("closes the zoom dialog with Escape and backdrop clicks", () => {
    const document = new DOMParser().parseFromString(
      '<main><div class="mermaid-container"><pre class="mermaid"><svg></svg></pre><button class="mermaid-zoom-button" type="button">Zoom</button></div></main>',
      "text/html",
    );

    initializeMermaidZoom(document);
    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();
    document.querySelector<HTMLElement>(".mermaid-zoom-dialog")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape" }),
    );
    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();

    document.querySelector<HTMLButtonElement>(".mermaid-zoom-button")?.click();
    document.querySelector<HTMLElement>(".mermaid-zoom-backdrop")?.click();
    expect(document.querySelector(".mermaid-zoom-dialog")).toBeNull();
  });
});
