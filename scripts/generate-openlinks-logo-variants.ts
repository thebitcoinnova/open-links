import { generateOpenLinksBrandAssets } from "./generate-openlinks-brand-assets";
import { generateV1 } from "./logo-variants/v1";
import { generateV2 } from "./logo-variants/v2";
import { generateV3 } from "./logo-variants/v3";

const run = async (): Promise<void> => {
  generateV1();
  generateV2();
  generateV3();
  await generateOpenLinksBrandAssets({ quiet: false });
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate OpenLinks logo variants: ${message}`);
  process.exitCode = 1;
});
