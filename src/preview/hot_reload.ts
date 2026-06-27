type EventSourceConstructor = new (url: string) => EventSource;

export type HotReloadOptions = {
  EventSourceCtor?: EventSourceConstructor;
  onReloadAvailable?: () => void;
};

export const connectHotReload = (
  {
    EventSourceCtor = globalThis.EventSource,
    onReloadAvailable = () => {},
  }: HotReloadOptions = {},
): () => void => {
  const events = new EventSourceCtor("/__sadoku/events");
  const notifyReloadAvailable = () => onReloadAvailable();

  events.addEventListener("reload", notifyReloadAvailable);

  return () => {
    events.removeEventListener("reload", notifyReloadAvailable);
    events.close();
  };
};
