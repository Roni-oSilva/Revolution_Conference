#!/usr/bin/env python3
"""Gera previa.html: um arquivo ÚNICO (fontes embutidas) para ver o visual/animações do site sem rodar nada.
Conteúdo de exemplo — NÃO é o site real (o real é o app Next.js). Uso: python3 scripts/build-preview.py saida.html"""
import base64, sys, re
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
F = 'public/fonts/'
fonts = f"""
@font-face{{font-family:'Orbitron';src:url(data:font/woff2;base64,{b64(F+'orbitron-700.woff2')}) format('woff2');font-weight:400 700;font-display:swap}}
@font-face{{font-family:'Open Sans';src:url(data:font/woff2;base64,{b64(F+'open-sans-300.woff2')}) format('woff2');font-weight:300;font-display:swap}}
@font-face{{font-family:'Open Sans';src:url(data:font/woff2;base64,{b64(F+'open-sans-400.woff2')}) format('woff2');font-weight:400;font-display:swap}}
@font-face{{font-family:'Open Sans';src:url(data:font/woff2;base64,{b64(F+'open-sans-600.woff2')}) format('woff2');font-weight:600;font-display:swap}}
"""
css = open('app/globals.css').read()
# variáveis de fonte do Next → fontes embutidas
css = css.replace("var(--font-title), Orbitron", "Orbitron").replace("var(--font-body), 'Open Sans'", "'Open Sans'")
html = open('scripts/preview-template.html').read()
html = html.replace('/*LOGO_XL*/', 'data:image/png;base64,' + b64('public/logo.png')).replace('/*LOGO_SM*/', 'data:image/png;base64,' + b64('public/logo-sm.png'))
html = html.replace('/*FONTS*/', fonts).replace('/*APPCSS*/', css)
html = html.replace('/*INTROJS*/', open('scripts/preview-intro.js').read())
open(sys.argv[1], 'w', encoding='utf8').write(html)
print(len(html) // 1024, 'KB')
