import { normalize } from "@std/path";

const previewAssetRoot = new URL("../preview/static/", import.meta.url);

const readAsset = async (
  pathname: string,
  prefix: string,
  root: URL,
): Promise<Uint8Array | undefined> => {
  const relativePath = decodeURIComponent(pathname.slice(prefix.length));
  if (
    !relativePath || relativePath.includes("..") || relativePath.startsWith("/")
  ) {
    return undefined;
  }

  const assetUrl = new URL(normalize(relativePath), root);
  if (!assetUrl.href.startsWith(root.href)) {
    return undefined;
  }

  return await Deno.readFile(assetUrl).catch(() => undefined);
};

export const readPreviewAsset = async (
  pathname: string,
): Promise<Uint8Array | undefined> => {
  return await readAsset(pathname, "/assets/", previewAssetRoot);
};
