import {defineConfig} from 'vite'

export default defineConfig({
  // Относительные пути к ассетам: одинаково работает и на valet в корне домена,
  // и на GitHub Pages, где проект живёт в подкаталоге /clip/.
  base: './',
  // Каталог public занят результатом сборки (его отдаёт valet), поэтому
  // штатный publicDir отключён, иначе Vite попытается копировать сам в себя.
  publicDir: false,
  build: {
    outDir: 'public',
    emptyOutDir: true,
    target: 'es2022'
  }
})
