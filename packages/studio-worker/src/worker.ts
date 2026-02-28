import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  STUDIO_API_URL: z.string().url(),
  INTERNAL_CRON_SECRET: z.string().min(16),
});

const exitInvalidEnv = (issues: Record<string, string[] | undefined>): never => {
  console.error("Studio worker environment validation failed.");
  console.error("Detected issues:");
  for (const [key, messages] of Object.entries(issues)) {
    if (!messages || messages.length === 0) {
      console.error(`- ${key}: Invalid value`);
      continue;
    }
    for (const message of messages) {
      console.error(`- ${key}: ${message}`);
    }
  }
  console.error("");
  console.error("How to fix:");
  console.error("- Set each variable above to a valid non-placeholder value.");
  console.error("- For production builds, run: bun run studio:env:check:prod -- --target worker");
  process.exit(1);
};

const loadEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      exitInvalidEnv(error.flatten().fieldErrors);
    }
    const message = error instanceof Error ? error.message : String(error);
    exitInvalidEnv({
      ENVIRONMENT: [message],
    });
  }
  throw new Error("Unreachable environment parse state");
};

const env = loadEnv();

const run = async () => {
  const response = await fetch(`${env.STUDIO_API_URL}/api/v1/internal/sync/run`, {
    method: "POST",
    headers: {
      "x-internal-secret": env.INTERNAL_CRON_SECRET,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Sync run failed (${response.status}): ${JSON.stringify(body)}`);
  }

  console.log("Sync worker completed", body);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
