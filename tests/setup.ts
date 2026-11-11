import "dotenv/config";

// Fallback dummy env for tests if not provided
process.env.MYSQL_DATABASE ??= "boxing_test";
process.env.MYSQL_USER ??= "boxing";
process.env.MYSQL_PASSWORD ??= "testpass";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long-123456";
process.env.ENCRYPTION_KEY ??= "zS9RNQd83tfaqENs5iwZ7vGw0vgaJ3vbfd1EeKDX03A=";

