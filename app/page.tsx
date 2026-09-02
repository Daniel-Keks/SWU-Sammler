import { getChatGPTUser } from './chatgpt-auth';
import CollectionApp from './collection-app';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  return <CollectionApp user={user ? { name: user.displayName, email: user.email } : null} />;
}
