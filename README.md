# mdview

`mdview` is a small CLI for previewing a single Markdown file in your browser.

Run it with a Markdown file path, and it starts a local HTTP server that renders
the file as HTML.

## Usage

After compiling or installing the CLI:

```sh
mdview README.md
```

Then open the printed local URL in your browser.

During development, you can run the CLI with Deno:

```sh
deno task start README.md
```

Or compile a standalone binary:

```sh
npm install
deno task compile --version 0.1.0
./mdview README.md
```

Or build release archives under `dist/`:

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
`THIRD_PARTY_NOTICES.md`. `dist/checksums.txt` and per-archive `.sha256` files
are generated for the final archives.

On macOS, you can build in a temporary directory and install the binary to
`$HOME/.local/bin/mdview`:

```sh
npm install
deno task install:mac --version 0.1.0
```

Options:

```sh
mdview README.md --port 4000 --host 127.0.0.1
```

The server reads the Markdown file on each request, so refreshing the page shows
recent edits.

## Supported Markdown

- headings, paragraphs, lists, blockquotes, links, images, inline code, and
  fenced code blocks
- GitHub-style tables
- Mermaid diagrams through fenced `mermaid` code blocks

Example:

````md
| Name  | Count |
| ----- | ----: |
| alpha |     1 |

```mermaid
graph TD
  A --> B
```
````

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
