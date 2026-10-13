#!/usr/bin/env python3
"""Gera previa.html: um arquivo ÚNICO (fontes embutidas) para ver o visual/animações do site sem rodar nada.
Conteúdo de exemplo — NÃO é o site real (o real é o app Next.js). Uso: python3 scripts/build-preview.py saida.html"""
import base64, sys, re
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
F = 'public/fonts/'
fonts = f"""
@font-face{{font-family:'Archivo Black';src:url(data:font/ttf;base64,{b64(F+'archivo-black.ttf')}) format('truetype');font-weight:400;font-display:swap}}
@font-face{{font-family:'Inter';src:url(data:font/ttf;base64,{b64(F+'inter-300.ttf')}) format('truetype');font-weight:300;font-display:swap}}
@font-face{{font-family:'Inter';src:url(data:font/ttf;base64,{b64(F+'inter-600.ttf')}) format('truetype');font-weight:600;font-display:swap}}
"""
css = open('app/globals.css').read()
# variáveis de fonte do Next → fontes embutidas
css = css.replace("var(--font-title), 'Archivo Black'", "'Archivo Black'").replace("var(--font-body), Inter", "Inter")
logo = 'data:image/jpeg;base64,' + b64('public/logo.jpg')
html = open('scripts/preview-template.html').read()
html = html.replace('/*FONTS*/', fonts).replace('/*APPCSS*/', css).replace('__LOGO__', logo)
html = html.replace('/*INTROJS*/', open('scripts/preview-intro.js').read())
open(sys.argv[1], 'w', encoding='utf8').write(html)
print(len(html) // 1024, 'KB')
