import { useAuth } from "../lib/auth";
import { useWorkspace } from "../lib/workspace";
import { Card } from "./kit";

export function TenantGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { tenantId, activeTenant } = useWorkspace();
  if (user?.isPlatformAdmin && !tenantId) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="text-lg font-extrabold">Pilih koperasi dulu</p>
        <p className="mt-2 text-sm text-mute">Buku besar, jurnal, dan laporan hanya hidup di dalam satu tenant.</p>
      </Card>
    );
  }
  return <div className="space-y-5">{children}</div>;
}
