import { createSessionCookie, passwordMatches } from '@/app/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (!body.password || !(await passwordMatches(body.password))) {
    return Response.json({ error: 'Das Passwort ist nicht korrekt.' }, { status: 401 });
  }
  const cookie = await createSessionCookie();
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `${cookie.name}=${cookie.value}; Path=/; Expires=${cookie.options.expires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`);
  return response;
}
