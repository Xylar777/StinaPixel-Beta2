import React, { useState, useEffect } from 'react';
import { realtimeClient } from '../utils/realtime';
import { isSupabaseConfigured, SUPABASE_URL } from '../utils/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

const SqlBetaModal: React.FC<Props> = ({ isOpen, onClose, isAdmin }) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'architecture' | 'telemetry' | 'safety'>('sql');
  const [sqlContent, setSqlContent] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [serverStats, setServerStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rollbackUser, setRollbackUser] = useState('');
  const [rollbackStatus, setRollbackStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch schema.sql
    fetch('/api/sql/schema')
      .then(res => res.text())
      .then(text => setSqlContent(text))
      .catch(() => {
        setSqlContent('-- Помилка завантаження файлу schema.sql');
      });

    // Fetch server health
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setServerStats(data))
      .catch(() => {});
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteRollback = async () => {
    if (!rollbackUser.trim()) return;
    setIsLoading(true);
    setRollbackStatus(null);
    try {
      const res = await fetch('/api/admin/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: 'ADMIN',
          targetUserId: rollbackUser.trim(),
          sinceHours: 24
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRollbackStatus(`✅ ${data.message || 'Зміни успішно відкочено'}`);
        setRollbackUser('');
      } else {
        setRollbackStatus(`❌ Помилка: ${data.error || 'Не вдалося виконати відкат'}`);
      }
    } catch (e: any) {
      setRollbackStatus(`❌ Помилка з'єднання: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Бета-версія для 100 гравців
                <span className="bg-blue-600/30 text-blue-400 border border-blue-500/40 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full">
                  SQL & Безпека
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Спільне онлайн-полотно 100M пікселів з авторитетним бекендом та PostgreSQL
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-4 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📜</span> Готовий schema.sql
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'safety'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛡️</span> Захист та Anti-Griefing
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⚡</span> Архітектура на 100 гравців
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'telemetry'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📡</span> Телеметрія сервера
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-sm">
          {activeTab === 'sql' && (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-300">
                  <span className="text-emerald-400 font-semibold">✓ Файл:</span> <code className="text-blue-400 font-mono">/database/schema.sql</code>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>PostgreSQL 14+ / Cloud SQL / Supabase</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>{copied ? '✓' : '📋'}</span>
                    <span>{copied ? 'Скопійовано!' : 'Копіювати SQL'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700"
                  >
                    <span>⬇️</span> Завантажити файл
                  </button>
                </div>
              </div>

              <div className="relative flex-1 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <pre className="p-4 text-[11px] sm:text-xs font-mono text-slate-300 overflow-auto max-h-[48vh] leading-relaxed selection:bg-blue-900">
                  {sqlContent || '-- Завантаження SQL схеми...'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🔒</span>
                    <h3 className="font-bold text-white text-sm">Атомарна транзакція розміщення</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Процедура <code className="text-blue-400 font-mono">place_pixel_batch_safe</code> виконує блокування рядка балансу (<code className="text-amber-400 font-mono">FOR UPDATE</code>), перевірку VIP-захисту та одночасний запис в таблицю пікселів та аудит-лог без race conditions.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">👑</span>
                    <h3 className="font-bold text-white text-sm">Захист VIP-пікселів</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    VIP-пікселі захищені на рівні SQL-тригера та схеми. Звичайні користувачі не можуть перезаписати придбані VIP-пікселі інших гравців стандартним малюванням.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⏱️</span>
                    <h3 className="font-bold text-white text-sm">Rate Limiting & Cooldowns</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Захист від бот-атак та авто-скриптів: обмеження на кількість пікселів у хвилину на гравця (5,000 пікселів/хв) для гарантії стабільності полотна.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⏪</span>
                    <h3 className="font-bold text-white text-sm">Миттєвий відкат вандалізму</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Таблиця <code className="text-blue-400 font-mono">pixel_audit_log</code> фіксує кожен крок (старий і новий колір). У разі гриферства функція <code className="text-amber-400 font-mono">rollback_user_vandalism</code> відновлює первинний вигляд за 1 клік.
                  </p>
                </div>
              </div>

              {/* Anti-vandalism rollback test (Admin or beta testing) */}
              <div className="p-4 bg-slate-950 rounded-xl border border-purple-900/40">
                <h4 className="text-xs font-bold uppercase text-purple-400 mb-2 flex items-center gap-2">
                  <span>🛠️</span> Тест безпеки: Відкат дій вандала (Admin Tool)
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={rollbackUser}
                    onChange={(e) => setRollbackUser(e.target.value)}
                    placeholder="ID користувача для відкату (наприклад, ID123456)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleExecuteRollback}
                    disabled={isLoading || !rollbackUser.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-all whitespace-nowrap"
                  >
                    {isLoading ? 'Відкат...' : 'Відкотити зміни за 24г'}
                  </button>
                </div>
                {rollbackStatus && (
                  <div className="mt-2 text-xs font-mono p-2 bg-slate-900 rounded border border-slate-800">
                    {rollbackStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <span>🗺️</span> Чанкування 64x64 для 100,000,000 пікселів
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  Для полотна розміром 10,000 x 10,000 пікселів завантаження всієї бази одночасно призвело б до перевантаження пам'яті браузера. Замість цього SQL-схема розбиває полотно на чанки:
                </p>
                <div className="bg-slate-900 p-3 rounded-lg font-mono text-xs text-blue-300 border border-slate-800 space-y-1">
                  <div>chunk_x INT GENERATED ALWAYS AS (x / 64) STORED,</div>
                  <div>chunk_y INT GENERATED ALWAYS AS (y / 64) STORED,</div>
                  <div className="text-slate-400">CREATE INDEX idx_pixels_chunk ON pixels(chunk_x, chunk_y);</div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Клієнт запитує лише ті чанки, які потрапляють у поточний екран гравця при зумуванні та панорамуванні.
                </p>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <span>⚡</span> WebSocket-синхронізація в реальному часі
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-lg font-bold text-blue-400">100</div>
                    <div className="text-[11px] text-slate-400">Слоті гравців онлайн</div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-lg font-bold text-emerald-400">&lt; 30 мс</div>
                    <div className="text-[11px] text-slate-400">Затримка delta-broadcast</div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-lg font-bold text-purple-400">100M</div>
                    <div className="text-[11px] text-slate-400">Макс. місткість полотна</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">Гравців онлайн:</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {realtimeClient.onlineCount}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">Збережено пікселів:</div>
                  <div className="text-xl font-bold text-blue-400 mt-1">
                    {serverStats?.totalPixelsPlaced ?? '—'}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">Аудит-записів:</div>
                  <div className="text-xl font-bold text-purple-400 mt-1">
                    {serverStats?.auditLogsCount ?? '0'}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">Uptime сервера:</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {serverStats?.uptimeSeconds ? `${serverStats.uptimeSeconds}s` : 'Активний'}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Статус зв'язку WebSocket:</h4>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${realtimeClient.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                  <span className="text-xs text-slate-200 font-mono">
                    {realtimeClient.isConnected ? 'Підключено до ws://' + window.location.host : 'Підключення...'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Статус бази даних Supabase:</h4>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${isSupabaseConfigured() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                  <div className="text-xs">
                    {isSupabaseConfigured() ? (
                      <span className="text-emerald-400 font-mono">
                        Підключено: {SUPABASE_URL} (Таблиця pixels)
                      </span>
                    ) : (
                      <span className="text-amber-400 font-mono">
                        Очікує налаштування VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY у Project Settings
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            StinaPixel Beta 100 • Готово до підключення Cloud SQL / Postgres
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
          >
            Закрити
          </button>
        </div>

      </div>
    </div>
  );
};

export default SqlBetaModal;
