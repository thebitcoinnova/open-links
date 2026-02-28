import { buildStudioApiApp } from "./app.js";
import { config } from "./config.js";

const start = async () => {
  const server = await buildStudioApiApp();

  try {
    await server.listen({ port: config.port, host: "0.0.0.0" });
    server.log.info(`studio-api listening on ${config.port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();
