import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ProjectDashboard from "@/components/project-dashboard";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-4 sm:gap-8 px-3 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {user.user_metadata.name.split(' ')[0]}!</h1>
      </div>
      
      <ProjectDashboard userId={user.id} />
    </div>
  );
}
