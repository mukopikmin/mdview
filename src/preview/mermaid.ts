type MermaidApi = {
  initialize: (
    options: { startOnLoad: boolean; theme: "dark" | "default" },
  ) => void;
  run: (options: { nodes: HTMLElement[] }) => Promise<void>;
};

type MermaidModule = {
  default: MermaidApi;
};

const mermaidAssetPath = "/assets/mermaid.esm.min.mjs";

export type MermaidOptions = {
  document?: Document;
  importMermaid?: () => Promise<MermaidModule>;
  prefersDark?: () => boolean;
};

const closeMermaidZoomDialog = (dialog: HTMLElement) => {
  dialog.remove();
};

const createMermaidZoomDialog = (
  document: Document,
  sourceSvg: SVGElement,
): HTMLElement => {
  const dialog = document.createElement("div");
  dialog.className = "mermaid-zoom-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Zoomed Mermaid diagram");
  dialog.tabIndex = -1;

  const backdrop = document.createElement("div");
  backdrop.className = "mermaid-zoom-backdrop";

  const content = document.createElement("div");
  content.className = "mermaid-zoom-content";

  const closeButton = document.createElement("button");
  closeButton.className = "mermaid-zoom-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close Mermaid diagram zoom");
  closeButton.textContent = "×";

  const scroller = document.createElement("div");
  scroller.className = "mermaid-zoom-scroller";
  scroller.append(sourceSvg.cloneNode(true));

  content.append(closeButton, scroller);
  dialog.append(backdrop, content);

  const close = () => closeMermaidZoomDialog(dialog);
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return dialog;
};

export const initializeMermaidZoom = (
  document: Document = globalThis.document,
): void => {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>(".mermaid-container"),
  );

  for (const container of containers) {
    if (container.dataset.mermaidZoomInitialized === "true") continue;
    const mermaid = container.querySelector<HTMLElement>(".mermaid");
    const button = container.querySelector<HTMLButtonElement>(
      ".mermaid-zoom-button",
    );
    if (!mermaid || !button) continue;

    const open = () => {
      const svg = mermaid.querySelector<SVGElement>("svg");
      if (!svg) return;
      const dialog = createMermaidZoomDialog(document, svg);
      document.body.append(dialog);
      dialog.focus();
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      open();
    });
    mermaid.addEventListener("click", open);
    container.dataset.mermaidZoomInitialized = "true";
  }
};

export const initializeMermaid = async (
  {
    document = globalThis.document,
    importMermaid = () => import(/* @vite-ignore */ mermaidAssetPath),
    prefersDark = () =>
      globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  }: MermaidOptions = {},
): Promise<void> => {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(".mermaid"),
  );
  if (nodes.length === 0) return;

  const { default: mermaid } = await importMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: prefersDark() ? "dark" : "default",
  });
  await mermaid.run({ nodes });
  initializeMermaidZoom(document);
};
