import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'swu_session';
const SESSION_DAYS = 30;
const OWNER_ID = 'owner';

export type AppUser = {
  userId: string;
  displayName: string;
  email: string;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function signature(value: string) {
  const secret = env.SESSION_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function passwordMatches(password: string) {
  const expected = env.APP_PASSWORD;
  if (!expected || password.length !== expected.length) return false;
  return secureEqual(password, expected);
}

export async function createSessionCookie() {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = textToBase64Url(JSON.stringify({ sub: OWNER_ID, exp: expires }));
  const signed = await signature(payload);
  if (!signed) throw new Error('SESSION_SECRET fehlt');
  return {
    name: COOKIE_NAME,
    value: `${payload}.${signed}`,
    options: { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', expires: new Date(expires) },
  };
}

export function clearedSessionCookie() {
  return { name: COOKIE_NAME, value: '', options: { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', expires: new Date(0) } };
}

export async function getAppUser(): Promise<AppUser | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = value.slice(0, separator);
  const suppliedSignature = value.slice(separator + 1);
  const expectedSignature = await signature(payload);
  if (!expectedSignature || !secureEqual(suppliedSignature, expectedSignature)) return null;
  try {
    const session = JSON.parse(base64UrlToText(payload)) as { sub?: string; exp?: number };
    if (session.sub !== OWNER_ID || !session.exp || session.exp < Date.now()) return null;
    const email = env.OWNER_EMAIL || 'sammler@local';
    return { userId: OWNER_ID, displayName: email.split('@')[0] || 'Daniel', email };
  } catch {
    return null;
  }
}
