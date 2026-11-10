// Bot matnlari (o'zbek, rus, ingliz). Admin panelda xush kelibsiz matnini o'zgartirish mumkin.
import { escapeHtml } from './util.js';

export type Lang = 'uz' | 'ru' | 'en';

export const langOf = (code?: string | null): Lang => (code?.startsWith('ru') ? 'ru' : code?.startsWith('en') ? 'en' : 'uz');

type Texts = Record<
  | 'welcome' | 'shareButton' | 'linked' | 'notOwnContact' | 'linkedNoWaiting' | 'mismatch' | 'expired'
  | 'blocked' | 'help' | 'copy' | 'codeTitle' | 'codeLine' | 'codeTtl' | 'codeWarn' | 'delivered' | 'adminPanel'
  | 'adminOpen' | 'adminOnly' | 'claimOk' | 'claimBad' | 'browserLink',
  string
>;

const T: Record<Lang, Texts> = {
  uz: {
    welcome: 'Assalomu alaykum, {name}! 👋\n\nBu bot ilovalarga kirish uchun <b>tasdiqlash kodlarini</b> yuboradi.\n\nKod olish uchun telefon raqamingizni bir marta tasdiqlang — pastdagi <b>«📱 Raqamni yuborish»</b> tugmasini bosing.',
    shareButton: '📱 Raqamni yuborish',
    linked: '✅ Telegram\'ingiz <b>{phone}</b> raqamiga ulangan.\n\nIlovada <b>«Telegram orqali»</b> kirishni tanlang — kod shu yerga keladi.',
    notOwnContact: 'Iltimos, o\'zingizning raqamingizni yuboring — pastdagi <b>«📱 Raqamni yuborish»</b> tugmasi orqali.',
    linkedNoWaiting: '✅ Raqamingiz tasdiqlandi: <b>{phone}</b>\n\nHozir kutilayotgan kod yo\'q. Ilovada <b>«Telegram orqali»</b> ni tanlang — kod shu yerga keladi.',
    mismatch: '⚠️ Ilovada <b>{expected}</b> raqami kiritilgan, Telegram raqamingiz esa <b>{phone}</b>.\n\nIlovada Telegram\'dagi raqamingizni kiriting va qaytadan urinib ko\'ring.',
    expired: '⌛ Bu so\'rovning muddati tugagan. Ilovada yangi kod so\'rang.',
    blocked: '⛔ Bu raqam uchun kod yuborish cheklangan. Administrator bilan bog\'laning.',
    help: 'ℹ️ Bu bot ilovalarga kirish kodlarini yuboradi.\n\n1. Ilovada telefon raqamingizni kiriting va <b>«Telegram orqali»</b> ni tanlang.\n2. Kod shu chatga keladi — uni ilovaga kiriting.\n\nKodni hech kimga bermang.',
    copy: '📋 Kodni nusxalash',
    codeTitle: '🔐 <b>{project}</b>',
    codeLine: 'Tasdiqlash kodingiz:',
    codeTtl: '⏱ {minutes} daqiqa amal qiladi',
    codeWarn: '🚫 Kodni hech kimga bermang — hatto xodimlarga ham.',
    delivered: '✅ Kod yuqorida. Uni ilovaga kiriting.',
    adminPanel: '🛠 <b>Admin panel</b>\n\nLoyihalar, kodlar tarixi, foydalanuvchilar va sozlamalar.',
    adminOpen: '🛠 Panelni ochish',
    adminOnly: 'Bu buyruq faqat administratorlar uchun.',
    claimOk: '✅ Siz endi administratorsiz. /admin — panelni ochish.',
    claimBad: '❌ Kod noto\'g\'ri yoki allaqachon ishlatilgan.',
    browserLink: 'Brauzerda ochish uchun havola (10 daqiqa amal qiladi):',
  },
  ru: {
    welcome: 'Здравствуйте, {name}! 👋\n\nЭтот бот присылает <b>коды подтверждения</b> для входа в приложения.\n\nЧтобы получать коды, один раз подтвердите номер — нажмите кнопку <b>«📱 Отправить номер»</b> внизу.',
    shareButton: '📱 Отправить номер',
    linked: '✅ Ваш Telegram привязан к номеру <b>{phone}</b>.\n\nВ приложении выберите вход <b>«через Telegram»</b> — код придёт сюда.',
    notOwnContact: 'Пожалуйста, отправьте свой номер — кнопкой <b>«📱 Отправить номер»</b> внизу.',
    linkedNoWaiting: '✅ Номер подтверждён: <b>{phone}</b>\n\nСейчас ожидающих кодов нет. В приложении выберите <b>«через Telegram»</b> — код придёт сюда.',
    mismatch: '⚠️ В приложении введён номер <b>{expected}</b>, а ваш номер в Telegram — <b>{phone}</b>.\n\nВведите в приложении номер из Telegram и попробуйте снова.',
    expired: '⌛ Срок этого запроса истёк. Запросите новый код в приложении.',
    blocked: '⛔ Отправка кодов на этот номер ограничена. Свяжитесь с администратором.',
    help: 'ℹ️ Этот бот присылает коды для входа в приложения.\n\n1. Введите номер в приложении и выберите <b>«через Telegram»</b>.\n2. Код придёт в этот чат — введите его в приложении.\n\nНикому не сообщайте код.',
    copy: '📋 Скопировать код',
    codeTitle: '🔐 <b>{project}</b>',
    codeLine: 'Ваш код подтверждения:',
    codeTtl: '⏱ Действует {minutes} мин',
    codeWarn: '🚫 Никому не сообщайте код — даже сотрудникам.',
    delivered: '✅ Код выше. Введите его в приложении.',
    adminPanel: '🛠 <b>Панель администратора</b>\n\nПроекты, история кодов, пользователи и настройки.',
    adminOpen: '🛠 Открыть панель',
    adminOnly: 'Эта команда только для администраторов.',
    claimOk: '✅ Теперь вы администратор. /admin — открыть панель.',
    claimBad: '❌ Код неверный или уже использован.',
    browserLink: 'Ссылка для браузера (действует 10 минут):',
  },
  en: {
    welcome: 'Hello, {name}! 👋\n\nThis bot sends <b>verification codes</b> for signing in to apps.\n\nTo get codes, confirm your phone number once — tap <b>«📱 Share my number»</b> below.',
    shareButton: '📱 Share my number',
    linked: '✅ Your Telegram is linked to <b>{phone}</b>.\n\nChoose <b>«via Telegram»</b> in the app — the code will come here.',
    notOwnContact: 'Please share your own number — with the <b>«📱 Share my number»</b> button below.',
    linkedNoWaiting: '✅ Number confirmed: <b>{phone}</b>\n\nNo code is waiting right now. Choose <b>«via Telegram»</b> in the app — the code will come here.',
    mismatch: '⚠️ The app has <b>{expected}</b>, but your Telegram number is <b>{phone}</b>.\n\nEnter your Telegram number in the app and try again.',
    expired: '⌛ This request has expired. Ask for a new code in the app.',
    blocked: '⛔ Codes to this number are restricted. Contact the administrator.',
    help: 'ℹ️ This bot sends sign-in codes for apps.\n\n1. Enter your number in the app and choose <b>«via Telegram»</b>.\n2. The code comes to this chat — enter it in the app.\n\nNever share the code.',
    copy: '📋 Copy code',
    codeTitle: '🔐 <b>{project}</b>',
    codeLine: 'Your verification code:',
    codeTtl: '⏱ Valid for {minutes} min',
    codeWarn: '🚫 Never share this code — not even with staff.',
    delivered: '✅ The code is above. Enter it in the app.',
    adminPanel: '🛠 <b>Admin panel</b>\n\nProjects, code history, users and settings.',
    adminOpen: '🛠 Open panel',
    adminOnly: 'This command is for administrators only.',
    claimOk: '✅ You are an administrator now. /admin opens the panel.',
    claimBad: '❌ The code is wrong or already used.',
    browserLink: 'Link for a browser (valid 10 minutes):',
  },
};

/** Matn: {kalit} o'rniga qiymat (HTML uchun xavfsizlangan) */
export function t(lang: Lang, key: keyof Texts, vars: Record<string, string | number> = {}, override?: string): string {
  const base = override?.trim() ? override : T[lang][key];
  return base.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? escapeHtml(String(vars[k])) : `{${k}}`));
}

/**
 * Kod xabari. Loyiha o'z shablonini bersa ({project}, {code}, {minutes}) — o'shandan,
 * aks holda standart chiroyli ko'rinishda.
 */
export function codeMessage(lang: Lang, project: string, code: string, minutes: number, template?: string): string {
  if (template?.trim()) {
    return template
      .replace(/\{project\}/g, escapeHtml(project))
      .replace(/\{minutes\}/g, String(minutes))
      .replace(/\{code\}/g, `<code>${escapeHtml(code)}</code>`);
  }
  return [
    t(lang, 'codeTitle', { project }),
    '',
    t(lang, 'codeLine'),
    `<code>${escapeHtml(code)}</code>`,
    '',
    t(lang, 'codeTtl', { minutes }),
    t(lang, 'codeWarn'),
  ].join('\n');
}
