declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    APP_PASSWORD: string;
    SESSION_SECRET: string;
    OWNER_EMAIL?: string;
  }
}
