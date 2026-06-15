type EventSourceConstructor = new (url: string) => EventSource;

export type HotReloadOptions = {
  EventSourceCtor?: EventSourceConstructor;
  reload?: () => void;
};

export const connectHotReload = (
  {
    EventSourceCtor = globalThis.EventSource,
    reload = () => globalThis.location.reload(),
  }: HotReloadOptions = {},
): () => void => {
  const events = new EventSourceCtor("/__mdview/events");
  const reloadPage = () => reload();

  events.addEventListener("reload", reloadPage);

  return () => {
    events.removeEventListener("reload", reloadPage);
    events.close();
  };
};
