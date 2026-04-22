import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const [key, ...rest] = cookies[i].trim().split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Create response early so we can modify headers
  const response = new NextResponse();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return getCookieValue(request, name) || '';
        },
        set(name: string, value: string, options: any) {
          const maxAge = options.maxAge !== undefined ? `Max-Age=${options.maxAge};` : '';
          const path = `Path=${options.path || '/'};`;
          const httpOnly = options.httpOnly ? 'HttpOnly;' : '';
          const sameSite = options.sameSite || 'Lax';
          const secure = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
          response.headers.append(
            'Set-Cookie',
            `${name}=${value}; ${path} ${maxAge} ${httpOnly} SameSite=${sameSite} ${secure}`
          );
        },
        remove(name: string, options: any) {
          const path = `Path=${options.path || '/'};`;
          const httpOnly = options.httpOnly ? 'HttpOnly;' : '';
          const sameSite = options.sameSite || 'Lax';
          response.headers.append(
            'Set-Cookie',
            `${name}=; ${path} Max-Age=0; ${httpOnly} SameSite=${sameSite}`
          );
        },
      },
    }
  );

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const token = searchParams.get('token');
  const type = searchParams.get('type'); // 'signup' | 'magiclink' | 'recovery'

  // Get pending org name from request cookies
  const pendingOrgCookie = getCookieValue(request, 'pending-org-name');
  const pendingOrgName = pendingOrgCookie ? decodeURIComponent(pendingOrgCookie) : null;

  // Handle OAuth errors
  if (error) {
    const redirectUrl = new URL('/login', origin);
    redirectUrl.searchParams.set('error', error);
    if (errorDescription) {
      redirectUrl.searchParams.set('error_description', errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Handle magic link / email verification
    if (token && type) {
      // @ts-expect-error - verifyOtp accepts token+type for magiclink flow
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token,
        type: type as 'signup' | 'magiclink' | 'recovery',
      });
      if (verifyError) {
        throw verifyError;
      }
    }
    // Handle OAuth callback (Google)
    else if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw exchangeError;
      }
    }
  } catch (err: any) {
    const redirectUrl = new URL('/login', origin);
    redirectUrl.searchParams.set('error', err.message || 'Authentication failed');
    return NextResponse.redirect(redirectUrl);
  }

  // After successful auth, if pending org name exists, create org via API
  if (pendingOrgName) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        const apiRes = await fetch(`${origin}/api/v1/orgs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name: pendingOrgName }),
        });
        if (!apiRes.ok) {
          console.error('Org creation failed:', await apiRes.text());
        }
      } catch (e) {
        console.error('Failed to create org:', e);
      }
    }
  }

  // Clear the pending org cookie by setting it to expire
  response.headers.append(
    'Set-Cookie',
    'pending-org-name=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
  );

   // Redirect to sessions
   return NextResponse.redirect(new URL('/sessions', origin));
 }
