// Tests always use their own database and Redis DB index, never the app's.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:5432/helpdesk_test";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";
process.env.SESSION_TTL_SECONDS = "3600";
