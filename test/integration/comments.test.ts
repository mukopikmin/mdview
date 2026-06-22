import { assertEquals } from "@std/assert";

import { getCommentsFilePath } from "../../src/server/comments/storage.ts";
import { createPreviewHandler } from "../../src/server/mod.ts";
import { withTempCommentsDirectory } from "../../src/server/test_helpers.ts";

Deno.test("stores preview comments in the configured comments directory", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);

      const emptyResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const emptyDocument = await emptyResponse.json();
      assertEquals(emptyResponse.status, 200);
      assertEquals(emptyDocument.filePath, filePath);
      assertEquals(emptyDocument.comments, []);

      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ line: 3, body: "Clarify this." }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();
      assertEquals(createResponse.status, 200);
      assertEquals(createdComment.line, 3);
      assertEquals(createdComment.body, "Clarify this.");
      assertEquals(createdComment.originalLine, 3);
      assertEquals(createdComment.replies, []);
      assertEquals(createdComment.resolved, false);
      assertEquals(createdComment.resolvedAt, undefined);
      assertEquals(createdComment.sourceText, "Body");
      assertEquals(createdComment.stale, false);

      const updateResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: "Clarify this paragraph." }),
          },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const updatedComment = await updateResponse.json();
      assertEquals(updateResponse.status, 200);
      assertEquals(updatedComment.body, "Clarify this paragraph.");

      const deleteResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}`,
          { method: "DELETE" },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      assertEquals(deleteResponse.status, 204);

      const storedText = await Deno.readTextFile(getCommentsFilePath(filePath));
      const storedDocument = JSON.parse(storedText);
      assertEquals(storedDocument.comments, []);
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("stores replies on preview comments", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);
      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ line: 3, body: "Question" }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();
      const replyResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/replies`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: "Answer" }),
          },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const updatedComment = await replyResponse.json();

      assertEquals(replyResponse.status, 200);
      assertEquals(updatedComment.replies[0].body, "Answer");

      const storedDocument = JSON.parse(
        await Deno.readTextFile(getCommentsFilePath(filePath)),
      );
      assertEquals(storedDocument.comments[0].replies[0].body, "Answer");
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("resolves and reopens preview comments", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);

      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ line: 3, body: "Clarify this." }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();

      const resolveResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/resolve`,
          { method: "POST" },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const resolvedComment = await resolveResponse.json();
      assertEquals(resolveResponse.status, 200);
      assertEquals(resolvedComment.resolved, true);
      assertEquals(typeof resolvedComment.resolvedAt, "string");

      const resolvedDocumentResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const resolvedDocument = await resolvedDocumentResponse.json();
      assertEquals(resolvedDocument.comments[0].resolved, true);

      const reopenResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}/reopen`,
          { method: "POST" },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const reopenedComment = await reopenResponse.json();
      assertEquals(reopenResponse.status, 200);
      assertEquals(reopenedComment.resolved, false);
      assertEquals(reopenedComment.resolvedAt, undefined);

      const storedText = await Deno.readTextFile(getCommentsFilePath(filePath));
      const storedDocument = JSON.parse(storedText);
      assertEquals(storedDocument.comments[0].resolved, false);
      assertEquals(storedDocument.comments[0].resolvedAt, undefined);
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});

Deno.test("tracks preview comments when their source line moves", async () => {
  await withTempCommentsDirectory(async () => {
    const filePath = await Deno.makeTempFile({
      prefix: "sadoku-",
      suffix: ".md",
    });
    await Deno.writeTextFile(filePath, "# Title\n\nBody\n");
    try {
      const handler = createPreviewHandler(filePath);

      const createResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ line: 3, body: "Clarify this." }),
        }),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const createdComment = await createResponse.json();

      await Deno.writeTextFile(filePath, "Intro\n# Title\n\nBody\n");
      const movedResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const movedDocument = await movedResponse.json();
      assertEquals(movedDocument.comments[0].line, 4);
      assertEquals(movedDocument.comments[0].originalLine, 3);
      assertEquals(movedDocument.comments[0].stale, false);

      const updateResponse = await handler(
        new Request(
          `http://127.0.0.1:3334/__sadoku/comments/${createdComment.id}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: "Clarify this paragraph." }),
          },
        ),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const updatedComment = await updateResponse.json();
      assertEquals(updatedComment.line, 4);
      assertEquals(updatedComment.originalLine, 3);
      assertEquals(updatedComment.stale, false);

      await Deno.writeTextFile(filePath, "Intro\n# Title\n\nChanged\n");
      const staleResponse = await handler(
        new Request("http://127.0.0.1:3334/__sadoku/comments"),
        {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
      );
      const staleDocument = await staleResponse.json();
      assertEquals(staleDocument.comments[0].line, 3);
      assertEquals(staleDocument.comments[0].originalLine, 3);
      assertEquals(staleDocument.comments[0].stale, true);
    } finally {
      await Deno.remove(filePath).catch(() => {});
      await Deno.remove(getCommentsFilePath(filePath)).catch(() => {});
    }
  });
});
