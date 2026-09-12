import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const)
  blocked.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return !!family && !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

export type PublicResource = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

/** GET sem credenciais, IP validado fixado ao socket; redirects voltam ao guard. */
export async function publicResource(url: string): Promise<PublicResource> {
  const parsed = new URL(url);
  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    (parsed.port && !['80', '443'].includes(parsed.port))
  )
    throw new Error('URL pública inválida');
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error('Rede não pública');
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (parsed.protocol === 'https:' ? httpsRequest : httpRequest)(
      parsed,
      {
        method: 'GET',
        agent: false,
        signal: AbortSignal.timeout(8000),
        // O navegador nunca envia seus cookies/headers ao proxy de leitura.
        headers: {
          'user-agent': 'EIXU-SiteAgent/1.0',
          'accept-encoding': 'identity',
        },
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 5_000_000)
            request.destroy(new Error('Recurso grande demais'));
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          const headers: Record<string, string> = {};
          // Sem set-cookie, headers hop-by-hop ou tamanho que difira do buffer.
          for (const name of [
            'content-type',
            'content-encoding',
            'location',
            'access-control-allow-origin',
          ]) {
            const value = response.headers[name];
            if (typeof value === 'string') headers[name] = value;
          }
          resolve({
            status: response.statusCode ?? 502,
            headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.on('error', reject);
    request.end();
  });
}
