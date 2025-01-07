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

  // Check if default project exists for user
  const { data: existingProject } = await supabase
    .from('projects')
    .select()
    .eq('user_id', user.id)
    .eq('name', 'Default Project')
    .single();

  // Create default project if it doesn't exist
  if (!existingProject) {
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert([
        { 
          name: 'Default Project',
          user_id: user.id,
          description: 'Default project for receipt management'
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating default project:', error);
    }
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome back, {user.user_metadata.name.split(' ')[0]} !
        </div>
      </div>
      
      <ProjectDashboard userId={user.id} />
    </div>
  );
}
