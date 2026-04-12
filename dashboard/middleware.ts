import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.delete({
            name,
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Public routes - allow without auth
  if (request.nextUrl.pathname.startsWith("/(public)")) {
    return response;
  }

  // Auth routes - redirect to home if already authenticated
  if (request.nextUrl.pathname.startsWith("/(auth)")) {
    if (session) {
      // Check if user has org membership
      const { data: member } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', session.user.id)
        .single();

      if (member) {
        const url = request.nextUrl.clone();
        url.pathname = "/app/sessions";
        return NextResponse.redirect(url);
      }
      // If authenticated but no org, allow to stay on auth routes (maybe going to /signup)
    }
    return response;
  }

  // Protected app routes - require auth + org membership
  if (request.nextUrl.pathname.startsWith("/(app)")) {
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }

    // Check org membership
    const { data: member } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single();

    if (!member) {
      const url = request.nextUrl.clone();
      url.pathname = "/signup";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
