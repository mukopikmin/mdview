export const previewThemeCss = `
      :root {
        color-scheme: light dark;
        --color-canvas: #ffffff;
        --color-page: #f6f8fa;
        --color-canvas-subtle: #f6f8fa;
        --color-border: #d0d7de;
        --color-border-muted: #d8dee4;
        --color-text: #1f2328;
        --color-text-muted: #59636e;
        --color-link: #0969da;
        --color-code-bg: #818b981f;
        --color-accent: #0969da;
        font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        line-height: 1.65;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --color-canvas: #0d1117;
          --color-page: #010409;
          --color-canvas-subtle: #161b22;
          --color-border: #30363d;
          --color-border-muted: #21262d;
          --color-text: #e6edf3;
          --color-text-muted: #8b949e;
          --color-link: #58a6ff;
          --color-code-bg: #6e768166;
          --color-accent: #2f81f7;
        }
      }

      body {
        margin: 0;
        background: var(--color-page);
        color: var(--color-text);
      }

      main {
        box-sizing: border-box;
        width: min(100%, 980px);
        margin: 24px auto 48px;
        border: 1px solid var(--color-border-muted);
        border-radius: 8px;
        background: var(--color-canvas);
        padding: 32px 40px 64px;
        box-shadow: 0 8px 24px #1f232814;
      }

      header {
        margin: -32px -40px 32px;
        border-bottom: 1px solid var(--color-border-muted);
        border-radius: 8px 8px 0 0;
        background: var(--color-canvas-subtle);
        padding: 14px 40px;
        color: var(--color-text-muted);
        font-size: 0.85rem;
      }

      header a {
        color: var(--color-text);
        font-weight: 600;
      }

      h1 {
        font-size: 2rem;
      }

      h1, h2 {
        padding-bottom: 0.3em;
        border-bottom: 1px solid var(--color-border-muted);
      }

      h1, h2, h3, h4, h5, h6 {
        line-height: 1.25;
        margin: 24px 0 16px;
        font-weight: 600;
      }

      h2 {
        font-size: 1.5rem;
      }

      h3 {
        font-size: 1.25rem;
      }

      h4 {
        font-size: 1rem;
      }

      h5 {
        font-size: 0.875rem;
      }

      h6 {
        color: var(--color-text-muted);
        font-size: 0.85rem;
      }

      h1:first-child, h2:first-child, h3:first-child {
        margin-top: 0;
      }

      p, blockquote, ul, ol, dl, table, pre {
        margin-top: 0;
        margin-bottom: 16px;
      }

      a {
        color: var(--color-link);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      .heading-anchor {
        color: inherit;
        text-decoration: none;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      ul, ol {
        padding-left: 2em;
      }

      li + li {
        margin-top: 0.25em;
      }

      li > ul, li > ol {
        margin-top: 0.25em;
        margin-bottom: 0;
      }

      code {
        border-radius: 6px;
        padding: 0.2em 0.4em;
        background: var(--color-code-bg);
        font-family: "UDEV Gothic", "BIZ UDGothic", "Noto Sans Mono CJK JP", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 0.85em;
      }

      pre {
        overflow: auto;
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 16px;
        background: var(--color-canvas-subtle);
        line-height: 1.45;
      }

      pre code {
        padding: 0;
        background: transparent;
        font-size: 0.85rem;
      }

      blockquote {
        padding: 0 1em;
        border-left: 0.25em solid var(--color-border);
        color: var(--color-text-muted);
      }

      table {
        display: block;
        overflow: auto;
        width: max-content;
        max-width: 100%;
        border-spacing: 0;
        border-collapse: collapse;
      }

      th, td {
        border: 1px solid var(--color-border);
        padding: 6px 13px;
      }

      th {
        background: var(--color-canvas-subtle);
        font-weight: 600;
      }

      tr {
        border-top: 1px solid var(--color-border-muted);
      }

      tr:nth-child(2n) {
        background: var(--color-canvas-subtle);
      }

      hr {
        height: 0.25em;
        margin: 24px 0;
        border: 0;
        background: var(--color-border);
      }

      .mermaid {
        overflow: auto;
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 16px;
        background: var(--color-canvas-subtle);
      }

      @media (max-width: 640px) {
        main {
          margin: 0;
          border-width: 0;
          border-radius: 0;
          padding: 24px 16px 48px;
          box-shadow: none;
        }

        header {
          margin: -24px -16px 24px;
          border-radius: 0;
          padding: 12px 16px;
        }
      }
`;
