import {createWsRelayServer} from '@trystero-p2p/ws-relay/server'

const port = Number(process.env.PORT ?? 8080)

const relay = createWsRelayServer({
  port,
  onError: error => console.error('ошибка релея:', error)
})

await relay.ready
console.log(`ws-relay слушает :${port}`)

// Docker останавливает контейнер сигналом. Без явного закрытия сокетов
// он ждёт десять секунд до SIGKILL на каждом перезапуске.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    relay.close().then(
      () => process.exit(0),
      () => process.exit(1)
    )
  })
}
