import { describe, expect, it } from "vitest";
import { connectHotReload } from "../hot_reload";

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  closed = false;
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("connectHotReload", () => {
  it("reloads when the server sends a reload event", () => {
    let reloads = 0;
    const disconnect = connectHotReload({
      EventSourceCtor: FakeEventSource as unknown as new (
        url: string,
      ) => EventSource,
      reload: () => {
        reloads += 1;
      },
    });

    const events = FakeEventSource.instances.at(-1);
    expect(events?.url).toBe("/__mdview/events");

    events?.dispatchEvent(new Event("reload"));
    expect(reloads).toBe(1);

    disconnect();
    expect(events?.closed).toBe(true);
  });
});
