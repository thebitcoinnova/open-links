import assert from "node:assert/strict";
import test from "node:test";
import { downloadVCardFile } from "./download-vcard";

test("downloadVCardFile creates a vCard blob and clicks a download anchor", () => {
  // Arrange
  const createdBlobs: Array<{ parts: unknown[]; type?: string }> = [];
  class FakeBlob {
    constructor(parts: unknown[], options?: { type?: string }) {
      createdBlobs.push({ parts, type: options?.type });
    }
  }
  const clicked: Array<{ download: string; href: string; rel: string }> = [];
  const anchor = {
    download: "",
    href: "",
    rel: "",
    click() {
      clicked.push({
        download: this.download,
        href: this.href,
        rel: this.rel,
      });
    },
  };
  const revokedUrls: string[] = [];

  // Act
  const downloaded = downloadVCardFile(
    {
      contents: "BEGIN:VCARD\r\nEND:VCARD\r\n",
      filename: "peter.vcf",
    },
    {
      BlobCtor: FakeBlob as unknown as typeof Blob,
      createObjectUrl: () => "blob:openlinks-vcard",
      document: {
        createElement: () => anchor,
      } as unknown as Document,
      revokeObjectUrl: (url) => revokedUrls.push(url),
    },
  );

  // Assert
  assert.equal(downloaded, true);
  assert.deepEqual(createdBlobs, [
    {
      parts: ["BEGIN:VCARD\r\nEND:VCARD\r\n"],
      type: "text/vcard;charset=utf-8",
    },
  ]);
  assert.deepEqual(clicked, [
    {
      download: "peter.vcf",
      href: "blob:openlinks-vcard",
      rel: "noopener",
    },
  ]);
  assert.deepEqual(revokedUrls, ["blob:openlinks-vcard"]);
});

test("downloadVCardFile reports unsupported browser primitives", () => {
  // Arrange
  const missingDocument = {
    BlobCtor: Blob,
    createObjectUrl: () => "blob:openlinks-vcard",
  };

  // Act
  const downloaded = downloadVCardFile(
    {
      contents: "BEGIN:VCARD\r\nEND:VCARD\r\n",
      filename: "peter.vcf",
    },
    missingDocument,
  );

  // Assert
  assert.equal(downloaded, false);
});
