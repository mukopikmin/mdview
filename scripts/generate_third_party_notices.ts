type PackageLock = {
  packages?: Record<string, {
    version?: string;
    license?: string;
    resolved?: string;
  }>;
};

type DenoConfig = {
  imports?: Record<string, string>;
};

type DenoLock = {
  specifiers?: Record<string, string>;
};

type Notice = {
  name: string;
  version: string;
  license: string;
  source: string;
  licenseText?: string;
};

const textDecoder = new TextDecoder();

const readText = async (path: string): Promise<string> =>
  textDecoder.decode(await Deno.readFile(path));

const exists = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};

const findLicenseText = async (
  packageDir: string,
): Promise<string | undefined> => {
  const candidates = [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "license",
    "license.md",
    "license.txt",
    "COPYING",
    "COPYING.md",
    "COPYING.txt",
  ];

  for (const candidate of candidates) {
    const path = `${packageDir}/${candidate}`;
    if (await exists(path)) return await readText(path);
  }

  return undefined;
};

const packageNameFromLockPath = (path: string): string =>
  path.replace(/^node_modules\//, "");

const packageDirFromLockPath = (path: string): string =>
  `node_modules/${packageNameFromLockPath(path)}`;

const readPackageJson = async (
  packageDir: string,
): Promise<Record<string, unknown> | undefined> => {
  const path = `${packageDir}/package.json`;
  if (!(await exists(path))) return undefined;
  return JSON.parse(await readText(path));
};

const repositoryUrl = (
  packageJson: Record<string, unknown> | undefined,
): string => {
  const repository = packageJson?.repository;
  if (typeof repository === "string") {
    return repository.includes("://")
      ? repository
      : `https://github.com/${repository}`;
  }
  if (
    repository && typeof repository === "object" && "url" in repository &&
    typeof repository.url === "string"
  ) {
    return repository.url;
  }
  return "";
};

const noticeKey = (notice: Notice): string =>
  `${notice.name}@${notice.version}:${notice.source}`;

const collectNpmNotices = async (): Promise<Notice[]> => {
  const lock: PackageLock = JSON.parse(await readText("package-lock.json"));
  const packages = lock.packages ?? {};
  const notices: Notice[] = [];

  for (const [path, metadata] of Object.entries(packages)) {
    if (!path.startsWith("node_modules/")) continue;
    if (!metadata.version || !metadata.license) continue;

    const packageDir = packageDirFromLockPath(path);
    const packageJson = await readPackageJson(packageDir);
    notices.push({
      name: packageNameFromLockPath(path),
      version: metadata.version,
      license: metadata.license,
      source: repositoryUrl(packageJson) || metadata.resolved ||
        "package-lock.json",
      licenseText: await findLicenseText(packageDir),
    });
  }

  return notices;
};

const packageFromEsmShSpecifier = (
  specifier: string,
): { name: string; version: string } | undefined => {
  const url = new URL(specifier);
  if (url.hostname !== "esm.sh") return undefined;

  const path = url.pathname.replace(/^\/+/, "");
  const scoped = path.startsWith("@");
  const packagePart = scoped
    ? path.split("/").slice(0, 2).join("/")
    : path.split("/")[0];
  const versionIndex = packagePart.lastIndexOf("@");
  if (versionIndex <= 0) return undefined;

  return {
    name: packagePart.slice(0, versionIndex),
    version: packagePart.slice(versionIndex + 1),
  };
};

const collectDirectEsmShNotices = async (): Promise<Notice[]> => {
  const config: DenoConfig = JSON.parse(await readText("deno.json"));
  const notices: Notice[] = [];

  for (const specifier of Object.values(config.imports ?? {})) {
    if (!specifier.startsWith("https://esm.sh/")) continue;
    const parsed = packageFromEsmShSpecifier(specifier);
    if (!parsed) continue;

    const packageDir = `node_modules/${parsed.name}`;
    const packageJson = await readPackageJson(packageDir);
    const license = typeof packageJson?.license === "string"
      ? packageJson.license
      : "UNKNOWN";

    notices.push({
      name: parsed.name,
      version: parsed.version,
      license,
      source: repositoryUrl(packageJson) || specifier,
      licenseText: await findLicenseText(packageDir),
    });
  }

  return notices;
};

const collectDenoNotices = async (): Promise<Notice[]> => {
  const lock: DenoLock = JSON.parse(await readText("deno.lock"));
  const stdPackages = Object.entries(lock.specifiers ?? {})
    .filter(([specifier]) => specifier.startsWith("jsr:@std/"))
    .map(([specifier, version]) => {
      const packageName = specifier.replace(/^jsr:/, "").replace(
        /@[^@]+$/,
        "",
      );
      return {
        name: packageName,
        version,
        license: "MIT",
        source: `https://jsr.io/${packageName}@${version}`,
      };
    });

  return [
    {
      name: "Deno runtime",
      version: Deno.version.deno,
      license: "MIT",
      source: "https://github.com/denoland/deno",
    },
    ...stdPackages,
  ];
};

const normalizeLicenseText = (text: string): string =>
  text.trim().replace(/\r\n/g, "\n");

const renderTable = (notices: Notice[]): string => {
  const rows = [
    ["Package", "Version", "License", "Source"],
    ...notices.map((notice) => [
      notice.name,
      notice.version,
      notice.license,
      notice.source,
    ]),
  ];
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length))
  );
  const renderRow = (row: string[]): string =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
  const separator = `| ${
    widths.map((width) => "-".repeat(width)).join(" | ")
  } |`;

  return [
    renderRow(rows[0]),
    separator,
    ...rows.slice(1).map(renderRow),
  ].join("\n");
};

const render = (notices: Notice[]): string => {
  const sorted = notices.toSorted((a, b) =>
    a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  );

  const licenseTexts = sorted
    .filter((notice) => notice.licenseText)
    .map((notice) =>
      `## ${notice.name} ${notice.version}\n\n` +
      `License: ${notice.license}\n\n` +
      "```text\n" +
      `${normalizeLicenseText(notice.licenseText ?? "")}\n` +
      "```"
    ).join("\n\n");

  return `# Third Party Notices

This file is generated by \`deno task notices\`.

The mdview release archives include a compiled Deno runtime and bundled
JavaScript assets. The following third-party components are included directly or
through bundled dependencies.

## Summary

${renderTable(sorted)}

## License Texts

${licenseTexts}
`;
};

const outputPath = Deno.args[0] ?? "THIRD_PARTY_NOTICES.md";
const notices = [
  ...await collectDenoNotices(),
  ...await collectDirectEsmShNotices(),
  ...await collectNpmNotices(),
];

const uniqueNotices = [...new Map(notices.map((notice) => [
  noticeKey(notice),
  notice,
])).values()];

await Deno.writeTextFile(outputPath, render(uniqueNotices));
console.log(`Generated ${outputPath}`);
