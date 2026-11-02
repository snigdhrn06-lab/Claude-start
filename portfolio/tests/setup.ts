// Integration tests use a separate database so they never touch your real content.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/portfolio_test";
process.env.STORAGE_DRIVER = "database";
process.env.APP_SECRET = "test-secret";
