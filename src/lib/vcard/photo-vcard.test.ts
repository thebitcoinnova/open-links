import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { resolveVCardPhotoUri } from "./photo-vcard";

const encodeBinary = (value: string): string => Buffer.from(value, "binary").toString("base64");

test("resolveVCardPhotoUri embeds fetched image blobs as data URIs", async () => {
  // Arrange
  const fetchedUrls: string[] = [];

  // Act
  const result = await resolveVCardPhotoUri({
    enabled: true,
    sourceUrl: "/cache/profile-avatar/profile-avatar.jpg",
    dependencies: {
      btoa: encodeBinary,
      fetch: async (sourceUrl) => {
        fetchedUrls.push(sourceUrl);
        return {
          ok: true,
          blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
        };
      },
    },
  });

  // Assert
  assert.deepEqual(fetchedUrls, ["/cache/profile-avatar/profile-avatar.jpg"]);
  assert.equal(result, "data:image/jpeg;base64,AQID");
});

test("resolveVCardPhotoUri infers image media type from source path", async () => {
  // Act
  const result = await resolveVCardPhotoUri({
    enabled: true,
    sourceUrl: "/cache/profile-avatar/profile-avatar.png?version=1",
    dependencies: {
      btoa: encodeBinary,
      fetch: async () => ({
        ok: true,
        blob: async () => new Blob([new Uint8Array([4, 5, 6])]),
      }),
    },
  });

  // Assert
  assert.equal(result, "data:image/png;base64,BAUG");
});

test("resolveVCardPhotoUri skips disabled or unsupported photo inputs", async () => {
  // Arrange
  let fetchCount = 0;

  // Act
  const disabled = await resolveVCardPhotoUri({
    enabled: false,
    sourceUrl: "/cache/profile-avatar/profile-avatar.jpg",
    dependencies: {
      btoa: encodeBinary,
      fetch: async () => {
        fetchCount += 1;
        return {
          ok: true,
          blob: async () => new Blob([new Uint8Array([1])], { type: "image/jpeg" }),
        };
      },
    },
  });
  const unsupported = await resolveVCardPhotoUri({
    enabled: true,
    sourceUrl: "/avatar.bin",
    dependencies: {
      btoa: encodeBinary,
      fetch: async () => ({
        ok: true,
        blob: async () => new Blob([new Uint8Array([1])], { type: "application/octet-stream" }),
      }),
    },
  });

  // Assert
  assert.equal(fetchCount, 0);
  assert.equal(disabled, undefined);
  assert.equal(unsupported, undefined);
});

test("resolveVCardPhotoUri treats fetch failures as non-blocking", async () => {
  // Act
  const failedStatus = await resolveVCardPhotoUri({
    enabled: true,
    sourceUrl: "/cache/profile-avatar/profile-avatar.jpg",
    dependencies: {
      btoa: encodeBinary,
      fetch: async () => ({
        ok: false,
        blob: async () => new Blob([new Uint8Array([1])], { type: "image/jpeg" }),
      }),
    },
  });
  const thrownFailure = await resolveVCardPhotoUri({
    enabled: true,
    sourceUrl: "/cache/profile-avatar/profile-avatar.jpg",
    dependencies: {
      btoa: encodeBinary,
      fetch: async () => {
        throw new Error("network failed");
      },
    },
  });

  // Assert
  assert.equal(failedStatus, undefined);
  assert.equal(thrownFailure, undefined);
});
