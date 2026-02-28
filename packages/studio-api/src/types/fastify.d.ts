import "fastify";

export interface SessionUser {
  id: string;
  githubUserId: number;
  githubLogin: string;
  githubName: string | null;
  avatarUrl: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}
