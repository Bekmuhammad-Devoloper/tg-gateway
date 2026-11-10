import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { UiProvider } from './ui';
import './styles.css';

// Telegram ichida — Telegram mavzusi (yorug'/qorong'i) bo'yicha
const tg = window.Telegram?.WebApp;
if (tg?.initData) {
  const apply = () => (document.documentElement.dataset.theme = tg.colorScheme);
  apply();
  tg.onEvent('themeChanged', apply);
  document.documentElement.classList.add('in-telegram');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>
      <App />
    </UiProvider>
  </StrictMode>,
);
