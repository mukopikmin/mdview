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

class TestEventSource {
  addEventListener() {}
  close() {}
  removeEventListener() {}
}

afterEach(() => {
  cleanup();
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
                id: "active",
                line: 3,
                originalLine: 3,
                resolved: false,
                sourceHash: "active",
                sourceText: "Body",
                stale: false,
                updatedAt: "2026-06-05T00:00:00.000Z",
              },
              {
                body: "Stale comment.",
                createdAt: "2026-06-05T00:00:00.000Z",
                id: "stale",
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
