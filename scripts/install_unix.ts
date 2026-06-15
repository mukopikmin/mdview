import { join } from "@std/path";

type CompileBinary = (
  buildPath: string,
  compileArgs: string[],
) => Promise<void>;

type InstallUnixOptions = {
  compileArgs?: string[];
  compileBinary?: CompileBinary;
  home?: string;
  os?: string;
};

class CompileError extends Error {
  constructor(readonly exitCode: number) {
    super(`Compilation failed with exit code ${exitCode}.`);
  }
}

export const supportsUnixInstall = (os: string): boolean =>
  os === "darwin" || os === "linux";

export const getUnixInstallPath = (home: string): string =>
  join(home, ".local", "bin", "mdview");

const compileBinary: CompileBinary = async (buildPath, compileArgs) => {
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-run=deno",
      "scripts/compile.ts",
      ...compileArgs,
      "--output",
      buildPath,
    ],
    stdout: "inherit",
    stderr: "inherit",
  }).output();

  if (!result.success) {
    throw new CompileError(result.code);
  }
};

export const installUnix = async (
  options: InstallUnixOptions = {},
): Promise<string> => {
  const os = options.os ?? Deno.build.os;
  if (!supportsUnixInstall(os)) {
    throw new Error("This installer supports only macOS and Linux.");
  }

  const home = options.home ?? Deno.env.get("HOME");
  if (!home) {
    throw new Error("HOME is not set.");
  }

  const installPath = getUnixInstallPath(home);
  const buildDir = await Deno.makeTempDir({ prefix: "mdview-" });
  const buildPath = join(buildDir, "mdview");

  try {
    await (options.compileBinary ?? compileBinary)(
      buildPath,
      options.compileArgs ?? Deno.args,
    );

    await Deno.mkdir(join(home, ".local", "bin"), { recursive: true });
    await Deno.copyFile(buildPath, installPath);
    await Deno.chmod(installPath, 0o755);
    return installPath;
  } finally {
    await Deno.remove(buildDir, { recursive: true }).catch(() => undefined);
  }
};

if (import.meta.main) {
  try {
    console.log(`Installed mdview to ${await installUnix()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(error instanceof CompileError ? error.exitCode : 1);
  }
}
