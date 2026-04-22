import { createServerClient } from "@supabase/ssr";
import { NextResponse, NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
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

  const { data: { session } } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  // Public routes: no auth required
  const publicRoutes = ['/'];
  if (publicRoutes.includes(pathname)) {
    return response;
  }

  // Auth routes: login and signup
  const authRoutes = ['/login', '/signup'];
  if (authRoutes.includes(pathname)) {
    if (session) {
      // Fetch org membership to decide where to redirect
      const { data: member } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', session.user.id)
        .single();

       if (member) {
         // Logged in with org → go to sessions
         return NextResponse.redirect(new URL('/sessions', request.url));
       } else {
        // Logged in but no org → go to signup to create one
        return NextResponse.redirect(new URL('/signup', request.url));
      }
    }
    // Not logged in — allow to see auth pages
    return response;
  }

  // All other routes require authentication
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check org membership for protected routes
  const { data: member } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', session.user.id)
    .single();

  if (!member) {
    const url = request.nextUrl.clone();
    url.pathname = '/signup';
    return NextResponse.redirect(url);
  }

  // Attach orgId to request for downstream routes (e.g., SSE)
  (request as any).orgId = member.org_id;

  // Set cache control for protected pages to prevent back-button caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
