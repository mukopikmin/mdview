import { basename, join } from "@std/path";

type PackageJson = {
  version: string;
};

type Target = {
  id: string;
  denoTarget: string;
  binaryName: string;
  archiveType: "tar.gz" | "zip";
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
    archiveType: "tar.gz",
    native: Deno.build.os === "darwin" && Deno.build.arch === "aarch64",
  },
  {
    id: "linux-x64",
    denoTarget: "x86_64-unknown-linux-gnu",
    binaryName: "mdview",
    archiveType: "tar.gz",
    native: Deno.build.os === "linux" && Deno.build.arch === "x86_64",
  },
  {
    id: "windows-x64",
    denoTarget: "x86_64-pc-windows-msvc",
    binaryName: "mdview.exe",
    archiveType: "zip",
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

const readPackageVersion = async (): Promise<string> => {
  const packageJson: PackageJson = JSON.parse(
    await Deno.readTextFile("package.json"),
  );
  return packageJson.version;
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

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = (value: number): Uint8Array =>
  new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);

const u32 = (value: number): Uint8Array =>
  new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);

const createZip = (entries: ArchiveEntry[]): Uint8Array => {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(33),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    chunks.push(localHeader, entry.data);

    centralDirectory.push(concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(33),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(entry.mode << 16),
      u32(offset),
      name,
    ]));

    offset += localHeader.length + entry.data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectoryData = concat(centralDirectory);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectoryData.length),
    u32(centralDirectoryOffset),
    u16(0),
  ]);

  return concat([...chunks, centralDirectoryData, end]);
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

  const archiveName = `mdview-v${version}-${target.id}.${target.archiveType}`;
  const archivePath = join("dist", archiveName);
  const data = target.archiveType === "tar.gz"
    ? await gzip(createTar(entries))
    : createZip(entries);

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

const version = await readPackageVersion();
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
