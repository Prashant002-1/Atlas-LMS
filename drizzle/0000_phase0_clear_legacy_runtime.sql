DROP TABLE IF EXISTS "cue_events";
DROP TABLE IF EXISTS "chat_sessions";
DROP TABLE IF EXISTS "chat_memories";
DROP TABLE IF EXISTS "planner_state";

ALTER TABLE "agent_sessions" DROP COLUMN IF EXISTS "eve_session_id";
ALTER TABLE "agent_sessions" DROP COLUMN IF EXISTS "eve_continuation_token";
ALTER TABLE "agent_sessions" DROP COLUMN IF EXISTS "eve_stream_index";

DROP TYPE IF EXISTS "cue_kind";
DROP TYPE IF EXISTS "persona";
DROP TYPE IF EXISTS "memory_scope";
