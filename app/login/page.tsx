import { redirect } from 'next/navigation';
import { getAppUser } from '@/app/auth';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getAppUser()) redirect('/');
  return <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground"><LoginForm /></main>;
}
