import { redirect } from "next/navigation";
import { getServerIdentity } from "../../lib/server/identity";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const identity = await getServerIdentity();
  if (!identity) redirect("/auth/sign-in?next=/dashboard");
  return children;
}
