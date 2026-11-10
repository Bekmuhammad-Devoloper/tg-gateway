import { Icon } from '../ui';

export function Login({ bot, error }: { bot: string; error: string }) {
  return (
    <div className="center-screen">
      <div className="login card">
        <div className="login-mark">
          <Icon name="lock" size={30} />
        </div>
        <h1>Admin panel</h1>
        <p className="muted">Telegram kod shlyuzini boshqarish</p>

        {error && (
          <div className="alert bad">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}

        <ol className="steps">
          <li>
            <span>1</span>
            <p>Telegram’da {bot ? <b>@{bot}</b> : 'botni'} oching</p>
          </li>
          <li>
            <span>2</span>
            <p>
              <code>/admin</code> buyrug‘ini yuboring
            </p>
          </li>
          <li>
            <span>3</span>
            <p>Kelgan havola orqali kiring (10 daqiqa amal qiladi)</p>
          </li>
        </ol>

        {bot && (
          <a className="btn primary block" href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">
            <Icon name="telegram" size={18} />
            Botni ochish
          </a>
        )}
        <p className="login-note">Birinchi marta: server logidagi <code>/claim</code> kodini botga yuborib administrator bo‘ling.</p>
      </div>
    </div>
  );
}
