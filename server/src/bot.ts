// Telegram bot: foydalanuvchi raqamini bir marta tasdiqlaydi va kodlarni oladi; admin panelni ochadi.
import { Bot, GrammyError, InlineKeyboard, Keyboard, type Context } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';

import type { CodeService, Messenger } from './codes.js';
import type { Store } from './store.js';
import { langOf, t, type Lang } from './texts.js';
import { maskPhone, normalizePhone } from './util.js';

export interface BotDeps {
  store: Store;
  codes: () => CodeService;
  publicUrl: string;
  /** Birinchi adminni belgilash uchun bir martalik kod (adminlar bo'lmasa) */
  claim: { code: string | null };
  log: (msg: string) => void;
}

/** Admin panel Telegram ichida (Mini App) faqat https manzilda ochiladi */
export const webAppAllowed = (url: string): boolean => url.startsWith('https://');

export function createBot(token: string, deps: BotDeps, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);
  const { store } = deps;
  const lang = (ctx: Context): Lang => langOf(ctx.from?.language_code);
  const shareKeyboard = (l: Lang) => new Keyboard().requestContact(t(l, 'shareButton')).resized().oneTime();
  /** Havola orqali kelgan, hali raqamini yubormagan foydalanuvchi qaysi so'rov uchun kelgani */
  const pending = new Map<number, string>();

  const askContact = (ctx: Context) =>
    ctx.reply(t(lang(ctx), 'welcome', { name: ctx.from?.first_name ?? '' }, store.getSetting(`welcome.${lang(ctx)}`)), {
      parse_mode: 'HTML',
      reply_markup: shareKeyboard(lang(ctx)),
    });

  bot.command('start', async ctx => {
    const l = lang(ctx);
    const payload = ctx.match?.trim();
    const contact = ctx.from ? store.contactByTg(ctx.from.id) : undefined;
    if (contact?.blocked) return void (await ctx.reply(t(l, 'blocked'), { parse_mode: 'HTML' }));

    if (payload) {
      const found = deps.codes().inspectToken(payload);
      if (!found || found.expired) {
        await ctx.reply(t(l, 'expired'), { parse_mode: 'HTML' });
        if (!contact) await askContact(ctx);
        return;
      }
      if (contact) {
        if (contact.phone !== found.delivery.phone) {
          return void (await ctx.reply(t(l, 'mismatch', { expected: maskPhone(found.delivery.phone), phone: contact.phone }), { parse_mode: 'HTML' }));
        }
        // Allaqachon ulangan: kutilayotgan kod darhol keladi
        await deps.codes().deliverWaiting(contact);
        return;
      }
      if (ctx.from) pending.set(ctx.from.id, payload);
      return void (await askContact(ctx));
    }

    if (contact) return void (await ctx.reply(t(l, 'linked', { phone: contact.phone }), { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }));
    await askContact(ctx);
  });

  bot.on('message:contact', async ctx => {
    const l = lang(ctx);
    const c = ctx.message.contact;
    // Faqat o'z raqami: boshqaning kontaktini yuborib uning kodlarini olib bo'lmaydi
    if (c.user_id !== ctx.from.id) {
      return void (await ctx.reply(t(l, 'notOwnContact'), { parse_mode: 'HTML', reply_markup: shareKeyboard(l) }));
    }
    const phone = normalizePhone(c.phone_number);
    if (!phone) return void (await ctx.reply(t(l, 'notOwnContact'), { parse_mode: 'HTML', reply_markup: shareKeyboard(l) }));
    const existing = store.contactByTg(ctx.from.id);
    if (existing?.blocked) return void (await ctx.reply(t(l, 'blocked'), { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }));

    const contact = store.linkContact({ tgId: ctx.from.id, phone, firstName: ctx.from.first_name, username: ctx.from.username, lang: l });
    deps.log(`contact linked ${maskPhone(phone)}`);
    const sent = await deps.codes().deliverWaiting(contact);
    const token = pending.get(ctx.from.id);
    pending.delete(ctx.from.id);
    if (sent > 0) return void (await ctx.reply(t(l, 'delivered'), { reply_markup: { remove_keyboard: true } }));

    // Ilovada boshqa raqam kiritilgan bo'lsa — aniq aytamiz
    const wanted = token ? deps.codes().inspectToken(token) : undefined;
    if (wanted && !wanted.expired && wanted.delivery.phone !== phone) {
      return void (await ctx.reply(t(l, 'mismatch', { expected: maskPhone(wanted.delivery.phone), phone }), { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }));
    }
    await ctx.reply(t(l, 'linkedNoWaiting', { phone }), { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });
  });

  bot.command('help', ctx => ctx.reply(t(lang(ctx), 'help'), { parse_mode: 'HTML' }));

  bot.command('claim', async ctx => {
    const l = lang(ctx);
    const code = ctx.match?.trim();
    if (!ctx.from || !deps.claim.code || !code || code !== deps.claim.code) return void (await ctx.reply(t(l, 'claimBad')));
    store.addAdmin(ctx.from.id, [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '));
    deps.claim.code = null;
    deps.log(`admin claimed by ${ctx.from.id}`);
    await setAdminCommands(bot, ctx.from.id, l).catch(() => {});
    await setAdminMenu(bot, ctx.from.id, deps.publicUrl, l).catch(() => {});
    await ctx.reply(t(l, 'claimOk'));
  });

  bot.command('admin', async ctx => {
    const l = lang(ctx);
    if (!ctx.from || !store.isAdmin(ctx.from.id)) return void (await ctx.reply(t(l, 'adminOnly')));
    const link = `${deps.publicUrl}/?login=${store.createLoginLink(ctx.from.id)}`;
    if (webAppAllowed(deps.publicUrl)) {
      await ctx.reply(t(l, 'adminPanel'), { parse_mode: 'HTML', reply_markup: new InlineKeyboard().webApp(t(l, 'adminOpen'), `${deps.publicUrl}/`) });
      await setAdminMenu(bot, ctx.from.id, deps.publicUrl, l).catch(() => {});
    } else {
      await ctx.reply(t(l, 'adminPanel'), { parse_mode: 'HTML' });
    }
    // Telegram tugmalari localhost/http manzilni qabul qilmaydi — havola matn bo'lib keladi
    await ctx.reply(`${t(l, 'browserLink')}\n${link}`, { link_preview_options: { is_disabled: true } });
  });

  bot.catch(err => deps.log(`bot error: ${err.message}`));
  return bot;
}

/** Hamma uchun buyruqlar ro'yxati (uch tilda) */
export async function setPublicCommands(bot: Bot): Promise<void> {
  for (const l of ['uz', 'ru', 'en'] as const) {
    const commands = [
      { command: 'start', description: { uz: 'Raqamni ulash / holat', ru: 'Привязать номер / статус', en: 'Link number / status' }[l] },
      { command: 'help', description: { uz: 'Yordam', ru: 'Помощь', en: 'Help' }[l] },
    ];
    await bot.api.setMyCommands(commands, l === 'uz' ? {} : { language_code: l });
  }
}

/** Admin chatida qo'shimcha /admin buyrug'i ko'rinadi */
export async function setAdminCommands(bot: Bot, chatId: number, lang: Lang): Promise<void> {
  await bot.api.setMyCommands(
    [
      { command: 'start', description: { uz: 'Raqamni ulash / holat', ru: 'Привязать номер / статус', en: 'Link number / status' }[lang] },
      { command: 'admin', description: { uz: 'Admin panel', ru: 'Панель администратора', en: 'Admin panel' }[lang] },
      { command: 'help', description: { uz: 'Yordam', ru: 'Помощь', en: 'Help' }[lang] },
    ],
    { scope: { type: 'chat', chat_id: chatId } },
  );
}

/** Admin chatining menyu tugmasi panelni ochadi (faqat https) */
export async function setAdminMenu(bot: Bot, chatId: number, publicUrl: string, lang: Lang): Promise<void> {
  if (!webAppAllowed(publicUrl)) return;
  await bot.api.setChatMenuButton({ chat_id: chatId, menu_button: { type: 'web_app', text: t(lang, 'adminOpen'), web_app: { url: `${publicUrl}/` } } });
}

/**
 * Telegram profil rasmi (kichik o'lcham, JPEG). Bir soat xotirada saqlanadi; rasm yo'q yoki
 * maxfiylik sozlamasi yopgan bo'lsa — null.
 */
export function profilePhotos(bot: Bot, token: string): (who: 'bot' | number) => Promise<Buffer | null> {
  const cache = new Map<number, { at: number; data: Buffer | null }>();
  const HOUR = 3_600_000;
  return async who => {
    const userId = who === 'bot' ? bot.botInfo.id : who;
    const hit = cache.get(userId);
    if (hit && Date.now() - hit.at < HOUR) return hit.data;
    let data: Buffer | null = null;
    try {
      const { photos } = await bot.api.getUserProfilePhotos(userId, { limit: 1 });
      const sizes = photos[0] ?? [];
      const pick = sizes.find(s => s.width >= 160) ?? sizes[sizes.length - 1];
      if (pick) {
        const file = await bot.api.getFile(pick.file_id);
        if (file.file_path) {
          const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(8000) });
          if (res.ok) data = Buffer.from(await res.arrayBuffer());
        }
      }
    } catch {
      data = null;
    }
    cache.set(userId, { at: Date.now(), data });
    return data;
  };
}

