# Развёртывание

## Из чего состоит

```
  браузер А ─────── WebRTC, прямой канал ─────── браузер Б
      │         (текст и файлы идут только тут)        │
      │                                                │
      └──── wss ──► relay.clip.gocpa.ru ◄──── wss ─────┘
                 знакомство: SDP и ICE-кандидаты

  сама страница: clip.gocpa.ru → GitHub Pages
```

Три вещи, которые важно держать в голове:

- **Содержимое буфера не проходит ни через Pages, ни через релей.** Pages отдаёт
  статику, релей помогает браузерам найти друг друга. Дальше канал прямой.
- **Релей видит только шифротекст.** Имя комнаты служит паролем, которым
  trystero шифрует SDP, а на сервер уходит лишь SHA-256 от него.
- **Свой релей понадобился не для приватности, а из-за корпоративной сети:**
  из RDP-сессий публичные Nostr-релеи недоступны.

## DNS

Обе записи уже внесены в ClouDNS:

| Имя | Тип | Значение |
|---|---|---|
| `clip.gocpa.ru` | CNAME | `vaninanton.github.io.` |
| `relay.clip.gocpa.ru` | A | `213.148.1.78` |

Домен `gocpa.ru` обслуживает wildcard `*.gocpa.ru → 146.185.194.210`, поэтому
обе записи обязаны быть явными: без них имена уезжают на wildcard.

## 1. Приложение на GitHub Pages

Деплой автоматический: `.github/workflows/deploy.yml` срабатывает на push
в `main` и вручную через `workflow_dispatch`. Внутри — `npm ci`,
`npm run build` (он же прогоняет `tsc --noEmit`), выгрузка `public/`
как артефакта Pages и `deploy-pages`.

Что настроено один раз и руками:

1. **Settings → Pages → Source: GitHub Actions.** Без этого сборка пройдёт,
   а деплой упадёт на последнем шаге.
2. **Enforce HTTPS** — включается после того, как Let's Encrypt выпустит
   сертификат на домен; обычно занимает несколько минут после первого деплоя.

Домен задаётся файлом `static/CNAME`. Vite копирует содержимое `static/`
в сборку как есть, поэтому `CNAME` попадает в артефакт при каждом деплое —
иначе Pages забывал бы привязку домена.

> **Порядок важен.** Пушить `CNAME` раньше, чем готовы записи DNS, нельзя:
> Pages начнёт редиректить `vaninanton.github.io/clip/` на `clip.gocpa.ru`,
> и приложение станет недоступно по обоим адресам.

Локально то же самое: `npm run build` складывает сборку в `public/`, откуда
её отдаёт valet на `https://clipboard.test`. Каталог `public/` намеренно
исключён из репозитория — его содержимое собирается заново и здесь, и в CI.

## 2. Релей на gocpa-jump.servers.gocpa.mx

Сервер: `213.148.1.78`, Debian 13, nginx 1.30 на портах 80/443, docker,
certbot 4. Node в системе нет и не нужен — релей живёт в контейнере.

Исходники лежат в каталоге `relay/` этого репозитория и раскладываются
на сервер клонированием, чтобы обновление сводилось к `git pull`.

### Установка

```sh
ssh gocpa-jump.servers.gocpa.mx

# Исходники
sudo git clone https://github.com/vaninanton/clip.git /opt/clip

# Хостовая конвенция — compose-проекты в /etc/docker/containers/<имя>/
sudo ln -s /opt/clip/relay /etc/docker/containers/clip-relay

# Сборка и запуск
cd /etc/docker/containers/clip-relay
sudo docker compose up -d --build
sudo docker compose ps
```

Контейнер слушает `127.0.0.1:8080` и наружу не смотрит: TLS и апгрейд
вебсокета снимает nginx.

### Сертификат и nginx

Сертификат выпускается первым — иначе nginx не стартует с конфигом,
который ссылается на несуществующие файлы:

```sh
sudo certbot certonly --nginx -d relay.clip.gocpa.ru

sudo cp /opt/clip/relay/nginx.conf /etc/nginx/conf.d/relay.clip.gocpa.ru.conf
sudo nginx -t && sudo systemctl reload nginx
```

### Проверка

Обычный `GET` вебсокет-сервер отвергает, поэтому проверяем настоящим
рукопожатием:

```sh
curl -sS -i -N \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H "Sec-WebSocket-Key: $(head -c16 /dev/urandom | base64)" \
  https://relay.clip.gocpa.ru | head -1
```

Ожидаемый ответ — `HTTP/1.1 101 Switching Protocols`. Всё остальное
означает, что до контейнера не дошли: смотрите
`/var/log/nginx/clip-relay.error.log`.

## 3. Переключение приложения на свой релей

Пока приложение ходит через публичные Nostr-релеи. Переключение — правка
в `src/net.ts`:

```ts
import {joinRoom} from '@trystero-p2p/ws-relay'

const room = joinRoom(
  {
    appId: APP_ID,
    password: secret,
    relayConfig: {urls: ['wss://relay.clip.gocpa.ru']}
  },
  await roomIdFor(secret)
)
```

плюс `npm i @trystero-p2p/ws-relay` в корне проекта.

> **Чем платим.** Стратегия в trystero выбирается на сборку. Перейдя на свой
> релей, приложение теряет 28 публичных Nostr-релеев с их избыточностью:
> ляжет наш — встанет всё. `urls` принимает список, поэтому страховка —
> второй инстанс на другом хосте.

## Эксплуатация

```sh
# Логи релея
sudo docker compose -f /etc/docker/containers/clip-relay/docker-compose.yml logs -f

# Обновление после изменений в репозитории
sudo git -C /opt/clip pull
sudo docker compose -f /etc/docker/containers/clip-relay/docker-compose.yml up -d --build

# Логи nginx
sudo tail -f /var/log/nginx/clip-relay.{access,error}.log
```

Сертификат продлевает системный таймер certbot. Блок на 80-м порту в
`nginx.conf` оставлен именно для этого: он отдаёт `/.well-known/acme-challenge/`
и редиректит всё остальное на HTTPS.

## Диагностика

Приложение умеет рассказывать о себе, если открыть его с `?debug`:

```
https://clip.gocpa.ru/?debug#имя-комнаты
```

Через шесть секунд после входа в комнату в консоль печатается сводка вида
`релеи: открыто 3 из 4` со списком адресов, а в `window.__clip` появляются
состояние приложения и функция `relays()`. В обычном режиме ничего этого нет.

Как читать результат:

- **ни одного открытого релея** — сигналинг перекрыт, устройства физически
  не могут узнать друг о друге. Это тот случай, ради которого поднимался
  свой релей.
- **релеи открыты, но второе устройство не появляется** — знакомство прошло,
  а прямой канал через NAT не встаёт. Релей здесь не поможет, нужен TURN.
