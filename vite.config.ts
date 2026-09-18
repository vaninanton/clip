import {defineConfig} from 'vite'

export default defineConfig({
  // Относительные пути к ассетам: одинаково работает и на valet в корне домена,
  // и на GitHub Pages, где проект живёт в подкаталоге /clip/.
  base: './',
  // Каталог public занят результатом сборки (его отдаёт valet), поэтому
  // статика лежит в static/ — оттуда Vite копирует её в сборку как есть.
  // Там же CNAME: без него GitHub Pages забывает привязанный домен
  // при каждом деплое.
  publicDir: 'static',
  build: {
    outDir: 'public',
    emptyOutDir: true,
    target: 'es2022'
  }
})
