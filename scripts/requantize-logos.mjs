// Recomprime em paleta os PNGs de logo já no Blob, no mesmo caminho.
// Serve para arquivos gerados antes da quantização entrar no gerador.
// Uso: node --env-file=.env.local scripts/requantize-logos.mjs
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import sharp from 'sharp';

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select id, seq, url, blob_path from images where kind = 'logo'`;

for (const row of rows) {
  const original = Buffer.from(await (await fetch(row.url)).arrayBuffer());
  const quantized = await sharp(original).png({ palette: true, quality: 90, effort: 8 }).toBuffer();
  if (quantized.length >= original.length) {
    console.log(`#${row.seq} já otimizado (${(original.length / 1024).toFixed(0)}KB)`);
    continue;
  }
  await put(row.blob_path, quantized, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/png',
    allowOverwrite: true,
  });
  console.log(`#${row.seq} ${(original.length / 1024).toFixed(0)}KB -> ${(quantized.length / 1024).toFixed(0)}KB`);
}
