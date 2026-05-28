const packagePath = new URL("../package.json", import.meta.url);
const hiddenPackagePath = new URL(
  "../package.json.compile-hidden",
  import.meta.url,
);

const parseOutputPath = (args: string[]): string => {
  const outputIndex = args.indexOf("--output");
  if (outputIndex === -1) return "mdview";

  const outputPath = args[outputIndex + 1];
  if (!outputPath) {
    console.error("Missing value for --output.");
    Deno.exit(1);
  }

  return outputPath;
};

const outputPath = parseOutputPath(Deno.args);

const command = new Deno.Command(Deno.execPath(), {
  args: [
    "compile",
    "--node-modules-dir=none",
    "--no-check",
    "--allow-read",
    "--allow-net",
    "--include",
    "src/vendor/mermaid/mermaid.esm.min.mjs",
    "--include",
    "src/vendor/mermaid/chunks/mermaid.esm.min",
    "--output",
    outputPath,
    "src/main.ts",
  ],
  stdout: "inherit",
  stderr: "inherit",
});

try {
  await Deno.rename(packagePath, hiddenPackagePath);
  const result = await command.output();
  if (!result.success) {
    Deno.exit(result.code);
  }
} finally {
  await Deno.rename(hiddenPackagePath, packagePath).catch(() => undefined);
}
