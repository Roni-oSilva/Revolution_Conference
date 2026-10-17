#!/usr/bin/env python3
"""Gera previa.html: um arquivo ÚNICO (fontes embutidas) para ver o visual/animações do site sem rodar nada.
Conteúdo de exemplo — NÃO é o site real (o real é o app Next.js). Uso: python3 scripts/build-preview.py saida.html"""
import base64, sys, re
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
F = 'public/fonts/'
fonts = f"""
@font-face{{font-family:'Plus Jakarta Sans';src:url(data:font/woff2;base64,{b64(F+'jakarta-300.woff2')}) format('woff2');font-weight:300;font-display:swap}}
@font-face{{font-family:'Plus Jakarta Sans';src:url(data:font/woff2;base64,{b64(F+'jakarta-400.woff2')}) format('woff2');font-weight:400;font-display:swap}}
@font-face{{font-family:'Plus Jakarta Sans';src:url(data:font/woff2;base64,{b64(F+'jakarta-600.woff2')}) format('woff2');font-weight:600;font-display:swap}}
@font-face{{font-family:'JakartaTitle';src:url(data:font/woff2;base64,{b64(F+'jakarta-800.woff2')}) format('woff2');font-weight:400;font-display:swap}}
"""
css = open('app/globals.css').read()
# variáveis de fonte do Next → fontes embutidas
css = css.replace("var(--font-title), 'Plus Jakarta Sans'", "'JakartaTitle'").replace("var(--font-body), 'Plus Jakarta Sans'", "'Plus Jakarta Sans'")
html = open('scripts/preview-template.html').read()
html = html.replace('/*LOGO_XL*/', 'data:image/png;base64,' + b64('public/logo.png')).replace('/*LOGO_SM*/', 'data:image/png;base64,' + b64('public/logo-sm.png'))
import subprocess
motion = subprocess.run(['node_modules/.bin/esbuild', 'lib/motion.ts', '--bundle', '--format=iife', '--global-name=RVMotion', '--minify'], capture_output=True, text=True, check=True).stdout
motion += ';RVMotion.initMotion();'
html = html.replace('/*MOTIONJS*/', motion.replace('</script', '<\\/script'))
hero = subprocess.run(['node_modules/.bin/esbuild', 'lib/herovideo.ts', '--bundle', '--format=iife', '--global-name=RVHero', '--minify'], capture_output=True, text=True, check=True).stdout
html = html.replace('/*HEROJS*/', hero).replace('/*VIDEOB64*/', b64('scripts/hero-preview.mp4')).replace('/*POSTER*/', 'data:image/jpeg;base64,' + b64('public/hero-poster.jpg'))
vc = subprocess.run(['node_modules/.bin/esbuild', 'scripts/preview-countdown.tsx', '--bundle', '--format=iife', '--minify', '--jsx=automatic', '--define:process.env.NODE_ENV="production"'], capture_output=True, text=True, check=True).stdout
html = html.replace('/*VCJS*/', vc.replace('</script', '<\\/script'))
G = 'public/galeria/dia1/'
gh = ''.join(f'<li style="display:contents"><button type="button" class="g" aria-label="Ampliar foto {n}"><img src="data:image/jpeg;base64,{b64(G + "t%02d.jpg" % n)}" alt="Revolution Conference — primeiro dia, foto {n}" loading="lazy"></button></li>' for n in range(1, 17))
gj = '[' + ','.join('"data:image/jpeg;base64,' + b64(G + '%02d.jpg' % n) + '"' for n in range(1, 17)) + ']'
html = html.replace('/*GALHTML*/', gh).replace('/*GALJS*/', gj)
html = html.replace('/*FONTS*/', fonts).replace('/*APPCSS*/', css)
html = html.replace('/*INTROJS*/', open('scripts/preview-intro.js').read())
open(sys.argv[1], 'w', encoding='utf8').write(html)
print(len(html) // 1024, 'KB')
