import {defineConfig} from 'vite'

export default defineConfig({
  // Относительные пути к ассетам: одинаково работает и на valet в корне домена,
  // и на GitHub Pages, где проект живёт в подкаталоге /clip/.
  base: './',
  // Каталог public занят результатом сборки, поэтому штатный publicDir
  // отключён — иначе Vite попытался бы копировать сам в себя.
  publicDir: false,
  build: {
    outDir: 'public',
    emptyOutDir: true,
    target: 'es2022'
  }
})
