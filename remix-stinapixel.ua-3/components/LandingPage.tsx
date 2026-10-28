
import React, { useState } from 'react';
import { User } from '../types';
import { ADMIN_CREDENTIALS, TELEGRAM_SUPPORT_URL, TELEGRAM_SUPPORT_HANDLE } from '../constants';

interface Props {
  onLogin: (user: User) => void;
}

const LandingPage: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('ref') || '';
    } catch {
      return '';
    }
  });
  const [isRegistering, setIsRegistering] = useState(true); 
  const [error, setError] = useState('');

  const getUsers = (): any[] => {
    const saved = localStorage.getItem('stnapixel_all_users');
    if (saved) return JSON.parse(saved);
    const initial = [{ ...ADMIN_CREDENTIALS, username: 'Admin', balance: 1000000, isAdmin: true, registrationDate: new Date().toISOString() }];
    localStorage.setItem('stnapixel_all_users', JSON.stringify(initial));
    return initial;
  };

  const saveUsers = (users: any[]) => {
    localStorage.setItem('stnapixel_all_users', JSON.stringify(users));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      setError('Будь ласка, заповніть всі поля.');
      return;
    }

    const users = getUsers();
    const existingUser = users.find(u => u.email === email);

    if (isRegistering) {
      if (existingUser) {
        setError('Користувач з такою поштою вже існує.');
        return;
      }

      let referrerUser: any = null;
      const cleanRef = referralCode.trim();
      if (cleanRef) {
        referrerUser = users.find(u => 
          u.id?.toLowerCase() === cleanRef.toLowerCase() || 
          u.username?.toLowerCase() === cleanRef.toLowerCase()
        );
        if (!referrerUser) {
          setError('Вказаний реферальний код не знайдено. Перевірте його або залиште поле порожнім.');
          return;
        }
      }

      const newUser: User = {
        id: `ID${Math.floor(Math.random() * 900000 + 100000)}`,
        email,
        username: email.split('@')[0],
        balance: 10.0, 
        isAdmin: false,
        registrationDate: new Date().toISOString(),
        bio: "Привіт! Я новий художник на цій стіні.",
        referredBy: referrerUser ? referrerUser.id : undefined,
        referralCount: 0,
        referralEarnings: 0
      };

      const updatedUsers = [...users];
      if (referrerUser) {
        const refIdx = updatedUsers.findIndex(u => u.id === referrerUser.id);
        if (refIdx !== -1) {
          updatedUsers[refIdx] = {
            ...updatedUsers[refIdx],
            balance: (updatedUsers[refIdx].balance || 0) + 10,
            referralCount: (updatedUsers[refIdx].referralCount || 0) + 1,
            referralEarnings: (updatedUsers[refIdx].referralEarnings || 0) + 10
          };

          // Log finance entry
          const finLog = {
            id: `FIN_REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            adminId: 'SYSTEM_REFERRAL',
            targetId: referrerUser.id,
            amount: 10,
            timestamp: Date.now()
          };
          const savedLogs = JSON.parse(localStorage.getItem('stnapixel_finance_logs') || '[]');
          localStorage.setItem('stnapixel_finance_logs', JSON.stringify([finLog, ...savedLogs]));
        }
      }

      const dbEntry = { ...newUser, password };
      saveUsers([...updatedUsers, dbEntry]);
      onLogin(newUser);
    } else {
      if (!existingUser) {
        setError('Обліковий запис не знайдено.');
      } else if (existingUser.password !== password) {
        setError('Невірний пароль.');
      } else {
        const { password, ...userObj } = existingUser;
        onLogin(userObj as User);
      }
    }
  };

  const enterAsGuest = () => {
    const guestUser: User = {
      id: 'GUEST',
      email: 'guest@stnapixel.ua',
      username: 'Гість',
      balance: 0,
      isAdmin: false,
      registrationDate: new Date().toISOString(),
      bio: "Я просто переглядаю стіну."
    };
    onLogin(guestUser);
  };

  const scrollToAuth = () => {
    const element = document.getElementById('auth');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500 matrix-bg overflow-x-hidden">
      <div className="fixed inset-0 opacity-20 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950"></div>
      </div>

      {/* Telegram Floating Support Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-[100] flex items-center group">
        <div className="mr-3 bg-blue-600/90 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none shadow-xl translate-x-3 group-hover:translate-x-0 hidden sm:block">
          Підтримка
        </div>
        <a 
          href={TELEGRAM_SUPPORT_URL} 
          target="_blank" 
          rel="noreferrer"
          className="bg-blue-600 hover:bg-blue-500 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-900/40 transition-all active:scale-90 group"
          title={`Підтримка в Telegram (${TELEGRAM_SUPPORT_HANDLE})`}
          aria-label={`Підтримка в Telegram ${TELEGRAM_SUPPORT_HANDLE}`}
        >
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
        </a>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] sm:min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10 overflow-hidden landscape:py-6 md:landscape:py-8">
        <div className="max-w-5xl animate-slide-up w-full">
          <div className="inline-block bg-blue-600/10 border border-blue-500/20 px-3 sm:px-5 py-1 sm:py-1.5 rounded-full mb-3 sm:mb-8 backdrop-blur-sm">
            <span className="text-blue-400 text-[9px] sm:text-xs font-bold uppercase tracking-wider">NFT ЕКОСИСТЕМА · 100 МЛН ПІКСЕЛІВ</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold text-blue-500 mb-4 sm:mb-6 tracking-tight select-none">
            StinaPixel<span className="text-white">.ua</span>
          </h1>
          <p className="text-sm sm:text-lg md:text-xl text-slate-300 font-medium tracking-normal mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
            Спільна цифрова піксельна історія на полотні
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-14 max-w-md sm:max-w-none mx-auto">
             <button 
                onClick={scrollToAuth} 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 sm:px-10 py-3 sm:py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all uppercase tracking-wider text-xs sm:text-sm active:scale-95"
             >
               Приєднатися до стіни
             </button>
             <button 
                onClick={enterAsGuest} 
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-7 sm:px-10 py-3 sm:py-4 rounded-xl transition-all uppercase tracking-wider text-xs sm:text-sm border border-slate-700 active:scale-95"
             >
               Увійти як гість
             </button>
          </div>
          
          <div className="animate-bounce opacity-30 mt-4 sm:mt-8 landscape:hidden md:landscape:block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* Опис проекту для новачків */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Що таке <span className="text-blue-500">StinaPixel</span>?
            </h2>
            <div className="text-slate-400 space-y-6 text-lg font-medium leading-relaxed">
              <p>
                StinaPixel — це не просто сайт для малювання. Це **вічне цифрове полотно**, де кожен піксель має свого власника. Ми будуємо екосистему, де ваші рисунки стають частиною історії, а згодом — повноцінними NFT активами.
              </p>
              <p className="hidden sm:block">
                Тут немає "просто картинок". Тут є **"Стіна"** — спільний простір, де тисячі людей борються за кожен міліметр полотна, створюючи рисунки, які залишаться назавжди.
              </p>
            </div>
          </div>
          <div className="bg-slate-900 p-10 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl"></div>
            <h3 className="text-2xl font-bold mb-6">Як почати?</h3>
            <ul className="space-y-6">
              <li className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">1</div>
                <p className="text-sm text-slate-300 font-medium">Зареєструйся та отримай свій унікальний ID.</p>
              </li>
              <li className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">2</div>
                <p className="text-sm text-slate-300 font-medium">Поповни баланс або відкрий безкоштовний щоденний кейс.</p>
              </li>
              <li className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">3</div>
                <p className="text-sm text-slate-300 font-medium">Обери місце на Стіні та створи свій перший цифровий рисунок.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Соціальна взаємодія */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">Спілкуйся. Взаємодій. Оцінюй.</h2>
          <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">Твоя творчість має значення для всіх</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon="💬"
            title="Особисті Повідомлення"
            desc="Знайшов крутого художника? Напиши йому в чат! Обговорюйте спільні проекти або просто знайомтеся."
          />
          <FeatureCard 
            icon="❤️"
            title="Система Лайків"
            desc="Оцінюй роботи інших користувачів. Найкращі рисунки потрапляють у ТОП Музею та отримують визнання всієї спільноти."
          />
          <FeatureCard 
            icon="👥"
            title="Профілі Художників"
            desc="Кожен користувач має свій публічний профіль з біографією та повною історією створених рисунків."
          />
        </div>
      </section>

      {/* NFT та Майбутнє */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24 bg-slate-900/40 rounded-3xl border border-slate-800 mb-24">
        <div className="flex flex-col md:flex-row items-center gap-16 px-6">
          <div className="text-8xl md:text-9xl animate-pulse">💎</div>
          <div className="space-y-6 flex-1 text-center md:text-left">
             <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Еволюція в <span className="text-blue-500">NFT</span></h2>
             <p className="text-slate-400 text-lg font-medium leading-relaxed">
                Ми розробляємо механіку токенізації Стіни. Кожен піксель, який ти займаєш сьогодні, — це твій цифровий актив завтра. VIP-рисунки отримають статус унікальних NFT колекцій, які можна буде продавати або обмінювати на внутрішньому маркетплейсі.
             </p>
             <div className="flex items-center justify-center md:justify-start space-x-4">
                <span className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-lg text-blue-400 text-[10px] font-bold uppercase tracking-widest">ROADMAP 2026</span>
                <span className="text-slate-600 font-mono text-xs">// Decentralized Canvas Protocol</span>
             </div>
          </div>
        </div>
      </section>

      {/* Щоденний Бонус та Реферальна Програма */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-yellow-500/5 border border-yellow-500/20 px-8 py-10 rounded-3xl backdrop-blur-xl text-center flex flex-col justify-between">
             <div>
               <div className="text-5xl mb-4 animate-bounce inline-block">🎁</div>
               <h3 className="text-2xl sm:text-3xl font-bold text-yellow-500 mb-3 tracking-tight">Щоденний Безкоштовний Бонус</h3>
               <p className="text-slate-400 text-sm font-medium leading-relaxed">Кожні 24 години кожен зареєстрований користувач може відкрити кейс та виграти до 250 ₴ на баланс.</p>
             </div>
             <div className="mt-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500/80 bg-yellow-500/10 px-4 py-1.5 rounded-full border border-yellow-500/20">Доступно щодня</span>
             </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 px-8 py-10 rounded-3xl backdrop-blur-xl text-center flex flex-col justify-between">
             <div>
               <div className="text-5xl mb-4 inline-block">🤝</div>
               <h3 className="text-2xl sm:text-3xl font-bold text-emerald-400 mb-3 tracking-tight">Реферальна Програма</h3>
               <p className="text-slate-400 text-sm font-medium leading-relaxed">Отримуйте <span className="text-emerald-400 font-bold">10 ₴ на баланс</span> за кожного запрошеного друга, який зареєструється за вашим посиланням чи кодом.</p>
             </div>
             <div className="mt-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">10 ₴ за кожного друга</span>
             </div>
          </div>
        </div>
      </section>

      {/* Auth Section */}
      <section id="auth" className="relative z-10 py-12 sm:py-20 md:py-28 scroll-mt-14 px-3.5 sm:px-6">
        <div className="bg-slate-900/90 border border-slate-800 p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-xl max-w-md mx-auto relative overflow-hidden animate-slide-up backdrop-blur-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
          
          <div className="text-center mb-6 sm:mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1.5">{isRegistering ? 'Реєстрація' : 'Вхід у систему'}</h3>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{isRegistering ? 'Створи свій цифровий профіль' : 'Повернися до полотна'}</p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs sm:text-sm font-medium text-center animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
              <input 
                type="email" required placeholder="art@stinapixel.ua"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 sm:py-3.5 px-4 sm:px-5 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium transition-all text-sm"
                value={email} onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Пароль</label>
              <input 
                type="password" required placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 sm:py-3.5 px-4 sm:px-5 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium transition-all text-sm"
                value={password} onChange={(e) => setPassword(e.target.value)} 
              />
            </div>
            {isRegistering && (
              <div className="space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Реферальний код (ID)</label>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">+10 ₴ другу</span>
                </div>
                <input 
                  type="text" placeholder="ID друга (наприклад ID123456, необов'язково)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 sm:py-3.5 px-4 sm:px-5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all text-sm placeholder:text-slate-600"
                  value={referralCode} onChange={(e) => setReferralCode(e.target.value)} 
                />
              </div>
            )}
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 sm:py-3.5 rounded-xl uppercase tracking-wider shadow-lg shadow-blue-900/20 transition-all active:scale-95 text-xs sm:text-sm"
            >
              {isRegistering ? 'Зареєструватися' : 'Увійти'}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-800/80 text-center">
            <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="text-slate-400 hover:text-white text-xs font-semibold transition-all">
              {isRegistering ? 'Вже маєте акаунт? Увійти' : 'Немає акаунту? Реєстрація'}
            </button>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 py-16 md:py-32 border-t border-slate-900 text-center relative z-10 overflow-hidden landscape:py-12">
        <div className="absolute inset-0 opacity-5 matrix-bg"></div>
        <h2 className="text-3xl md:text-5xl font-black text-slate-800 mb-6 md:mb-8 italic tracking-widest select-none relative z-10 uppercase landscape:text-2xl">STINAPIXEL.UA</h2>
        <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-slate-500 font-black text-[10px] md:text-xs uppercase italic relative z-10">
           <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="hover:text-blue-500 transition-colors tracking-widest uppercase">Головна</button>
           <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noreferrer" className="hover:text-blue-500 transition-colors tracking-widest">Підтримка ({TELEGRAM_SUPPORT_HANDLE})</a>
           <a href="https://send.monobank.ua/jar/7qJ7czcn6v" target="_blank" rel="noreferrer" className="hover:text-blue-500 transition-colors tracking-widest">MonoBank Банка</a>
        </div>
        <div className="mt-12 md:mt-20 text-slate-800 text-[7px] md:text-[8px] font-black uppercase tracking-widest relative z-10 italic">
          StinaPixel.ua &copy; 2026 - Цифровий Погляд у Майбутнє
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-lg hover:border-blue-600/30 transition-all group">
     <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-500 inline-block">{icon}</div>
     <h4 className="text-xl font-bold text-white mb-3 tracking-tight">{title}</h4>
     <p className="text-slate-500 text-sm font-medium leading-relaxed">{desc}</p>
  </div>
);

export default LandingPage;
