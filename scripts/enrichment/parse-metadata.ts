import { extractDocumentMetadata } from "./document-primitives";

export type { DocumentExtractionResult as ParsedMetadata } from "./strategy-types";

export const parseMetadata = (html: string, url: string) => extractDocumentMetadata(html, url);
