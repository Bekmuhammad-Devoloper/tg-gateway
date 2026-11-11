import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { UiProvider } from './ui';
import './styles.css';
import './lively.css';

// Telegram ichida — Telegram mavzusi (yorug'/qorong'i) bo'yicha
const tg = window.Telegram?.WebApp;
if (tg?.initData) {
  const apply = () => (document.documentElement.dataset.theme = tg.colorScheme);
  apply();
  tg.onEvent('themeChanged', apply);
  document.documentElement.classList.add('in-telegram');
  // Telegram'ning sarlavha va fon rangi panelning foni bilan bir xil bo'lsin
  try {
    tg.setHeaderColor?.('secondary_bg_color');
    tg.setBackgroundColor?.('secondary_bg_color');
  } catch {
    /* eski Telegram versiyalarida yo'q */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>
      <App />
    </UiProvider>
  </StrictMode>,
);
