import { basename, join } from "@std/path";

type Target = {
  id: string;
  denoTarget: string;
  binaryName: string;
  native: boolean;
};

type ArchiveEntry = {
  path: string;
  data: Uint8Array;
  mode: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const targets: Target[] = [
  {
    id: "darwin-arm64",
    denoTarget: "aarch64-apple-darwin",
    binaryName: "mdview",
    native: Deno.build.os === "darwin" && Deno.build.arch === "aarch64",
  },
  {
    id: "linux-x64",
    denoTarget: "x86_64-unknown-linux-gnu",
    binaryName: "mdview",
    native: Deno.build.os === "linux" && Deno.build.arch === "x86_64",
  },
  {
    id: "windows-x64",
    denoTarget: "x86_64-pc-windows-msvc",
    binaryName: "mdview.exe",
    native: Deno.build.os === "windows" && Deno.build.arch === "x86_64",
  },
];

const verificationPort = 39731;

const run = async (args: string[]): Promise<void> => {
  const result = await new Deno.Command(Deno.execPath(), {
    args,
    stdout: "inherit",
    stderr: "inherit",
  }).output();

  if (!result.success) Deno.exit(result.code);
};

const parseSelectedTargets = (args: string[]): Set<string> | undefined => {
  const selected = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--target") continue;
    const target = args[index + 1];
    if (!target) {
      console.error("Missing value for --target.");
      Deno.exit(1);
    }
    selected.add(target);
    index += 1;
  }
  return selected.size ? selected : undefined;
};

const parseVersion = (args: string[]): string => {
  const versionIndex = args.indexOf("--version");
  if (versionIndex === -1) {
    console.error("Missing --version <version> for release archive names.");
    Deno.exit(1);
  }

  const version = args[versionIndex + 1];
  if (!version) {
    console.error("Missing value for --version.");
    Deno.exit(1);
  }

  if (
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)
  ) {
    console.error(`Invalid version: ${version}`);
    Deno.exit(1);
  }

  return version;
};

const ensureKnownTargets = (selected: Set<string> | undefined): void => {
  if (!selected) return;
  const known = new Set(targets.map((target) => target.id));
  for (const target of selected) {
    if (!known.has(target)) {
      console.error(
        `Unknown target: ${target}. Expected one of: ${[...known].join(", ")}`,
      );
      Deno.exit(1);
    }
  }
};

const concat = (chunks: Uint8Array[]): Uint8Array => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const gzip = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([data.buffer as ArrayBuffer]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const writeAscii = (
  buffer: Uint8Array,
  offset: number,
  length: number,
  value: string,
): void => {
  const bytes = encoder.encode(value);
  buffer.set(bytes.slice(0, length), offset);
};

const writeOctal = (
  buffer: Uint8Array,
  offset: number,
  length: number,
  value: number,
): void => {
  const text = value.toString(8).padStart(length - 1, "0");
  writeAscii(buffer, offset, length, text.slice(-length + 1));
};

const createTar = (entries: ArchiveEntry[]): Uint8Array => {
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    const header = new Uint8Array(512);
    writeAscii(header, 0, 100, entry.path);
    writeOctal(header, 100, 8, entry.mode);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, entry.data.length);
    writeOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeAscii(header, 257, 6, "ustar");
    writeAscii(header, 263, 2, "00");

    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeAscii(header, 148, 8, checksum.toString(8).padStart(6, "0"));
    header[154] = 0;
    header[155] = 0x20;

    chunks.push(header, entry.data);
    const padding = (512 - (entry.data.length % 512)) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(1024));
  return concat(chunks);
};

