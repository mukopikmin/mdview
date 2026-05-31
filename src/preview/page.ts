import { previewThemeCss } from "./theme.ts";

export type PreviewPageOptions = {
  title: string;
  body: string;
  fileUrl: string;
};

export const renderPreviewPage = (
  { title, body, fileUrl }: PreviewPageOptions,
): string =>
  `<!doctype html>
<html lang="und">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
${previewThemeCss}
    </style>
  </head>
  <body>
    <main>
      <header>Previewing <a href="${fileUrl}">${title}</a>. Refresh to reload changes.</header>
      ${body}
    </main>
    ${renderMermaidScript(body)}
    ${renderHotReloadScript()}
  </body>
</html>`;

const renderHotReloadScript = (): string =>
  `<script>
      (() => {
        const events = new EventSource("/__mdview/events");
        events.addEventListener("reload", () => {
          window.location.reload();
        });
      })();
    </script>`;

const renderMermaidScript = (body: string): string => {
  if (!body.includes('class="mermaid"')) return "";

  return `<script type="module">
      import mermaid from "/assets/mermaid.esm.min.mjs";

      mermaid.initialize({
        startOnLoad: true,
        theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default"
      });
    </script>`;
};
