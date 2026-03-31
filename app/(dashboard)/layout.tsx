import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as any;

  return (
    <DashboardShell
      tenantNombre={user.tenantName ?? user.tenantNombre ?? 'Mi Organización'}
      userName={user.name ?? ''}
      areaNombre={user.areaNombre ?? null}
      roles={user.roles ?? []}
    >
      {children}
    </DashboardShell>
  );
}
