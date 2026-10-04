import { clearedSessionCookie } from '@/app/auth';

export async function POST() {
  const cookie = clearedSessionCookie();
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `${cookie.name}=; Path=/; Expires=${cookie.options.expires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`);
  return response;
}
