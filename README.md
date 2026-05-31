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
deno task compile
./mdview README.md
```

On macOS, you can build in a temporary directory and install the binary to
`$HOME/.local/bin/mdview`:

```sh
npm install
deno task install:mac
```

Options:

```sh
mdview README.md --port 4000 --host 127.0.0.1
```

The server reads the Markdown file on each request, so refreshing the page shows
recent edits. The browser preview also reloads automatically when the Markdown
file changes.

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
