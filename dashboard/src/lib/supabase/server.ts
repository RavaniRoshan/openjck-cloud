import { createServerClient as supabaseCreateServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return supabaseCreateServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value ?? '';
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
}

export async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch org membership
  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    orgId: member?.org_id || null,
    role: member?.role || null,
  };
}

export async function getOrgId() {
  const user = await getUser();
  return user?.orgId || null;
}
