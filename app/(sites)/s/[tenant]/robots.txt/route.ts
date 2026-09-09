export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const host = request.headers.get('host') ?? `${tenant}.eixu.com.br`;
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${protocol}://${host}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain' } },
  );
}
