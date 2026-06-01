# mdview

`mdview` is a small CLI for previewing a single Markdown file in your browser.

Run it with a Markdown file path, and it starts a local HTTP server that renders
the file as HTML, then opens the preview in your default browser.

## Install

On macOS, you can build in a temporary directory and install the binary to
`$HOME/.local/bin/mdview`:

```sh
npm install
deno task install:mac --version 0.1.0
```

Or compile a standalone binary in the project directory:

```sh
npm install
deno task compile --version 0.1.0
./mdview README.md
```

If `--version` is omitted, the compiled binary reports the development version
`0.0.0-dev`. Pass the release version explicitly when building release binaries.

## Usage

After compiling or installing the CLI:

```sh
mdview README.md
```

The printed local URL is also available if you want to open it manually.

During development, you can run the CLI with Deno:

```sh
deno task start README.md
```

Options:

```sh
mdview README.md --port 4000 --host 127.0.0.1
mdview README.md --no-open
```

The server reads the Markdown file on each request, so refreshing the page shows
recent edits. The browser preview also reloads automatically when the Markdown
file changes.

## Release Archives

Build release archives under `dist/`:

```sh
npm install
deno task dist --version 0.1.0
```

The release build creates archives for:

- `darwin-arm64`
- `linux-x64`
- `windows-x64`

To build a single target:

```sh
deno task dist --version 0.1.0 --target linux-x64
```

Each archive includes the `mdview` binary, `LICENSE`, and
`THIRD_PARTY_NOTICES.md`. macOS and Linux targets are packaged as `.tar.gz`;
Windows is packaged as `.zip`. `dist/checksums.txt` and per-archive `.sha256`
files are generated for the final archives.

The release build uses the system `tar` command for `.tar.gz` archives and the
system `zip` command for the Windows archive. A full release build requires both
commands. A single-target build only requires the archive command for that
target.

For native targets, the release build starts the compiled binary on
`127.0.0.1:39731` to verify that bundled Mermaid assets can be served.

## Supported Markdown

| Feature                                            | Status        | Notes                                                              |
| -------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| Headings and paragraphs                            | Supported     | Rendered through Markdown-it.                                      |
| Bold and italic emphasis                           | Supported     | `**bold**` and `_italic_` render as emphasis.                      |
| Unordered, ordered, and nested lists               | Supported     | Nested unordered and ordered lists are preserved.                  |
| Blockquotes and horizontal rules                   | Supported     | Standard quote blocks and thematic breaks render normally.         |
| Links and images                                   | Supported     | Link and image titles are preserved.                               |
| Reference-style links and images                   | Supported     | Link definitions such as `[id]: https://example.com` are resolved. |
| Inline code, indented code, and fenced code blocks | Supported     | Code content is escaped by default.                                |
| Hard line breaks                                   | Supported     | Standard Markdown hard breaks render as line breaks.               |
| Backslash escapes and HTML entities                | Supported     | Markdown escapes and entities are handled by Markdown-it.          |
| Heading anchor links                               | Supported     | Headings get stable `id` attributes and clickable anchors.         |
| Plain URL autolinks                                | Supported     | Plain URLs are converted to links.                                 |
| Task list checkboxes                               | Supported     | `- [ ]` and `- [x]` render as disabled checkboxes.                 |
| Strikethrough                                      | Supported     | `~~deleted~~` renders as deleted text.                             |
| GitHub-style tables                                | Supported     | Table alignment markers are preserved.                             |
| Syntax highlighting                                | Supported     | Common code fence languages are highlighted with highlight.js.     |
| Mermaid diagrams                                   | Supported     | Fenced `mermaid` code blocks render in the browser.                |
| Raw HTML                                           | Not supported | Raw HTML is escaped for safer previews.                            |
| Footnotes                                          | Not supported | No footnote plugin is enabled.                                     |
| Definition lists                                   | Not supported | No definition list plugin is enabled.                              |
| Math or LaTeX                                      | Not supported | Math rendering is not bundled.                                     |
| Front matter                                       | Not supported | YAML front matter is rendered as Markdown text.                    |
| Generated table of contents                        | Not supported | Heading anchors are generated, but no TOC is built.                |

Mermaid rendering is served from vendored local assets when a page contains a
Mermaid block.

The vendored Mermaid assets are generated from the npm dependency and are not
meant to be edited by hand:

```sh
npm install
deno task vendor:mermaid
```

Third-party license notices for release archives are generated from the lockfile
and installed package license files. `THIRD_PARTY_NOTICES.md` is generated at
release build time and is not committed:

```sh
npm install
deno task notices
```
