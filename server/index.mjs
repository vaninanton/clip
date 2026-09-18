import {createServer} from 'node:http'
import sirv from 'sirv'
import {createWsRelayServer} from '@trystero-p2p/ws-relay/server'

const port = Number(process.env.PORT ?? 8080)
const root = process.env.STATIC_ROOT ?? new URL('./public/', import.meta.url).pathname

const serve = sirv(root, {
  etag: true,
  // Приложение одностраничное: любой неизвестный путь отдаёт index.html.
  single: true,
  setHeaders: (res, pathname) => {
    // Имена файлов в assets/ содержат хеш содержимого, поэтому их можно
    // кешировать навсегда. index.html — нельзя, иначе браузер будет
    // держаться за ссылки на старую сборку.
    res.setHeader(
      'cache-control',
      pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache'
    )
  }
})

const server = createServer((request, response) => {
  serve(request, response, () => {
    response.statusCode = 404
    response.end('не найдено')
  })
})

// Релей висит на том же порту, но на отдельном пути: обычные запросы
// получают статику, апгрейд на /relay уходит в вебсокет.
const relay = createWsRelayServer({
  server,
  path: '/relay',
  onError: error => console.error('ошибка релея:', error)
})

server.listen(port, () => {
  console.log(`страница и релей слушают :${port}, статика из ${root}`)
})

// Docker останавливает контейнер сигналом. Без явного закрытия сокетов
// он ждёт десять секунд до SIGKILL на каждом перезапуске.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    relay.close().then(
      () => server.close(() => process.exit(0)),
      () => process.exit(1)
    )
  })
}
