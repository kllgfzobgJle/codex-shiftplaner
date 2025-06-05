'use client';
import { SchichtplanerApp } from '@/components/SchichtplanerApp';
import { UserAuth } from '@/components/UserAuth';
import { useAuth } from '@/hooks/use-auth';

export default function Page() {
  const { user } = useAuth();
  return user ? <SchichtplanerApp /> : <UserAuth />;
}
