import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import { db } from "../services/database.js";
import { syncRepo } from "../services/sync.js";
import type { StudioApiDependencies } from "../types/studio-api-dependencies.js";

type InternalRouteDeps = Pick<StudioApiDependencies, "config" | "db" | "syncRepo">;

export const createInternalRoutes =
  (deps: InternalRouteDeps): FastifyPluginAsync =>
  async (app) => {
    app.post("/api/v1/internal/sync/run", async (request, reply) => {
      const token = request.headers["x-internal-secret"];
      if (token !== deps.config.internalCronSecret) {
        reply.code(401).send({ message: "Unauthorized" });
        return;
      }

      const due = await deps.db.getDueReposForSync(new Date());
      const results: Array<{ repoId: string; status: string; message: string }> = [];

      for (const repo of due) {
        const result = await deps.syncRepo(repo);
        results.push({ repoId: repo.id, status: result.status, message: result.message });
      }

      reply.send({
        scanned: due.length,
        processed: results.length,
        results,
      });
    });
  };

export const internalRoutes = createInternalRoutes({
  config,
  db,
  syncRepo,
});
