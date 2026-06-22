export const previewThemeCss = `
      :root {
        color-scheme: light dark;
        --color-canvas: #ffffff;
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
        background: var(--color-canvas);
        color: var(--color-text);
      }

      main {
        box-sizing: border-box;
        width: min(100%, 980px);
        margin: 0 auto;
        padding: 32px 32px 64px;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 32px;
        border-bottom: 1px solid var(--color-border-muted);
        padding-bottom: 16px;
        color: var(--color-text-muted);
        font-size: 0.85rem;
      }

      header a {
        color: var(--color-text);
        font-weight: 600;
      }

      .preview-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .preview-nav button {
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 5px 10px;
        background: var(--color-canvas);
        color: var(--color-text);
        cursor: pointer;
        font: inherit;
      }

      .preview-nav button:hover,
      .preview-nav button:focus-visible,
      .preview-nav button[aria-current="page"] {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .preview-nav span {
        margin-left: 6px;
        color: #9a6700;
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

      .task-list-item {
        list-style-type: none;
      }

      .task-list-item-checkbox {
        margin: 0 0.5em 0.2em -1.5em;
        vertical-align: middle;
      }

      code {
        border-radius: 6px;
        padding: 0.2em 0.4em;
        background: var(--color-code-bg);
        font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, Monaco, "UDEV Gothic", "BIZ UDGothic", "Noto Sans Mono CJK JP", monospace;
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

      .hljs {
        color: var(--color-text);
      }

      .hljs-comment,
      .hljs-quote {
        color: var(--color-text-muted);
      }

      .hljs-keyword,
      .hljs-selector-tag,
      .hljs-subst {
        color: #cf222e;
      }

      .hljs-literal,
      .hljs-number,
      .hljs-tag .hljs-attr,
      .hljs-template-variable,
      .hljs-variable {
        color: #953800;
      }

      .hljs-doctag,
      .hljs-string,
      .hljs-title,
      .hljs-section,
      .hljs-selector-id {
        color: #0a3069;
      }

      .hljs-type,
      .hljs-class .hljs-title,
      .hljs-built_in,
      .hljs-builtin-name {
        color: #8250df;
      }

      .hljs-attr,
      .hljs-attribute,
      .hljs-name,
      .hljs-selector-class,
      .hljs-selector-attr,
      .hljs-selector-pseudo {
        color: #116329;
      }

      .hljs-symbol,
      .hljs-bullet,
      .hljs-link,
      .hljs-meta {
        color: #0969da;
      }

      .hljs-deletion {
        color: #82071e;
        background: #ffebe9;
      }

      .hljs-addition {
        color: #116329;
        background: #dafbe1;
      }

      @media (prefers-color-scheme: dark) {
        .hljs-keyword,
        .hljs-selector-tag,
        .hljs-subst {
          color: #ff7b72;
        }

        .hljs-literal,
        .hljs-number,
        .hljs-tag .hljs-attr,
        .hljs-template-variable,
        .hljs-variable {
          color: #ffa657;
        }

        .hljs-doctag,
        .hljs-string,
        .hljs-title,
        .hljs-section,
        .hljs-selector-id {
          color: #a5d6ff;
        }

        .hljs-type,
        .hljs-class .hljs-title,
        .hljs-built_in,
        .hljs-builtin-name {
          color: #d2a8ff;
        }

        .hljs-attr,
        .hljs-attribute,
        .hljs-name,
        .hljs-selector-class,
        .hljs-selector-attr,
        .hljs-selector-pseudo {
          color: #7ee787;
        }

        .hljs-symbol,
        .hljs-bullet,
        .hljs-link,
        .hljs-meta {
          color: #79c0ff;
        }

        .hljs-deletion {
          color: #ffdcd7;
          background: #67060c;
        }

        .hljs-addition {
          color: #aff5b4;
          background: #033a16;
        }
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

      .commentable-block {
        position: relative;
        margin-left: -42px;
        padding-left: 42px;
      }

      .commentable-content {
        isolation: isolate;
        position: relative;
      }

      .commentable-content::before {
        content: "";
        position: absolute;
        z-index: -1;
        inset: -4px -8px;
        border-radius: 6px;
        background: transparent;
        pointer-events: none;
        transition: background-color 120ms ease;
      }

      .commentable-block:has(.comment-thread) > .commentable-content::before {
        background: color-mix(in srgb, var(--color-accent) 8%, transparent);
      }

      .commentable-block:hover > .commentable-content::before,
      .commentable-block:focus-within > .commentable-content::before {
        background: color-mix(in srgb, var(--color-accent) 14%, transparent);
      }

      .comment-line-button {
        position: absolute;
        top: 0.1rem;
        left: -34px;
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-canvas);
        color: var(--color-text-muted);
        cursor: pointer;
        font: inherit;
        font-size: 1rem;
        line-height: 1;
        opacity: 0;
      }

      .commentable-block:hover > .commentable-content > .comment-line-button,
      .comment-line-button:focus-visible,
      .commentable-block:has(.comment-thread) > .commentable-content > .comment-line-button {
        opacity: 1;
      }

      .comment-line-button:hover,
      .comment-line-button:focus-visible {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .comment-line-button::before {
        content: "+";
      }

      .commentable-list-item > .commentable-content > .comment-line-button {
        left: calc(-34px - 2em);
      }

      .comment-thread {
        margin: -6px 0 12px;
        border-left: 3px solid var(--color-accent);
        padding: 6px 0 1px 10px;
      }

      .comment-item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
      }

      .comment-thread-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--color-text-muted);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .comment-item,
      .comment-form {
        margin-bottom: 6px;
      }

      .comment-list {
        display: grid;
        gap: 28px;
      }

      .comment-list-section h2 {
        margin-top: 0;
      }

      .comment-list-items {
        display: grid;
        gap: 12px;
      }

      .comment-list-item {
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 12px;
      }

      .comment-list-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        color: var(--color-text-muted);
        font-size: 0.82rem;
        font-weight: 600;
      }

      .comment-state {
        border: 1px solid #d29922;
        border-radius: 999px;
        padding: 1px 6px;
        color: #9a6700;
        font-size: 0.72rem;
      }

      .comment-source-block {
        margin-bottom: 8px;
      }

      .comment-source-label {
        margin-bottom: 4px;
        color: var(--color-text-muted);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .comment-source {
        margin-bottom: 8px;
        padding: 8px 10px;
        color: var(--color-text-muted);
      }

      .comment-list-empty {
        color: var(--color-text-muted);
      }

      .comment-body {
        flex: 1;
        white-space: pre-wrap;
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 5px 8px;
        background: var(--color-canvas-subtle);
        font-size: 0.9rem;
      }

      .comment-input {
        box-sizing: border-box;
        width: 100%;
        min-height: 56px;
        resize: vertical;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 8px 10px;
        background: var(--color-canvas);
        color: var(--color-text);
        font: inherit;
        font-size: 0.9rem;
      }

      .comment-input:focus {
        outline: 2px solid var(--color-accent);
        outline-offset: 1px;
      }

      .comment-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 4px;
      }

      .comment-item-header > .comment-actions {
        margin-top: 0;
      }

      .comment-actions button {
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 2px 7px;
        background: var(--color-canvas);
        color: var(--color-text);
        cursor: pointer;
        font: inherit;
        font-size: 0.82rem;
      }

      .comment-list .comment-body {
        padding: 8px 10px;
      }

      .comment-replies {
        display: grid;
        gap: 6px;
        margin: 8px 0 0 16px;
        border-left: 2px solid var(--color-border);
        padding-left: 10px;
      }

      .comment-reply-label {
        color: var(--color-text-muted);
        font-size: 0.75rem;
        font-weight: 600;
      }

      .comment-reply-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 3px;
      }

      .comment-reply-header .comment-actions {
        margin-top: 0;
      }

      .comment-reply-form {
        margin-top: 8px;
      }

      .comment-list .comment-input {
        min-height: 84px;
      }

      .comment-actions button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .comment-actions button:hover:not(:disabled),
      .comment-actions button:focus-visible {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .comment-error {
        color: #cf222e;
        font-size: 0.82rem;
      }

      .mermaid-container {
        position: relative;
        margin-bottom: 16px;
      }

      .mermaid-container .mermaid {
        margin-bottom: 0;
      }

      .mermaid {
        overflow: auto;
        border: 1px solid var(--color-border-muted);
        border-radius: 6px;
        padding: 16px;
        background: var(--color-canvas-subtle);
      }

      .mermaid-zoom-button {
        position: absolute;
        top: 8px;
        right: 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 4px 8px;
        background: color-mix(in srgb, var(--color-canvas) 92%, transparent);
        color: var(--color-text);
        cursor: pointer;
        font: inherit;
        font-size: 0.8rem;
      }

      .mermaid-zoom-button:hover,
      .mermaid-zoom-button:focus-visible,
      .mermaid-zoom-close:hover,
      .mermaid-zoom-close:focus-visible {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }

      .mermaid-zoom-dialog {
        position: fixed;
        z-index: 1000;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .mermaid-zoom-backdrop {
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / 0.62);
      }

      .mermaid-zoom-content {
        position: relative;
        box-sizing: border-box;
        max-width: min(1200px, 96vw);
        max-height: 92vh;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 44px 16px 16px;
        background: var(--color-canvas);
        box-shadow: 0 16px 48px rgb(0 0 0 / 0.32);
      }

      .mermaid-zoom-close {
        position: absolute;
        top: 8px;
        right: 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-canvas);
        color: var(--color-text);
        cursor: pointer;
        font: inherit;
        font-size: 1.1rem;
        line-height: 1;
      }

      .mermaid-zoom-scroller {
        max-width: calc(96vw - 32px);
        max-height: calc(92vh - 60px);
        overflow: auto;
      }

      .mermaid-zoom-scroller svg {
        display: block;
        max-width: none;
        max-height: none;
      }

      @media (max-width: 640px) {
        main {
          padding: 24px 16px 48px;
        }

        header {
          align-items: stretch;
          flex-direction: column;
        }

        .commentable-block {
          margin-left: 0;
          padding-left: 0;
        }

        .comment-line-button {
          position: static;
          margin: 0 0 6px;
          opacity: 1;
        }

        .comment-item-header {
          align-items: flex-start;
          flex-direction: column;
        }
      }
`;
