# Apaixonados pela Presença — site (React + TS + Tailwind + shadcn)

    npm install
    npm run dev      # desenvolvimento
    npm run build    # gera dist/ (nada é publicado online)

- Componentes shadcn em `src/components/ui` (`halo-reel.tsx`, com suporte a `video`).
- Hero em `src/components/Hero.tsx`: pomba sobe, o redondo desce e cada linha do título vai para um lado ao rolar.
- Fontes: UnifrakturCook (títulos) + Grenze Gotisch (textos), via @fontsource.
- Google Drive: copie `.env.example` para `.env` e preencha `VITE_DRIVE_API_KEY` e `VITE_DRIVE_FOLDER_ID`
  (pasta compartilhada como "qualquer pessoa com o link"). Fotos e vídeos entram no HaloReel em ordem aleatória.
- O `index.html` antigo na raiz do repositório foi mantido intacto.
