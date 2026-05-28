import { assertEquals, assertMatch } from "@std/assert";
import { renderMarkdown } from "../../src/markdown/html.ts";

Deno.test("renders common Markdown blocks", () => {
  const html = renderMarkdown(`# Title

Hello **world** and *friends*.

- one
- two

\`\`\`js
console.log("<ok>");
\`\`\`
`);

  assertMatch(
    html,
    /<h1 id="title"><a class="heading-anchor" href="#title">Title<\/a><\/h1>/,
  );
  assertMatch(html, /<strong>world<\/strong>/);
  assertMatch(html, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/);
  assertMatch(
    html,
    /<pre><code class="hljs language-js"><span class="hljs-variable language_">console<\/span>\.<span class="hljs-title function_">log<\/span>\(<span class="hljs-string">&quot;&lt;ok&gt;&quot;<\/span>\);<\/code><\/pre>/,
  );
});

Deno.test("renders stable heading anchor links", () => {
  const html = renderMarkdown(`# Title!

## Title!

### **Rich** \`Heading\`
`);

  assertMatch(
    html,
    /<h1 id="title"><a class="heading-anchor" href="#title">Title!<\/a><\/h1>/,
  );
  assertMatch(
    html,
    /<h2 id="title-1"><a class="heading-anchor" href="#title-1">Title!<\/a><\/h2>/,
  );
  assertMatch(
    html,
    /<h3 id="rich-heading"><a class="heading-anchor" href="#rich-heading"><strong>Rich<\/strong> <code>Heading<\/code><\/a><\/h3>/,
  );
});

Deno.test("escapes raw html", () => {
  assertEquals(
    renderMarkdown("<script>alert(1)</script>"),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
  );
});

Deno.test("renders links and images with titles", () => {
  const html = renderMarkdown(
    '[site](https://example.com "Site title") ![logo](logo.png "Logo title")',
  );

  assertEquals(
    html,
    '<p><a href="https://example.com" title="Site title">site</a> <img src="logo.png" alt="logo" title="Logo title"></p>',
  );
});

Deno.test("renders markdown tables", () => {
  const html = renderMarkdown(`| Name | Count |
| ---- | ----: |
| alpha | 1 |
| **beta** | 20 |
`);

  assertMatch(html, /<table>/);
  assertMatch(html, /<th>Name<\/th>/);
  assertMatch(html, /<th style="text-align:right">Count<\/th>/);
  assertMatch(html, /<td><strong>beta<\/strong><\/td>/);
  assertMatch(html, /<td style="text-align:right">20<\/td>/);
});

Deno.test("renders nested lists inside parent list items", () => {
  const html = renderMarkdown(`- parent
  - child
    1. ordered child
- sibling
`);

  assertEquals(
    html,
    `<ul>
<li>parent
<ul>
<li>child
<ol>
<li>ordered child</li>
</ol>
</li>
</ul>
</li>
<li>sibling</li>
</ul>`,
  );
});

Deno.test("renders mermaid code fences for browser-side diagrams", () => {
  const html = renderMarkdown(`\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`);

  assertEquals(
    html,
    `<pre class="mermaid">graph TD
  A --&gt; B</pre>`,
  );
});

Deno.test("renders longer code fences without treating nested shorter fences as blocks", () => {
  const html = renderMarkdown(`\`\`\`\`md
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`
`);

  assertMatch(html, /<pre><code class="hljs language-md">/);
  assertMatch(html, /<span class="hljs-code">```mermaid/);
  assertMatch(html, /A --&gt; B/);
});
