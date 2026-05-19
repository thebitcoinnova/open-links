interface VCardPhotoFetchResponse {
  ok?: boolean;
  blob: () => Promise<Blob>;
}

interface VCardPhotoDependencies {
  btoa?: (value: string) => string;
  fetch?: (sourceUrl: string) => Promise<VCardPhotoFetchResponse>;
}

export interface ResolveVCardPhotoUriInput {
  enabled?: boolean;
  sourceUrl?: string;
  dependencies?: VCardPhotoDependencies;
}

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveDependencies = (): VCardPhotoDependencies => ({
  btoa: typeof btoa === "undefined" ? undefined : btoa.bind(globalThis),
  fetch: typeof fetch === "undefined" ? undefined : fetch.bind(globalThis),
});

const inferImageMediaType = (sourceUrl: string, blobType: string): string | undefined => {
  const normalizedBlobType = blobType.split(";")[0]?.trim().toLowerCase();
  if (normalizedBlobType?.startsWith("image/")) {
    return normalizedBlobType;
  }

  const path = sourceUrl.split(/[?#]/u)[0]?.toLowerCase() ?? "";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (path.endsWith(".png")) {
    return "image/png";
  }
  if (path.endsWith(".webp")) {
    return "image/webp";
  }
  if (path.endsWith(".gif")) {
    return "image/gif";
  }
  if (path.endsWith(".svg")) {
    return "image/svg+xml";
  }

  return undefined;
};

const encodeBytes = (bytes: Uint8Array, btoaFn: (value: string) => string): string => {
  const chunkSize = 0x8000;
  const chunks: string[] = [];

  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.slice(index, index + chunkSize)));
  }

  return btoaFn(chunks.join(""));
};

export const resolveVCardPhotoUri = async ({
  dependencies = resolveDependencies(),
  enabled,
  sourceUrl,
}: ResolveVCardPhotoUriInput): Promise<string | undefined> => {
  const resolvedSourceUrl = trimToUndefined(sourceUrl);
  if (enabled !== true || !resolvedSourceUrl || !dependencies.fetch || !dependencies.btoa) {
    return undefined;
  }

  try {
    const response = await dependencies.fetch(resolvedSourceUrl);
    if (response.ok === false) {
      return undefined;
    }

    const blob = await response.blob();
    const mediaType = inferImageMediaType(resolvedSourceUrl, blob.type);
    if (!mediaType) {
      return undefined;
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    return `data:${mediaType};base64,${encodeBytes(bytes, dependencies.btoa)}`;
  } catch {
    return undefined;
  }
};
