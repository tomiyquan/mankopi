import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { api, type TenantRow } from "./api";

const KEY = "mankopi.workspaceTenant";

type Workspace = {
  tenantId: string | null;
  setTenantId: (id: string | null) => void;
  tenants: TenantRow[];
  activeTenant: TenantRow | null;
};

const WorkspaceContext = createContext<Workspace | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const tenants = useQuery({
    queryKey: ["tenants"],
    queryFn: api.tenants,
    enabled: Boolean(user?.isPlatformAdmin),
  });
  const [tenantId, setTenantIdState] = useState<string | null>(() => localStorage.getItem(KEY));

  useEffect(() => {
    if (user && !user.isPlatformAdmin) setTenantIdState(user.tenantId);
  }, [user]);

  const scopedId = user?.isPlatformAdmin ? tenantId : user?.tenantId ?? null;
  const value = useMemo<Workspace>(
    () => ({
      tenantId: scopedId,
      setTenantId: (id) => {
        setTenantIdState(id);
        if (id) localStorage.setItem(KEY, id);
        else localStorage.removeItem(KEY);
      },
      tenants: tenants.data ?? [],
      activeTenant: (tenants.data ?? []).find((t) => t.id === scopedId) ?? null,
    }),
    [scopedId, tenants.data, user],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("WorkspaceProvider required");
  return ctx;
}
