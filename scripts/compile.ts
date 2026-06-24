const packagePath = new URL("../package.json", import.meta.url);
const hiddenPackagePath = new URL(
  "../package.json.compile-hidden",
  import.meta.url,
);
const versionPath = new URL("../src/version.ts", import.meta.url);

const parseOutputPath = (args: string[]): string => {
  const outputIndex = args.indexOf("--output");
  if (outputIndex === -1) return "sadoku";

  const outputPath = args[outputIndex + 1];
  if (!outputPath) {
    console.error("Missing value for --output.");
    Deno.exit(1);
  }

  return outputPath;
};

const parseTarget = (args: string[]): string | undefined => {
  const targetIndex = args.indexOf("--target");
  if (targetIndex === -1) return undefined;

  const target = args[targetIndex + 1];
  if (!target) {
    console.error("Missing value for --target.");
    Deno.exit(1);
  }

  return target;
};

const parseVersion = (args: string[]): string | undefined => {
  const versionIndex = args.indexOf("--version");
  if (versionIndex === -1) return undefined;

  const version = args[versionIndex + 1];
  if (!version) {
    console.error("Missing value for --version.");
    Deno.exit(1);
  }

  return version;
};

const versionSource = (version: string): string =>
  `export const version = ${JSON.stringify(version)};\n`;

const outputPath = parseOutputPath(Deno.args);
const target = parseTarget(Deno.args);
const version = parseVersion(Deno.args);
const targetArgs = target ? ["--target", target] : [];
const originalVersionSource = await Deno.readTextFile(versionPath);

const command = new Deno.Command("deno", {
  args: [
    "compile",
    "--node-modules-dir=none",
    "--no-check",
    "--allow-read",
    "--allow-write",
    "--allow-net",
    "--allow-run",
    "--allow-env=BROWSER,HOME,XDG_CONFIG_HOME,XDG_DATA_HOME,APPDATA,SADOKU_COMMENTS_DIR,MDVIEW_COMMENTS_DIR",
    "--include",
    "src/preview/dist",
    ...targetArgs,
    "--output",
    outputPath,
    "src/main.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
});

let exitCode = 0;

try {
  if (version) await Deno.writeTextFile(versionPath, versionSource(version));
  await Deno.rename(packagePath, hiddenPackagePath);
  const result = await command.output();
  if (!result.success) {
    exitCode = result.code;
  }
} finally {
  await Deno.rename(hiddenPackagePath, packagePath).catch(() => undefined);
  if (version) await Deno.writeTextFile(versionPath, originalVersionSource);
}

if (exitCode !== 0) Deno.exit(exitCode);
