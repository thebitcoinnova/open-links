import type { ProfileVCardDownload } from "./profile-vcard";

interface DownloadVCardFileDependencies {
  BlobCtor?: typeof Blob;
  createObjectUrl?: (blob: Blob) => string;
  document?: Document;
  revokeObjectUrl?: (url: string) => void;
}

const resolveDependencies = (): DownloadVCardFileDependencies => ({
  BlobCtor: typeof Blob === "undefined" ? undefined : Blob,
  createObjectUrl:
    typeof URL === "undefined" || typeof URL.createObjectURL !== "function"
      ? undefined
      : URL.createObjectURL.bind(URL),
  document: typeof document === "undefined" ? undefined : document,
  revokeObjectUrl:
    typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function"
      ? undefined
      : URL.revokeObjectURL.bind(URL),
});

export const downloadVCardFile = (
  vcard: ProfileVCardDownload,
  dependencies: DownloadVCardFileDependencies = resolveDependencies(),
): boolean => {
  if (!dependencies.BlobCtor || !dependencies.createObjectUrl || !dependencies.document) {
    return false;
  }

  const blob = new dependencies.BlobCtor([vcard.contents], {
    type: "text/vcard;charset=utf-8",
  });
  const url = dependencies.createObjectUrl(blob);
  const anchor = dependencies.document.createElement("a");

  anchor.href = url;
  anchor.download = vcard.filename;
  anchor.rel = "noopener";
  anchor.click();
  dependencies.revokeObjectUrl?.(url);

  return true;
};
