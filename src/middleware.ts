import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - important!
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ['/auth/login', '/auth/signup', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // API routes should be accessible (they have their own auth)
  const isApiRoute = pathname.startsWith('/api/');

  // Static assets and Next.js internals
  const isStaticRoute = pathname.startsWith('/_next/') || pathname.startsWith('/favicon');

  // Onboarding route
  const isOnboardingRoute = pathname === '/onboarding';

  if (isStaticRoute || isApiRoute) {
    return response;
  }

  // If user is not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // If user IS logged in and trying to access auth pages, redirect to home
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Check onboarding status for logged-in users
  if (user && !isOnboardingRoute) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      // If profile exists and onboarding not completed, redirect to onboarding
      if (profile && profile.onboarding_completed === false) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        return NextResponse.redirect(url);
      }
    } catch {
      // If profile doesn't exist or error, continue normally
      // The onboarding page itself will handle edge cases
    }
  }

  // If user has completed onboarding and tries to access /onboarding, redirect home
  if (user && isOnboardingRoute) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (profile && profile.onboarding_completed === true) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    } catch {
      // Continue to onboarding page
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
