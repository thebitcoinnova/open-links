import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import { db } from "../services/database.js";
import { syncRepo } from "../services/sync.js";

export const internalRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/v1/internal/sync/run", async (request, reply) => {
    const token = request.headers["x-internal-secret"];
    if (token !== config.internalCronSecret) {
      reply.code(401).send({ message: "Unauthorized" });
      return;
    }

    const due = await db.getDueReposForSync(new Date());
    const results: Array<{ repoId: string; status: string; message: string }> = [];

    for (const repo of due) {
      const result = await syncRepo(repo);
      results.push({ repoId: repo.id, status: result.status, message: result.message });
    }

    reply.send({
      scanned: due.length,
      processed: results.length,
      results,
    });
  });
};
