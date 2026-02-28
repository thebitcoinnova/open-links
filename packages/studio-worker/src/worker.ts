import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  STUDIO_API_URL: z.string().url(),
  INTERNAL_CRON_SECRET: z.string().min(16),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid worker environment", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

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
