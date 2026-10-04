import { redirect } from 'next/navigation';
import { getAppUser } from './auth';
import CollectionApp from './collection-app';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getAppUser();
  if (!user) redirect('/login');
  return <CollectionApp user={{ name: user.displayName, email: user.email }} />;
}
