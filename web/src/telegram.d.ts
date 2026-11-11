// Telegram Mini App obyektining panelda ishlatiladigan qismi
interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  expand(): void;
  openTelegramLink(url: string): void;
  HapticFeedback?: { notificationOccurred(type: 'error' | 'success' | 'warning'): void };
  onEvent(event: 'themeChanged', cb: () => void): void;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
