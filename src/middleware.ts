import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Verifică dacă hostname-ul conține www.
  if (hostname.startsWith('www.')) {
    // Elimină www. din hostname
    const newHostname = hostname.replace(/^www\./, '');
    
    // Construiește noul URL fără www
    url.hostname = newHostname;
    
    // Redirect permanent (301) către versiunea fără www
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