const sha256 = async (path: string): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", await Deno.readFile(path));
  return [...new Uint8Array(hash)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

const archive = async (
  target: Target,
  version: string,
  binaryPath: string,
): Promise<string> => {
  const root = `mdview-v${version}-${target.id}`;
  const entries: ArchiveEntry[] = [
    {
      path: `${root}/${target.binaryName}`,
      data: await Deno.readFile(binaryPath),
      mode: target.binaryName.endsWith(".exe") ? 0o644 : 0o755,
    },
    {
      path: `${root}/LICENSE`,
      data: await Deno.readFile("LICENSE"),
      mode: 0o644,
    },
    {
      path: `${root}/THIRD_PARTY_NOTICES.md`,
      data: await Deno.readFile("THIRD_PARTY_NOTICES.md"),
      mode: 0o644,
    },
  ];

  const archiveName = `mdview-v${version}-${target.id}.tar.gz`;
  const archivePath = join("dist", archiveName);
  const data = await gzip(createTar(entries));

  await Deno.writeFile(archivePath, data);
  return archivePath;
};

const readLineUntilPreview = async (
  child: Deno.ChildProcess,
): Promise<string> => {
  if (!child.stdout) throw new Error("Child stdout is not piped.");
  const reader = child.stdout.getReader();
  let output = "";
  const deadline = Date.now() + 5000;
  let timedOut = false;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const result = await Promise.race([
      reader.read(),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), remaining)
      ),
    ]);
    if (result === "timeout") {
      timedOut = true;
      break;
    }
    if (result.done) break;
    output += decoder.decode(result.value);
    const match = output.match(/Preview: (http:\/\/[^\s]+)/);
    if (match) return match[1];
  }

  if (timedOut) {
    try {
      child.kill("SIGTERM");
      await child.status.catch(() => undefined);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
  }

  const stderr = child.stderr
    ? decoder.decode(await new Response(child.stderr).arrayBuffer())
    : "";
  throw new Error(
    `Timed out waiting for preview URL.\nStdout:\n${output}\nStderr:\n${stderr}`,
  );
};

const verifyNativeBinary = async (binaryPath: string): Promise<void> => {
  const fixture = await Deno.makeTempFile({
    prefix: "mdview-release-",
    suffix: ".md",
  });
  await Deno.writeTextFile(
    fixture,
    "```mermaid\ngraph TD\n  A --> B\n```\n",
  );

  const child = new Deno.Command(binaryPath, {
    args: [fixture, "--host", "127.0.0.1", "--port", String(verificationPort)],
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  try {
    const url = await readLineUntilPreview(child);
    const html = await (await fetch(url)).text();
    if (!html.includes("/assets/mermaid.esm.min.mjs")) {
      throw new Error("Preview page did not include the Mermaid asset import.");
    }

    const asset = await fetch(new URL("/assets/mermaid.esm.min.mjs", url));
    if (!asset.ok) {
      throw new Error(`Mermaid asset request failed with ${asset.status}.`);
    }
    console.log("Verified native binary and bundled Mermaid asset.");
  } finally {
    try {
      child.kill("SIGTERM");
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    await child.status.catch(() => undefined);
    await Deno.remove(fixture).catch(() => undefined);
  }
};

const selected = parseSelectedTargets(Deno.args);
ensureKnownTargets(selected);

const version = parseVersion(Deno.args);
const releaseTargets = targets.filter((target) =>
  selected ? selected.has(target.id) : true
);

await Deno.mkdir("dist", { recursive: true });
await run(["task", "vendor:mermaid"]);
await run(["task", "notices"]);

const checksums: string[] = [];

for (const target of releaseTargets) {
  const buildDir = await Deno.makeTempDir({ prefix: `mdview-${target.id}-` });
  const binaryPath = join(buildDir, target.binaryName);

  try {
    await run([
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-run=deno",
      "scripts/compile.ts",
      "--version",
      version,
      "--target",
      target.denoTarget,
      "--output",
      binaryPath,
    ]);

    if (target.native) await verifyNativeBinary(binaryPath);

    const archivePath = await archive(target, version, binaryPath);
    const archiveChecksum = await sha256(archivePath);
    checksums.push(`${archiveChecksum}  ${basename(archivePath)}`);
    await Deno.writeTextFile(`${archivePath}.sha256`, `${archiveChecksum}\n`);
    console.log(`Created ${archivePath}`);
  } finally {
    await Deno.remove(buildDir, { recursive: true }).catch(() => undefined);
  }
}

await Deno.writeTextFile("dist/checksums.txt", `${checksums.join("\n")}\n`);
console.log("Created dist/checksums.txt");
