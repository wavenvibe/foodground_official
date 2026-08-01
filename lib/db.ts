import postgres from "postgres";

const sql = postgres({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "postgres",
  username: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: "require",
});

export default sql;
