import { createContext, useContext, type ReactNode } from "react";
import type { Member } from "../../../shared/contracts";
import { useResource } from "../../lib/use-resource";

const Context = createContext<{ member: Member | null | undefined; loading: boolean; error?: Error; reload: () => void }>({
  member: undefined, loading: true, reload: () => {},
});
export function MembershipProvider({ children }: { children: ReactNode }) {
  const resource = useResource<Member | null>("/membership/me");
  return <Context.Provider value={{ member: resource.data, loading: resource.loading, error: resource.error, reload: resource.reload }}>{children}</Context.Provider>;
}
export const useMembership = () => useContext(Context);
