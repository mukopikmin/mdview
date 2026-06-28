import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { initializeMermaid } from "../mermaid";

vi.mock("../mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

class TestEventSource extends EventTarget {
  static instances: TestEventSource[] = [];

  constructor() {
    super();
    TestEventSource.instances.push(this);
  }

  close() {}
}

afterEach(() => {
  cleanup();
  TestEventSource.instances = [];
  vi.mocked(initializeMermaid).mockClear();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("reruns mermaid rendering when returning to the preview view", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/document") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "```mermaid\ngraph TD\n  A --> B\n```\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Comments 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(2));
  });

  it("shows a reload button when source changes are available", async () => {
    const reload = vi.fn();
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal("location", { reload });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/document") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Title\n\nBody\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);

    await screen.findByRole("link", { name: "example.md" });

    expect(screen.queryByRole("button", { name: "Reload preview" })).toBeNull();

    TestEventSource.instances.at(-1)?.dispatchEvent(new Event("reload"));

    const reloadButton = await screen.findByRole("button", {
      name: "Reload preview",
    });
    expect(screen.getByText("Source changes are available.")).not.toBeNull();
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(reloadButton);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows stale comments only in the comments view", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/document") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Title\n\nBody\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
          return Promise.resolve(Response.json({
            comments: [
              {
                body: "Active comment.",
                createdAt: "2026-06-05T00:00:00.000Z",
                id: 1,
                line: 3,
                originalLine: 3,
                resolved: false,
                sourceHash: 1,
                sourceText: "Body",
                stale: false,
                updatedAt: "2026-06-05T00:00:00.000Z",
              },
              {
                body: "Stale comment.",
                createdAt: "2026-06-05T00:00:00.000Z",
                id: 2,
                line: 5,
                originalLine: 5,
                resolved: false,
                sourceHash: "stale",
                sourceText: "Old body",
                stale: true,
                updatedAt: "2026-06-05T00:00:00.000Z",
              },
            ],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText("Active comment.")).not.toBeNull()
    );
    expect(screen.queryByText("Stale comment.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Comments 2/ }));

    expect(screen.getByText("Active comment.")).not.toBeNull();
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
  });
});
