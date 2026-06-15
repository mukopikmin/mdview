# mdview

`mdview` is a small CLI for previewing one Markdown file in your browser.

Pass it a Markdown file path. It starts a local HTTP server, renders the file as
HTML, prints the preview URL, and opens that URL in your default browser.

## Install

On Linux and macOS, you can build in a temporary directory and install the
binary to `$HOME/.local/bin/mdview`:

```sh
npm install
deno task install --version 0.1.0
```

Make sure `$HOME/.local/bin` is included in your `PATH`.

Or compile a standalone binary in the project directory:

```sh
npm install
deno task compile --version 0.1.0
./mdview README.md
```

If `--version` is omitted, the compiled binary reports the development version
`0.0.0-dev`. Pass the release version explicitly when building release binaries.

## Usage

```sh
mdview <file.md> [options]
```

Preview a file:

```sh
mdview README.md
```

Use a different port:

```sh
mdview README.md --port 4000
```

If the requested port is already in use, `mdview` increments it until an
available port is found.

Bind to a specific host and port:

```sh
mdview README.md --host 127.0.0.1 --port 4000
```

Print the URL without opening a browser:

```sh
mdview README.md --no-open
```

Keep the server running after the preview tab is closed:

```sh
mdview README.md --keep-alive
```

By default, the server reads the Markdown file again on each request, so
refreshing the page shows recent edits. The browser preview also reloads
automatically when the Markdown file changes.

By default, the server stops after the browser tab is closed. Use `--keep-alive`
when you want to leave the server running.

Comments are stored outside the Markdown file's directory so they do not appear
as repository changes. The default comments directory is:

- macOS: `~/Library/Application Support/mdview/comments`
- Linux: `$XDG_DATA_HOME/mdview/comments`, or `~/.local/share/mdview/comments`
- Windows: `%APPDATA%\mdview\comments`

Set `MDVIEW_COMMENTS_DIR` to choose a different comments directory.

List stored comment files:

```sh
mdview comments list
```

Inspect unresolved comments for a Markdown file as JSON:

```sh
mdview comments inspect README.md
```

Reply to a comment without resolving it:

```sh
mdview comments reply README.md <comment-id> "Need more context."
```

Mark one or more comments as resolved:

```sh
mdview comments resolve README.md <comment-id>...
```

The list shows each stored comment file, the target Markdown path, comment
count, unresolved comment count, and the latest `updatedAt` value from the
stored comments.

Remove a stored comment file by passing the `FILE` value from
`mdview comments list`:

```sh
mdview comments rm README.md-1a2b3c4d.json
```

The remove command prompts before deleting. Pass `--force` to skip the prompt:

```sh
mdview comments rm README.md-1a2b3c4d.json --force
```

## Options

| Option              | Description                                                | Default                |
| ------------------- | ---------------------------------------------------------- | ---------------------- |
| `-p, --port <port>` | Starting port. Increments when in use.                     | `3334`                 |
| `--host <host>`     | Hostname or IP address to bind.                            | `127.0.0.1`            |
| `--no-open`         | Do not open the preview URL in your browser automatically. | Opens browser          |
| `--keep-alive`      | Keep the server running after the browser tab is closed.   | Stops after tab closes |
| `-v, --version`     | Print the CLI version.                                     |                        |
| `-h, --help`        | Print command help.                                        |                        |

## Browser Opening

`mdview` opens the preview with the platform default opener:

- macOS: `open`
- Windows: `cmd /c start`
- Linux: `xdg-open`

Set `BROWSER` to choose the opener command explicitly. If the command contains
`%s`, `mdview` replaces it with the preview URL. Otherwise, the URL is appended
as the last argument.

```sh
BROWSER=explorer.exe mdview README.md
BROWSER='chrome.exe --new-window %s' mdview README.md
```

## Development

Install dependencies:

```sh
npm install
```

Run the CLI with Deno:

```sh
deno task start README.md
```

Compile a standalone binary:

```sh
deno task compile
./mdview README.md
```

On Linux and macOS, build in a temporary directory and install the binary to
`$HOME/.local/bin/mdview`:

```sh
deno task install
```

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
| Headings and paragraphs                            | Supported     | Rendered through the React preview client.                         |
| Bold and italic emphasis                           | Supported     | `**bold**` and `_italic_` render as emphasis.                      |
| Unordered, ordered, and nested lists               | Supported     | Nested unordered and ordered lists are preserved.                  |
| Blockquotes and horizontal rules                   | Supported     | Standard quote blocks and thematic breaks render normally.         |
| Links and images                                   | Supported     | Link and image titles are preserved.                               |
| Reference-style links and images                   | Supported     | Link definitions such as `[id]: https://example.com` are resolved. |
| Inline code, indented code, and fenced code blocks | Supported     | Code content is escaped by default.                                |
| Hard line breaks                                   | Supported     | Standard Markdown hard breaks render as line breaks.               |
| Backslash escapes and HTML entities                | Supported     | Markdown escapes and entities are handled by the Markdown parser.  |
| Heading anchor links                               | Supported     | Headings get stable `id` attributes and clickable anchors.         |
| Plain URL autolinks                                | Supported     | Plain URLs are converted to links.                                 |
| Task list checkboxes                               | Supported     | `- [ ]` and `- [x]` render as disabled checkboxes.                 |
| Strikethrough                                      | Supported     | `~~deleted~~` renders as deleted text.                             |
| GitHub-style tables                                | Supported     | Table alignment markers are preserved.                             |
| Syntax highlighting                                | Supported     | Common code fence languages are highlighted with highlight.js.     |
| Mermaid diagrams                                   | Supported     | Fenced `mermaid` code blocks render from local preview assets.     |
| Raw HTML                                           | Not supported | Raw HTML is escaped for safer previews.                            |
| Footnotes                                          | Not supported | No footnote plugin is enabled.                                     |
| Definition lists                                   | Not supported | No definition list plugin is enabled.                              |
| Math or LaTeX                                      | Not supported | Math rendering is not bundled.                                     |
| Front matter                                       | Not supported | YAML front matter is rendered as Markdown text.                    |
| Generated table of contents                        | Not supported | Heading anchors are generated, but no TOC is built.                |

Mermaid rendering is served from local preview assets generated by
`npm run build:client`.

Third-party license notices for release archives are generated from lockfiles
and installed package license files. `THIRD_PARTY_NOTICES.md` is generated at
release build time and is not committed:

```sh
npm install
deno task notices
```
