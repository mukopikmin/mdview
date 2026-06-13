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
};
