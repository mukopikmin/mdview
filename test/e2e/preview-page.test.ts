import { assertMatch } from "@std/assert";
import { basename, join, toFileUrl } from "@std/path";
import { escapeHtml, renderMarkdown } from "../../src/markdown/html.ts";
import { renderPreviewPage } from "../../src/preview/page.ts";

const fixturePath = join(
  Deno.cwd(),
  "test",
  "e2e",
  "fixtures",
  "comprehensive.md",
);

Deno.test("renders a comprehensive markdown fixture into a preview page", async () => {
  const markdown = await Deno.readTextFile(fixturePath);
  const html = renderPreviewPage({
    title: escapeHtml(basename(fixturePath)),
    fileUrl: toFileUrl(fixturePath).href,
    body: renderMarkdown(markdown),
  });

  assertMatch(html, /<title>comprehensive\.md<\/title>/);
  assertMatch(
    html,
    /<h1 id="comprehensive-document"><a class="heading-anchor" href="#comprehensive-document">Comprehensive Document<\/a><\/h1>/,
  );
  assertMatch(html, /<strong>bold<\/strong>/);
  assertMatch(html, /<em>italic<\/em>/);
  assertMatch(html, /<del>deleted<\/del>/);
  assertMatch(html, /<code>inline code<\/code>/);
  assertMatch(html, /<a href="https:\/\/example\.com">a link<\/a>/);
  assertMatch(
    html,
    /<img src="image\.png" alt="an image" title="Image title">/,
  );
  assertMatch(
    html,
    /<ul>\n<li>unordered one<\/li>\n<li>unordered <strong>two<\/strong>\n<ul>\n<li>nested unordered\n<ol>\n<li>nested ordered<\/li>\n<\/ol>\n<\/li>\n<\/ul>\n<\/li>\n<\/ul>/,
  );
  assertMatch(
    html,
    /<ol>\n<li>ordered one<\/li>\n<li>ordered two<\/li>\n<\/ol>/,
  );
  assertMatch(
    html,
    /<li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled> unchecked task<\/li>/,
  );
  assertMatch(
    html,
    /<li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled checked> checked task<\/li>/,
  );
  assertMatch(html, /<blockquote>/);
  assertMatch(html, /<hr>/);
  assertMatch(html, /<table>/);
  assertMatch(html, /<th style="text-align:center">Status<\/th>/);
  assertMatch(html, /<td style="text-align:right">2<\/td>/);
  assertMatch(
    html,
    /<pre><code class="hljs language-js"><span class="hljs-variable language_">console<\/span>\.<span class="hljs-title function_">log<\/span>\(<span class="hljs-string">&quot;&lt;escaped&gt;&quot;<\/span>\);<\/code><\/pre>/,
  );
  assertMatch(
    html,
    /<pre class="mermaid">graph TD\n  CLI\[CLI\] --&gt; Server\[Server\]/,
  );
  assertMatch(html, /import mermaid from "\/assets\/mermaid\.esm\.min\.mjs"/);
  assertMatch(html, /new EventSource\("\/__mdview\/events"\)/);
  assertMatch(html, /events\.addEventListener\("reload"/);
  assertMatch(html, /window\.location\.reload\(\)/);
  assertMatch(html, /<pre><code class="hljs language-md">/);
  assertMatch(html, /<span class="hljs-code">```mermaid\n/);
  assertMatch(html, /&lt;script&gt;alert\(&quot;nope&quot;\)&lt;\/script&gt;/);
});
