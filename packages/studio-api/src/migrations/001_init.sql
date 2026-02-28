CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_user_id BIGINT NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  github_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS github_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  access_expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  token_type TEXT,
  scope TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  visibility TEXT NOT NULL DEFAULT 'public',
  upstream_owner TEXT NOT NULL,
  upstream_name TEXT NOT NULL,
  pages_url TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sync_interval_hours INTEGER NOT NULL DEFAULT 12,
  sync_conflict BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, owner, name)
);

CREATE TABLE IF NOT EXISTS repo_files_state (
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_sha TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (repo_id, file_path)
);

CREATE TABLE IF NOT EXISTS repo_operations (
  id TEXT PRIMARY KEY,
  repo_id TEXT REFERENCES repos(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  upstream_sha TEXT,
  fork_sha TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repos_sync_enabled ON repos(sync_enabled, sync_conflict, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_repo_ops_repo ON repo_operations(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth_sessions(expires_at);
