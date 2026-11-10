# Telegram kod shlyuzi

Ilovalar va saytlar uchun **tasdiqlash kodlarini Telegram orqali yetkazadigan** alohida xizmat.
Bitta bot va bitta server bir nechta loyihaga xizmat qiladi. Har bir loyiha o'z API kaliti bilan ulanadi.
Barcha sozlamalar **admin panelda** (veb-ilova, Telegram ichida Mini App bo'lib ham ochiladi).

- **Foydalanuvchi** botda faqat kod oladi. Raqamini bir marta «📱 Raqamni yuborish» tugmasi bilan tasdiqlaydi.
- **Admin** panelda:
  - loyihalarni qo'shadi va API kalit oladi;
  - xabar shablonini, kod uzunligini va muddatini sozlaydi;
  - kodlar tarixini ko'radi, foydalanuvchini bloklaydi yoki raqamini uzadi;
  - botning xush kelibsiz matnini o'zgartiradi va boshqa adminlarni qo'shadi.

## Qanday ishlaydi

```
Ilova (backend)            Shlyuz                          Telegram
     │  POST /v1/send         │                                │
     │  {phone, code} ───────►│ raqam ulanganmi?               │
     │                        ├── ha ─────── kod ─────────────►│ 🔐 12345 [📋 Nusxalash]
     │◄── {status: SENT}      │                                │
     │                        └── yo'q                         │
     │◄── {status: WAITING,   │                                │
     │     link: t.me/bot?start=…}                             │
     │  ilova havolani ochadi ─────────────────────────────────►│ «Start» → «📱 Raqamni yuborish»
     │                        │◄──── kontakt (faqat o'ziniki) ──│
     │                        │──── kutilayotgan kod ──────────►│ 🔐 12345
```

- Kontakt faqat foydalanuvchining **o'z raqami** bo'lsa qabul qilinadi (Telegram buni tasdiqlaydi).
  Shuning uchun begona raqamning kodini olib bo'lmaydi.
- Kodlarning o'zi panelda ko'rsatilmaydi va muddati o'tgach bazadan o'chiriladi.
- Bir loyiha bir raqamga 10 daqiqada 5 tadan ortiq kod so'ray olmaydi.

## O'rnatish

Talab: Node.js 22.13+ (tavsiya 24) yoki Docker.

```bash
cp .env.example .env      # BOT_TOKEN ni yozing
npm ci
npm run build
npm start
```

Birinchi ishga tushirishda adminlar yo'q bo'lsa, logda bir martalik kod chiqadi:

```
Adminlar hali yo'q. Telegram'da @bot ga yozing:  /claim 12345678
```

Shu buyruqni botga yuboring — siz administrator bo'lasiz. Keyin botda `/admin` — panel ochiladi.
(Yoki `.env` da `ADMIN_IDS=<Telegram ID>` yozing.)

### Serverga (Docker)

```bash
docker compose up -d --build
```

Compose loyihasining nomi `tg-code-gateway`, konteyner ham shunday nomlanadi. Shu sababli bir serverdagi
boshqa loyihalar bilan aralashmaydi. Port faqat `127.0.0.1` da ochiladi. Hostdagi port `.env` dagi
`HOST_PORT` bilan beriladi (standart 8080). Baza `tg-code-gateway_gateway-data` volume'ida turadi.

https bo'lmasa (masalan, domen hali tayyor emas), panelga SSH tunnel orqali kiriladi:

```bash
ssh -N -L 8090:127.0.0.1:<HOST_PORT> server   # keyin brauzerda http://localhost:8090
```

Bunda `.env` da `PUBLIC_URL=http://localhost:8090` bo'lsin, shunda botdagi `/admin` havolasi tunnel orqali ochiladi.

Panel Telegram ichida Mini App bo'lib ochilishi va webhook ishlashi uchun **https** kerak.
Masalan, Caddy bilan:

```
code.example.uz {
    reverse_proxy 127.0.0.1:8080
}
```

`.env`:

```
PUBLIC_URL=https://code.example.uz
BOT_MODE=webhook
```

`BOT_MODE=polling` (standart) da https shart emas: bot o'zi Telegram'dan yangilanishlarni so'raydi.
Bunda admin panelga botdagi `/admin` havolasi orqali brauzerda kiriladi.

### Muhit o'zgaruvchilari

| Nomi | Tavsif |
|---|---|
| `BOT_TOKEN` | BotFather bergan token. **Hech qachon gitga qo'ymang.** |
| `PORT` | HTTP port (standart 8080) |
| `PUBLIC_URL` | Tashqi manzil. `https://` bo'lsa panel Mini App bo'lib ochiladi |
| `BOT_MODE` | `polling` yoki `webhook` |
| `ADMIN_IDS` | Doimiy adminlar (Telegram ID), vergul bilan |
| `DATABASE_PATH` | SQLite fayli (standart `./data/gateway.db`) |

Ma'lumotlar bitta SQLite faylida turadi. Zaxira nusxa uchun shu faylni nusxalash yetarli.

## API

Har bir so'rovda loyiha kaliti yuboriladi: `Authorization: Bearer tcg_…`.
Javob: `{ ok: true, data }` yoki `{ ok: false, error: { code, message } }`.

### `POST /v1/send` — kodni loyiha yaratadi

```json
{ "phone": "+998901234567", "code": "48213", "ttlSec": 300, "lang": "uz" }
```

Javob:

```json
{ "ok": true, "data": { "id": "…", "status": "SENT", "expiresInSec": 300 } }
```

Raqam hali botga ulanmagan bo'lsa:

```json
{ "ok": true, "data": { "id": "…", "status": "WAITING", "link": "https://t.me/bot?start=…", "expiresInSec": 300 } }
```

Ilova `link` ni ochadi. Foydalanuvchi «Start» va «Raqamni yuborish» ni bosgach, kod darhol keladi.
Kodni tekshirish loyihaning o'zida qoladi.

### `POST /v1/verify` — kodni shlyuz yaratadi

```json
{ "phone": "+998901234567" }
```

Keyin `POST /v1/verify/check` bilan tekshiriladi:

```json
{ "id": "…", "code": "482913" }
```

Javob: `{ "valid": true, "attemptsLeft": 5 }`. 5 ta xato urinishdan keyin `TOO_MANY_ATTEMPTS` qaytadi.

### `GET /v1/status/:id`

Holatlar:

- `WAITING` — raqam ulanishini kutmoqda
- `SENT` — Telegram'ga yetkazildi
- `USED` — tasdiqlandi
- `EXPIRED` — muddati o'tdi
- `FAILED` — yuborib bo'lmadi

### Xatolar

| HTTP | `code` | Ma'nosi |
|---|---|---|
| 400 | `BAD_REQUEST`, `PHONE_INVALID`, `CODE_INVALID` | So'rov noto'g'ri |
| 401 | `UNAUTHORIZED` | API kalit noto'g'ri |
| 403 | `PROJECT_DISABLED`, `PHONE_BLOCKED` | Loyiha o'chirilgan yoki raqam bloklangan |
| 404 | `NOT_FOUND` | So'rov topilmadi |
| 409 | `ALREADY_USED` | Kod allaqachon ishlatilgan |
| 410 | `EXPIRED` | Kod muddati o'tgan |
| 429 | `TOO_MANY_REQUESTS`, `TOO_MANY_ATTEMPTS` | Juda ko'p so'rov yoki urinish |

## Ishlab chiqish

```bash
npm run dev        # server (tsx watch)
npm run dev:web    # panel (Vite, http://localhost:5175, API'ni 8090 ga yo'naltiradi)
npm test           # testlar
npm run typecheck
```

Tuzilishi:

- `server/src`:
  - `codes.ts` — kodlar mantig'i
  - `bot.ts` — Telegram bot
  - `http.ts` — API va panel API
  - `store.ts` va `db.ts` — SQLite
  - `auth.ts` — Mini App imzosi
- `web/src` — admin panel (React)
- `server/test` — testlar

## Xavfsizlik

- Bot tokeni faqat `.env` da turadi (`.gitignore` da). Token oshkor bo'lsa, BotFather → `/revoke` qiling va yangisini qo'ying.
- API kalitlar bazada faqat SHA-256 xeshi bo'lib saqlanadi. Kalit faqat yaratilganda bir marta ko'rsatiladi.
- Admin sessiyalari 7 kun amal qiladi. Brauzer havolasi bir martalik va 10 daqiqa amal qiladi.
- Mini App kirishi Telegram imzosi (`initData`, HMAC) bilan tekshiriladi.
