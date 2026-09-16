import { NextResponse, type NextRequest } from 'next/server';

/** Mantem este app isolado do proxy multi-tenant da raiz do monorepo. */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}
