import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../services/database.js";

export const SESSION_COOKIE_NAME = "studio_session";

export const requireSession = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const sessionId = request.cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    reply.code(401).send({ message: "Authentication required" });
    return;
  }

  const session = await db.getSession(sessionId);
  if (!session) {
    reply.code(401).send({ message: "Session is invalid" });
    return;
  }

  if (session.expires_at.getTime() <= Date.now()) {
    await db.deleteSession(sessionId);
    reply.code(401).send({ message: "Session expired" });
    return;
  }

  const user = await db.getUserById(session.user_id);
  if (!user) {
    reply.code(401).send({ message: "User not found" });
    return;
  }

  request.sessionUser = {
    id: user.id,
    githubUserId: user.github_user_id,
    githubLogin: user.github_login,
    githubName: user.github_name,
    avatarUrl: user.avatar_url,
  };
};
