import { Redirect } from "expo-router";
import { useSession } from "@/src/providers/session-provider";
import { getAdminProfileDestination } from "@/src/features/admin/navigation";

export default function AdminIndexRedirect() {
  const { role } = useSession();

  if (role === "OWNER") {
    return <Redirect href={getAdminProfileDestination(role)} />;
  }

  return <Redirect href="/(admin)/booking" />;
}