/** Bot orqali kod yuborish (xabar id'si qaytadi; foydalanuvchi botni to'xtatgan bo'lsa null) va yopish */
export function botMessenger(bot: Bot, log: (msg: string) => void): Messenger {
  return {
    async sendCode(chatId, html, code, lang) {
      const keyboard = new InlineKeyboard().copyText(t(lang, 'copy'), code);
      try {
        const sent = await bot.api.sendMessage(chatId, html, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
        return sent.message_id;
      } catch (error) {
        if (error instanceof GrammyError && error.error_code === 403) return null;
        // Loyiha shabloni HTML xatosi bo'lsa — oddiy matn bilan
        if (error instanceof GrammyError && error.error_code === 400) {
          try {
            const sent = await bot.api.sendMessage(chatId, code, { reply_markup: keyboard });
            return sent.message_id;
          } catch {
            return null;
          }
        }
        log(`send failed: ${(error as Error).message}`);
        return null;
      }
    },
    async closeCode(chatId, messageId, html) {
      try {
        // reply_markup berilmasa nusxalash tugmasi ham olib tashlanadi
        await bot.api.editMessageText(chatId, messageId, html, { parse_mode: 'HTML' });
      } catch (error) {
        // xabar o'chirilgan yoki allaqachon o'zgartirilgan — qayta urinish shart emas
        if (!(error instanceof GrammyError)) log(`close failed: ${(error as Error).message}`);
      }
    },
  };
}
