import { describe, it, expect } from 'vitest';
import { parseDriveUrl, parseYouTube, isSafeHttpsUrl, driveThumbUrl, youtubeEmbedUrl } from '@/lib/urls';

describe('Google Drive', () => {
  const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-0123';
  it('aceita formatos de link de arquivo', () => {
    for (const u of [`https://drive.google.com/file/d/${ID}/view?usp=sharing`, `https://drive.google.com/open?id=${ID}`, `https://drive.google.com/uc?export=view&id=${ID}`, `https://docs.google.com/uc?id=${ID}`, `https://drive.google.com/file/d/${ID}/view`])
      expect(parseDriveUrl(u), u).toEqual({ ok: true, fileId: ID });
  });
  it('rejeita pastas, hosts estranhos, http e lixo', () => {
    expect(parseDriveUrl(`https://drive.google.com/drive/folders/${ID}`)).toMatchObject({ ok: false, reason: 'folder' });
    expect(parseDriveUrl(`https://drive.google.com/drive/u/0/folders/${ID}`)).toMatchObject({ ok: false, reason: 'folder' });
    expect(parseDriveUrl(`https://evil.example/file/d/${ID}/view`)).toMatchObject({ ok: false, reason: 'not_drive' });
    expect(parseDriveUrl(`https://drive.google.com.evil.example/file/d/${ID}/view`)).toMatchObject({ ok: false, reason: 'not_drive' });
    expect(parseDriveUrl(`http://drive.google.com/file/d/${ID}/view`)).toMatchObject({ ok: false, reason: 'invalid_url' });
    expect(parseDriveUrl('javascript:alert(1)')).toMatchObject({ ok: false });
    expect(parseDriveUrl('')).toMatchObject({ ok: false });
    expect(parseDriveUrl(null)).toMatchObject({ ok: false });
    expect(parseDriveUrl('https://drive.google.com/file/d/curto/view')).toMatchObject({ ok: false, reason: 'no_file_id' });
    expect(parseDriveUrl(`https://user:pw@drive.google.com/file/d/${ID}/view`)).toMatchObject({ ok: false });
  });
  it('monta a URL da miniatura com tamanho limitado', () => {
    expect(driveThumbUrl(ID, 800)).toBe(`https://drive.google.com/thumbnail?id=${ID}&sz=w800`);
    expect(driveThumbUrl(ID, 99999)).toContain('sz=w2000');
    expect(driveThumbUrl(ID, 1)).toContain('sz=w64');
  });
});

describe('YouTube', () => {
  const V = 'dQw4w9WgXcQ';
  it('extrai o ID de todos os formatos', () => {
    for (const u of [`https://www.youtube.com/watch?v=${V}`, `https://www.youtube.com/watch?v=${V}&t=10s&list=x`, `https://youtu.be/${V}`, `https://youtu.be/${V}?si=abc`, `https://www.youtube.com/embed/${V}`, `https://www.youtube.com/live/${V}?feature=share`, `https://www.youtube.com/shorts/${V}`, `https://m.youtube.com/watch?v=${V}`, `https://www.youtube-nocookie.com/embed/${V}`, V])
      expect(parseYouTube(u), u).toEqual({ ok: true, videoId: V });
  });
  it('rejeita domínios falsos, http, ID inválido', () => {
    expect(parseYouTube(`https://youtube.com.evil.example/watch?v=${V}`)).toMatchObject({ ok: false, reason: 'not_youtube' });
    expect(parseYouTube(`https://evil.example/watch?v=${V}`)).toMatchObject({ ok: false });
    expect(parseYouTube(`http://www.youtube.com/watch?v=${V}`)).toMatchObject({ ok: false, reason: 'invalid_url' });
    expect(parseYouTube('https://www.youtube.com/watch?v=curto')).toMatchObject({ ok: false, reason: 'no_video_id' });
    expect(parseYouTube('https://www.youtube.com/')).toMatchObject({ ok: false });
    expect(parseYouTube('javascript:alert(1)')).toMatchObject({ ok: false });
    expect(parseYouTube(undefined)).toMatchObject({ ok: false });
  });
  it('embed usa youtube-nocookie e NÃO usa autoplay', () => {
    const u = youtubeEmbedUrl(V);
    expect(u.startsWith('https://www.youtube-nocookie.com/embed/')).toBe(true);
    expect(u).not.toMatch(/autoplay/);
  });
});

describe('https genérico', () => {
  it('bloqueia esquemas perigosos', () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://example.com', 'ftp://x.y', 'https://u:p@x.y', '//x.y', 'https://x.y/\nfoo', ' ', '', 'vbscript:x'])
      expect(isSafeHttpsUrl(u), JSON.stringify(u)).toBe(false);
    expect(isSafeHttpsUrl('https://goo.gl/maps/abc')).toBe(true);
    expect(isSafeHttpsUrl('x'.repeat(3000))).toBe(false);
  });
});
