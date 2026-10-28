import React, { useState, useEffect, useMemo } from 'react';
import { User, PublishedArt, Message, FinanceLog, ActivityLog, DepositRequest, PromoCode } from '../types';
import { ADMIN_CREDENTIALS } from '../constants';

interface Props {
  user: User;
  onBack: () => void;
  onViewProfile: (id: string) => void;
  onBanUser: (id: string, status: boolean) => void;
}

interface NewsItem {
  id: string;
  text: string;
  link?: string;
  timestamp: number;
}

const AdminPanel: React.FC<Props> = ({ user, onBack, onViewProfile, onBanUser }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'requests' | 'promos' | 'users' | 'payments' | 'news' | 'chats' | 'activity' | 'sql'>('requests');
  const [users, setUsers] = useState<any[]>([]);
  const [searchId, setSearchId] = useState('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [financeLogs, setFinanceLogs] = useState<FinanceLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [gallery, setGallery] = useState<PublishedArt[]>([]);

  // Deposit Requests
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Promo Codes
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoReward, setNewPromoReward] = useState('');
  const [newPromoMaxUses, setNewPromoMaxUses] = useState('');
  const [promoFeedback, setPromoFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  
  const [giftId, setGiftId] = useState('');
  const [giftAmount, setGiftAmount] = useState('');
  
  const [newsText, setNewsText] = useState('');
  const [newsLink, setNewsLink] = useState('');

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPixels: 0,
    totalIncome: 0,
    onlineCount: 0
  });

  const [sqlSchemaText, setSqlSchemaText] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [rollbackId, setRollbackId] = useState('');
  const [rollbackStatus, setRollbackStatus] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [serverStats, setServerStats] = useState<any>(null);

  useEffect(() => {
    refreshData();
    fetch('/api/sql/schema').then(r => r.text()).then(t => setSqlSchemaText(t)).catch(() => {});
    fetch('/api/health').then(r => r.json()).then(s => setServerStats(s)).catch(() => {});
    const interval = setInterval(refreshData, 4000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    const allUsers = JSON.parse(localStorage.getItem('stnapixel_all_users') || '[]');
    const mus = JSON.parse(localStorage.getItem('stnapixel_museum_gallery') || '[]');
    const savedNews = JSON.parse(localStorage.getItem('stnapixel_news') || '[]');
    const messages = JSON.parse(localStorage.getItem('stnapixel_messages') || '[]');
    const logs = JSON.parse(localStorage.getItem('stnapixel_finance_logs') || '[]');
    const rawActivity: ActivityLog[] = JSON.parse(localStorage.getItem('stnapixel_activity_logs') || '[]');
    
    // Deduplicate any logs that might have identical IDs from past runs
    const seenLogIds = new Set<string>();
    const cleanActivity: ActivityLog[] = [];
    let hadDuplicateLogs = false;
    for (const logItem of rawActivity) {
      if (logItem && logItem.id) {
        if (!seenLogIds.has(logItem.id)) {
          seenLogIds.add(logItem.id);
          cleanActivity.push(logItem);
        } else {
          hadDuplicateLogs = true;
        }
      }
    }
    if (hadDuplicateLogs) {
      localStorage.setItem('stnapixel_activity_logs', JSON.stringify(cleanActivity));
    }

    const requests = JSON.parse(localStorage.getItem('stnapixel_deposit_requests') || '[]');
    const promos = JSON.parse(localStorage.getItem('stnapixel_promocodes') || '[]');
    
    setUsers(allUsers);
    setGallery(mus);
    setNews(savedNews);
    setAllMessages(messages);
    setFinanceLogs(logs);
    setActivityLogs(cleanActivity);
    setDepositRequests(requests);
    setPromoCodes(promos);
    
    setStats({
      totalUsers: allUsers.length,
      totalPixels: mus.reduce((s: number, a: PublishedArt) => s + (a.pixelCount || 0), 0),
      totalIncome: mus.reduce((s: number, a: PublishedArt) => s + (a.cost || 0), 0),
      onlineCount: Math.max(1, Math.floor(allUsers.length * 0.4)) 
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Скопійовано: ${text}`);
  };

  // Deposit Request Actions
  const handleApproveDeposit = (request: DepositRequest) => {
    if (!confirm(`Підтвердити заявку на ₴${request.amount} від ${request.username}?`)) return;

    const allUsers = JSON.parse(localStorage.getItem('stnapixel_all_users') || '[]');
    const uIdx = allUsers.findIndex((u: any) => u.id === request.userId);

    if (uIdx !== -1) {
      allUsers[uIdx].balance = (allUsers[uIdx].balance || 0) + request.amount;
      localStorage.setItem('stnapixel_all_users', JSON.stringify(allUsers));

      // If approved user is the current session
      const currentUser = JSON.parse(localStorage.getItem('stnapixel_user') || '{}');
      if (currentUser.id === request.userId) {
        currentUser.balance = allUsers[uIdx].balance;
        localStorage.setItem('stnapixel_user', JSON.stringify(currentUser));
      }
    }

    // Update request status
    const allReqs = JSON.parse(localStorage.getItem('stnapixel_deposit_requests') || '[]');
    const reqIdx = allReqs.findIndex((r: any) => r.id === request.id);
    if (reqIdx !== -1) {
      allReqs[reqIdx] = {
        ...allReqs[reqIdx],
        status: 'approved',
        reviewedAt: Date.now(),
        reviewedBy: user.id
      };
      localStorage.setItem('stnapixel_deposit_requests', JSON.stringify(allReqs));
    }

    // Log Finance Record
    const newLog: FinanceLog = {
      id: `FIN_DEP_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      adminId: user.id,
      targetId: request.userId,
      amount: request.amount,
      timestamp: Date.now()
    };
    const logs = JSON.parse(localStorage.getItem('stnapixel_finance_logs') || '[]');
    localStorage.setItem('stnapixel_finance_logs', JSON.stringify([newLog, ...logs]));

    refreshData();
    alert(`✅ Заявку підтверджено! ₴${request.amount} успішно нараховано користувачу ${request.username}.`);
  };

  const handleRejectDeposit = (request: DepositRequest) => {
    if (!confirm(`Відхилити заявку на ₴${request.amount} від ${request.username}?`)) return;

    const allReqs = JSON.parse(localStorage.getItem('stnapixel_deposit_requests') || '[]');
    const reqIdx = allReqs.findIndex((r: any) => r.id === request.id);
    if (reqIdx !== -1) {
      allReqs[reqIdx] = {
        ...allReqs[reqIdx],
        status: 'rejected',
        reviewedAt: Date.now(),
        reviewedBy: user.id
      };
      localStorage.setItem('stnapixel_deposit_requests', JSON.stringify(allReqs));
    }

    refreshData();
    alert(`❌ Заявку відхилено.`);
  };

  const handleDeleteDeposit = (requestId: string) => {
    if (!confirm('Видалити цю заявку зі списку?')) return;
    const allReqs = JSON.parse(localStorage.getItem('stnapixel_deposit_requests') || '[]');
    const updated = allReqs.filter((r: any) => r.id !== requestId);
    localStorage.setItem('stnapixel_deposit_requests', JSON.stringify(updated));
    refreshData();
  };

  // Promo Code Actions
  const handleCreatePromoCode = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoFeedback(null);
    const code = newPromoCode.trim().toUpperCase();
    const reward = parseFloat(newPromoReward);
    const maxUses = parseInt(newPromoMaxUses, 10);

    if (!code || code.length < 2) {
      setPromoFeedback({ text: 'Назва промокоду має містити щонайменше 2 символи.', isError: true });
      return;
    }
    if (isNaN(reward) || reward <= 0) {
      setPromoFeedback({ text: 'Вкажіть коректну суму винагороди в ₴.', isError: true });
      return;
    }
    if (isNaN(maxUses) || maxUses <= 0) {
      setPromoFeedback({ text: 'Вкажіть кількість активацій (мінімум 1).', isError: true });
      return;
    }

    const savedPromos = JSON.parse(localStorage.getItem('stnapixel_promocodes') || '[]');
    if (savedPromos.some((p: any) => p.code.toUpperCase() === code)) {
      setPromoFeedback({ text: 'Промокод з такою назвою вже існує!', isError: true });
      return;
    }

    const newPromo: PromoCode = {
      id: `PROMO_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      code,
      reward,
      maxUses,
      usedCount: 0,
      usedBy: [],
      createdAt: Date.now(),
      isActive: true
    };

    const updated = [newPromo, ...savedPromos];
    localStorage.setItem('stnapixel_promocodes', JSON.stringify(updated));
    setPromoCodes(updated);

    setNewPromoCode('');
    setNewPromoReward('');
    setNewPromoMaxUses('');
    setPromoFeedback({ text: `🎉 Промокод "${code}" на ${reward} ₴ (${maxUses} акт.) успішно створено!`, isError: false });
    setTimeout(() => setPromoFeedback(null), 5000);
  };

  const handleDeletePromo = (id: string) => {
    if (!confirm('Видалити цей промокод?')) return;
    const saved = JSON.parse(localStorage.getItem('stnapixel_promocodes') || '[]');
    const updated = saved.filter((p: any) => p.id !== id);
    localStorage.setItem('stnapixel_promocodes', JSON.stringify(updated));
    setPromoCodes(updated);
  };

  const handleTogglePromoStatus = (id: string) => {
    const saved = JSON.parse(localStorage.getItem('stnapixel_promocodes') || '[]');
    const updated = saved.map((p: any) => {
      if (p.id === id) return { ...p, isActive: !p.isActive };
      return p;
    });
    localStorage.setItem('stnapixel_promocodes', JSON.stringify(updated));
    setPromoCodes(updated);
  };

  const handleGiftBalance = () => {
    const amount = parseFloat(giftAmount);
    const targetId = giftId.trim();
    if (!targetId || isNaN(amount)) return alert("Будь ласка, введіть коректний ID та суму.");
    
    const allUsers = JSON.parse(localStorage.getItem('stnapixel_all_users') || '[]');
    const idx = allUsers.findIndex((u: any) => 
      u.id.toLowerCase() === targetId.toLowerCase() || 
      u.email.toLowerCase() === targetId.toLowerCase()
    );
    
    if (idx === -1) return alert("Користувача не знайдено. Перевірте ID або Email.");
    
    allUsers[idx].balance += amount;
    localStorage.setItem('stnapixel_all_users', JSON.stringify(allUsers));
    
    const currentUser = JSON.parse(localStorage.getItem('stnapixel_user') || '{}');
    if (currentUser.id === allUsers[idx].id) {
      currentUser.balance = allUsers[idx].balance;
      localStorage.setItem('stnapixel_user', JSON.stringify(currentUser));
    }
    
    const newLog: FinanceLog = {
      id: `FIN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      adminId: user.id,
      targetId: allUsers[idx].id,
      amount,
      timestamp: Date.now()
    };
    const logs = JSON.parse(localStorage.getItem('stnapixel_finance_logs') || '[]');
    localStorage.setItem('stnapixel_finance_logs', JSON.stringify([newLog, ...logs]));

    refreshData();
    alert(`Користувачу ${allUsers[idx].username} встановлено новий баланс. Зміни збережено.`);
    setGiftId(''); setGiftAmount('');
  };

  const handlePublishNews = () => {
    if (!newsText.trim()) return;
    const item: NewsItem = {
      id: `NEWS_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      text: newsText,
      link: newsLink,
      timestamp: Date.now()
    };
    const saved = JSON.parse(localStorage.getItem('stnapixel_news') || '[]');
    localStorage.setItem('stnapixel_news', JSON.stringify([item, ...saved]));
    setNewsText(''); setNewsLink('');
    refreshData();
    alert("Опубліковано!");
  };

  const handleToggleBan = (targetId: string, currentStatus: boolean) => {
    if (targetId === ADMIN_CREDENTIALS.id) return alert("Неможливо забанити адміна.");
    if (confirm(`Змінити статус бана для ${targetId}?`)) {
      onBanUser(targetId, !currentStatus);
      refreshData();
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([sqlSchemaText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdminRollback = async () => {
    if (!rollbackId.trim()) return;
    setIsRollingBack(true);
    setRollbackStatus(null);
    try {
      const res = await fetch('/api/admin/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          targetUserId: rollbackId.trim(),
          sinceHours: 24
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRollbackStatus(`✅ ${data.message || 'Зміни успішно відкочено'}`);
        onBanUser(rollbackId.trim(), true);
        setRollbackId('');
        refreshData();
      } else {
        setRollbackStatus(`❌ Помилка: ${data.error || 'Помилка відкату'}`);
      }
    } catch (e: any) {
      setRollbackStatus(`❌ Помилка з'єднання: ${e.message}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  const activityStats = useMemo(() => {
    const auth = activityLogs.filter(l => l.isAuth).length;
    const guest = activityLogs.filter(l => !l.isAuth).length;
    const hourly = activityLogs.reduce((acc: any, log) => {
      const hour = new Date(log.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});
    const maxHour = Object.keys(hourly).length > 0 ? Math.max(...Object.values(hourly) as number[]) : 0;
    
    return { auth, guest, maxHour, total: activityLogs.length };
  }, [activityLogs]);

  const filteredUsers = users.filter(u => 
    u.id.toLowerCase().includes(searchId.toLowerCase()) || 
    u.email.toLowerCase().includes(searchId.toLowerCase()) ||
    u.username.toLowerCase().includes(searchId.toLowerCase())
  );

  const pendingRequestsCount = depositRequests.filter(r => r.status === 'pending').length;

  const filteredDepositRequests = depositRequests.filter(r => {
    if (requestFilter === 'all') return true;
    return r.status === requestFilter;
  });

  return (
    <div className="flex-1 bg-slate-950 p-3 sm:p-6 md:p-8 overflow-y-auto relative text-white custom-scrollbar">
      <button onClick={onBack} className="absolute top-3 right-3 sm:top-6 sm:right-6 md:top-8 md:right-8 text-slate-400 hover:text-white transition-all bg-slate-900/80 p-2 sm:p-2.5 rounded-xl border border-slate-700/80 z-50">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      <div className="max-w-7xl mx-auto pt-6 sm:pt-2">
        <div className="flex items-center space-x-3 sm:space-x-5 mb-5 sm:mb-8 md:mb-10">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-2xl font-bold shadow-lg">A</div>
          <div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white uppercase tracking-tight">Admin<span className="text-purple-400">.Panel</span></h1>
            <p className="text-xs text-slate-400 font-medium">Керування стіною, фінансами, заявками та промокодами</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6 mb-5 sm:mb-8">
          <StatCard title="Гравців" value={stats.totalUsers.toString()} color="text-blue-400" />
          <StatCard title="Всього PX" value={stats.totalPixels.toLocaleString()} color="text-emerald-400" />
          <StatCard title="Оборот" value={`₴${stats.totalIncome.toFixed(2)}`} color="text-amber-400" />
          <StatCard title="Заявки очікують" value={pendingRequestsCount.toString()} color={pendingRequestsCount > 0 ? "text-amber-400 font-black animate-pulse" : "text-purple-400"} />
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1.5 sm:gap-2 mb-4 sm:mb-6 bg-slate-900/70 p-1 sm:p-1.5 rounded-2xl border border-slate-800 w-full md:w-fit">
          <TabButton 
            active={activeTab === 'requests'} 
            onClick={() => setActiveTab('requests')} 
            label="Заявки на поповнення" 
            badge={pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
          <TabButton 
            active={activeTab === 'promos'} 
            onClick={() => setActiveTab('promos')} 
            label="Промокоди" 
          />
          <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} label="Загальне" />
          <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} label="Активність" />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} label="Користувачі" />
          <TabButton active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} label="Лог чатів" />
          <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} label="Фінанси" />
          <TabButton active={activeTab === 'news'} onClick={() => setActiveTab('news')} label="Новини" />
          <TabButton active={activeTab === 'sql'} onClick={() => setActiveTab('sql')} label="SQL & База (100 гравців)" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-8 shadow-xl min-h-[350px]">
          
          {/* DEPOSIT REQUESTS TAB */}
          {activeTab === 'requests' && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
                    <span>Заявки на поповнення балансу</span>
                    {pendingRequestsCount > 0 && (
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        {pendingRequestsCount} очікують
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">Перевіряйте надходження в Monobank та підтверджуйте або відхиляйте заявки</p>
                </div>

                {/* Filter buttons */}
                <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button 
                    onClick={() => setRequestFilter('all')} 
                    className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all ${requestFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Всі ({depositRequests.length})
                  </button>
                  <button 
                    onClick={() => setRequestFilter('pending')} 
                    className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all ${requestFilter === 'pending' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    Очікують ({pendingRequestsCount})
                  </button>
                  <button 
                    onClick={() => setRequestFilter('approved')} 
                    className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all ${requestFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Підтверджені ({depositRequests.filter(r => r.status === 'approved').length})
                  </button>
                  <button 
                    onClick={() => setRequestFilter('rejected')} 
                    className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-all ${requestFilter === 'rejected' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Відхилені ({depositRequests.filter(r => r.status === 'rejected').length})
                  </button>
                </div>
              </div>

              {filteredDepositRequests.length === 0 ? (
                <div className="py-20 text-center opacity-40 font-bold uppercase tracking-wider text-sm italic">
                  Заявок у цій категорії немає
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDepositRequests.map((req, idx) => (
                    <div 
                      key={`${req.id}-${idx}`} 
                      className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        req.status === 'pending' 
                          ? 'bg-slate-950/90 border-amber-500/40 shadow-lg shadow-amber-950/20' 
                          : req.status === 'approved'
                          ? 'bg-slate-950/50 border-emerald-500/20 opacity-90'
                          : 'bg-slate-950/40 border-red-500/20 opacity-70'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button 
                            onClick={() => onViewProfile(req.userId)}
                            className="font-bold text-white hover:text-blue-400 transition-colors text-base flex items-center space-x-1.5"
                          >
                            <span>{req.username}</span>
                            <span className="font-mono text-xs text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {req.userId}
                            </span>
                          </button>
                          
                          <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                            ₴{req.amount.toFixed(2)}
                          </span>

                          {req.status === 'pending' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                              ⏳ Очікує розгляду
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                              ✅ Підтверджено (+₴{req.amount})
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider">
                              ❌ Відхилено
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                          <span>📅 {new Date(req.timestamp).toLocaleString()}</span>
                          <span className="font-mono text-slate-500">ID: {req.id}</span>
                          {req.reviewedAt && (
                            <span className="text-slate-500">
                              (Оброблено: {new Date(req.reviewedAt).toLocaleTimeString()})
                            </span>
                          )}
                        </div>

                        {req.note && (
                          <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 font-medium">
                            <span className="text-slate-500 mr-1.5">Коментар:</span>
                            {req.note}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                        {req.status === 'pending' ? (
                          <>
                            <button 
                              onClick={() => handleApproveDeposit(req)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center space-x-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              <span>Підтвердити</span>
                            </button>
                            <button 
                              onClick={() => handleRejectDeposit(req)}
                              className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all active:scale-95 flex items-center space-x-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              <span>Відхилити</span>
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleDeleteDeposit(req.id)}
                            className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Видалити запис"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROMO CODES TAB */}
          {activeTab === 'promos' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Create Promo Code Card */}
              <div className="bg-slate-950 p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🎟️</span>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight">Створити новий промокод</h3>
                    <p className="text-xs text-slate-400">Вкажіть назву коду, суму винагороди в гривнях та максимальну кількість активацій</p>
                  </div>
                </div>

                <form onSubmit={handleCreatePromoCode} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Назва коду</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Наприклад: STINA50"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-purple-600 text-white placeholder:text-slate-600"
                        value={newPromoCode}
                        onChange={e => setNewPromoCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Сума винагороди (₴)</label>
                      <input 
                        type="number" 
                        required 
                        min="1" 
                        step="1"
                        placeholder="Сума, напр. 50"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 text-white placeholder:text-slate-600"
                        value={newPromoReward}
                        onChange={e => setNewPromoReward(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Кількість активацій</label>
                      <input 
                        type="number" 
                        required 
                        min="1" 
                        step="1"
                        placeholder="Ліміт, напр. 25"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-600 text-white placeholder:text-slate-600"
                        value={newPromoMaxUses}
                        onChange={e => setNewPromoMaxUses(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    <button 
                      type="submit" 
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-3 rounded-xl uppercase tracking-wider text-xs transition-all active:scale-95 shadow-lg shadow-purple-900/30 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      <span>Створити промокод</span>
                    </button>

                    {promoFeedback && (
                      <span className={`text-xs font-semibold ${promoFeedback.isError ? 'text-red-400' : 'text-emerald-400'}`}>
                        {promoFeedback.text}
                      </span>
                    )}
                  </div>
                </form>
              </div>

              {/* Promo Codes List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                  <span>Список створених промокодів</span>
                  <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{promoCodes.length}</span>
                </h4>

                {promoCodes.length === 0 ? (
                  <div className="p-8 bg-slate-950/40 rounded-2xl border border-slate-800 text-center text-xs text-slate-500 italic">
                    Промокодів поки що немає. Створіть перший промокод за допомогою форми вище.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {promoCodes.map((promo, idx) => {
                      const percent = Math.min(100, Math.round(((promo.usedCount || 0) / promo.maxUses) * 100));
                      const isExpired = (promo.usedCount || 0) >= promo.maxUses || promo.isActive === false;

                      return (
                        <div key={`${promo.id}-${idx}`} className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3 shadow-md">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-base font-black text-purple-400 bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-800/40 tracking-wider">
                                  {promo.code}
                                </span>
                                <button 
                                  onClick={() => copyToClipboard(promo.code)}
                                  className="text-slate-500 hover:text-white p-1 rounded" 
                                  title="Копіювати код"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 block">
                                Створено: {new Date(promo.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-lg font-black text-emerald-400 block leading-tight">
                                +{promo.reward} ₴
                              </span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-1 ${isExpired ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {isExpired ? 'Вичерпаний' : 'Активний'}
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                              <span>Активації</span>
                              <span>{promo.usedCount || 0} / {promo.maxUses} ({percent}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className={`h-full transition-all ${isExpired ? 'bg-slate-700' : 'bg-purple-600'}`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-xs">
                            <button 
                              onClick={() => handleTogglePromoStatus(promo.id)}
                              className={`text-[11px] font-semibold transition-colors ${promo.isActive ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                            >
                              {promo.isActive ? 'Деактивувати' : 'Активувати'}
                            </button>

                            <button 
                              onClick={() => handleDeletePromo(promo.id)}
                              className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                              title="Видалити промокод"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-12 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="bg-slate-950 p-10 rounded-[3rem] border border-slate-800">
                     <h3 className="text-xl font-black uppercase mb-6 text-blue-500 italic">Розподіл платформ</h3>
                     <div className="space-y-6">
                        <div className="space-y-2">
                           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <span>Авторизовані</span>
                              <span>{((activityStats.auth / (activityStats.total || 1)) * 100).toFixed(0)}%</span>
                           </div>
                           <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600" style={{ width: `${(activityStats.auth / (activityStats.total || 1)) * 100}%` }}></div>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <span>Гості</span>
                              <span>{((activityStats.guest / (activityStats.total || 1)) * 100).toFixed(0)}%</span>
                           </div>
                           <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-600" style={{ width: `${(activityStats.guest / (activityStats.total || 1)) * 100}%` }}></div>
                           </div>
                        </div>
                     </div>
                  </div>
                  <div className="bg-slate-950 p-10 rounded-[3rem] border border-slate-800">
                     <h3 className="text-xl font-black uppercase mb-6 text-green-500 italic">Економіка проекту</h3>
                     <div className="flex items-center justify-between p-6 bg-slate-900 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 font-bold">Середній чек</span>
                        <span className="text-2xl font-black text-white">₴{(stats.totalIncome / (gallery.length || 1)).toFixed(2)}</span>
                     </div>
                     <div className="mt-4 flex items-center justify-between p-6 bg-slate-900 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 font-bold">Активних артів</span>
                        <span className="text-2xl font-black text-white">{stats.totalPixels > 0 ? (stats.totalPixels / 100).toFixed(0) : 0}</span>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-10">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-4">Всього візитів</span>
                    <span className="text-4xl font-black text-white">{activityStats.total}</span>
                  </div>
                  <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-4">Авторизовані / Гості</span>
                    <span className="text-4xl font-black text-blue-500">{activityStats.auth} <span className="text-slate-700">/</span> {activityStats.guest}</span>
                  </div>
                  <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-4">Пік активності (віз/год)</span>
                    <span className="text-4xl font-black text-yellow-500">{activityStats.maxHour}</span>
                  </div>
               </div>

               <div className="bg-black/30 rounded-[3rem] border border-slate-800 overflow-hidden">
                  <div className="p-8 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                    <h4 className="font-black text-sm uppercase tracking-widest">Останні сесії</h4>
                    <span className="text-[10px] font-mono opacity-40">REAL-TIME FEED</span>
                  </div>
                  <div className="divide-y divide-slate-800/40 max-h-[400px] overflow-y-auto custom-scrollbar">
                     {activityLogs.slice(0, 50).map((l, index) => (
                       <div key={`${l.id || 'log'}-${index}`} className="p-6 flex items-center justify-between hover:bg-slate-900/20 transition-colors">
                          <div className="flex items-center space-x-4">
                             <div className={`w-3 h-3 rounded-full ${l.isAuth ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                             <div>
                               <p className="font-black text-sm text-white">{l.username || (l.isAuth ? 'Авторизований' : 'Гість')}</p>
                               <p className="text-[10px] text-slate-500 font-mono">{l.userId || 'GUEST_SESSION'}</p>
                             </div>
                          </div>
                          <span className="text-xs font-mono text-slate-600 font-bold">{new Date(l.timestamp).toLocaleTimeString()}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Пошук за ID, Email або нікнеймом..." 
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                    <tr>
                      <th className="p-4 rounded-l-xl">Користувач</th>
                      <th className="p-4">ID</th>
                      <th className="p-4">Баланс</th>
                      <th className="p-4">Реєстрація</th>
                      <th className="p-4">Реферал</th>
                      <th className="p-4 rounded-r-xl text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredUsers.map((u, idx) => (
                      <tr key={`${u.id}-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-bold text-white flex items-center space-x-2">
                          <span className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-xs font-black text-blue-400">
                            {u.username[0]?.toUpperCase() || 'U'}
                          </span>
                          <div>
                            <div>{u.username}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{u.email}</div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-slate-400 text-[11px]">{u.id}</td>
                        <td className="p-4 font-bold text-emerald-400">₴{(u.balance || 0).toFixed(2)}</td>
                        <td className="p-4 text-slate-500 text-[11px]">{new Date(u.registrationDate).toLocaleDateString()}</td>
                        <td className="p-4 text-slate-400 text-[11px]">
                          {u.referredBy ? (
                            <span className="font-mono text-blue-400 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/30">
                              {u.referredBy}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button 
                            onClick={() => onViewProfile(u.id)}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all"
                          >
                            Профіль
                          </button>
                          {u.id !== ADMIN_CREDENTIALS.id && (
                            <button 
                              onClick={() => handleToggleBan(u.id, !!u.isBanned)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${u.isBanned ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-600/20 text-red-400 border border-red-500/30'}`}
                            >
                              {u.isBanned ? 'Розбанити' : 'Бан'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">Лог останніх повідомлень</h3>
              <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto custom-scrollbar">
                {allMessages.length === 0 ? (
                  <div className="py-20 text-center opacity-30 font-bold uppercase text-xs">Повідомлень немає</div>
                ) : (
                  allMessages.slice(-50).reverse().map((m, idx) => (
                    <div key={`${m.id}-${idx}`} className="p-4 flex flex-col space-y-1 hover:bg-slate-800/20 transition-colors">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-mono">Від: <strong className="text-white">{m.fromId}</strong> ➔ Кому: <strong className="text-white">{m.toId}</strong></span>
                        <span>{new Date(m.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-200 font-medium">{m.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Manual Balance Gift */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-w-xl space-y-4">
                <h3 className="text-sm font-bold uppercase text-white tracking-wider flex items-center space-x-2">
                  <span>Ручне нарахування балансу</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="ID або Email користувача" 
                    className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600 text-white"
                    value={giftId}
                    onChange={e => setGiftId(e.target.value)}
                  />
                  <input 
                    type="number" 
                    placeholder="Сума в ₴" 
                    className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600 text-white"
                    value={giftAmount}
                    onChange={e => setGiftAmount(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleGiftBalance}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                >
                  Нарахувати кошти
                </button>
              </div>

              {/* Finance Logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Історія транзакцій</h4>
                <div className="divide-y divide-slate-800/60 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {financeLogs.length === 0 ? (
                    <div className="py-12 text-center opacity-30 text-xs font-bold uppercase">Транзакцій поки немає</div>
                  ) : (
                    financeLogs.map((log, idx) => (
                      <div key={`${log.id}-${idx}`} className="p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono text-slate-500 mr-2">{log.id}</span>
                          <span className="font-bold text-white">Для: {log.targetId}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="font-bold text-emerald-400">+₴{log.amount}</span>
                          <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'news' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold uppercase text-white tracking-wider">Опублікувати новину або оголошення</h3>
                <textarea 
                  placeholder="Текст новини..." 
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs font-medium outline-none focus:ring-2 focus:ring-purple-600 min-h-[100px] text-white"
                  value={newsText}
                  onChange={e => setNewsText(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="Посилання (необов'язково)" 
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs font-medium outline-none focus:ring-2 focus:ring-purple-600 text-white"
                  value={newsLink}
                  onChange={e => setNewsLink(e.target.value)}
                />
                <button 
                  onClick={handlePublishNews}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                >
                  Опублікувати
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Опубліковані новини</h4>
                <div className="space-y-2">
                  {news.map((n, idx) => (
                    <div key={`${n.id}-${idx}`} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{new Date(n.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-200 font-medium">{n.text}</p>
                      {n.link && <a href={n.link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-[11px] block">{n.link}</a>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SQL & DATABASE ARCHITECTURE TAB */}
          {activeTab === 'sql' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
                    <span>Безпечне полотно для 100 гравців (PostgreSQL)</span>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Готово до деплою
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Атомарні SQL-процедури, чанкування 64x64, захист VIP-пікселів та миттєвий відкат вандалізму
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySql}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <span>{copiedSql ? '✓' : '📋'}</span>
                    <span>{copiedSql ? 'Скопійовано' : 'Копіювати SQL'}</span>
                  </button>
                  <button
                    onClick={handleDownloadSql}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all border border-slate-700 active:scale-95"
                  >
                    <span>⬇️</span>
                    <span>schema.sql</span>
                  </button>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Режим бета</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">100 Гравців Live</div>
                </div>
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Пікселів у пам'яті/БД</div>
                  <div className="text-base font-bold text-blue-400 mt-1">{serverStats?.totalPixelsPlaced ?? '—'}</div>
                </div>
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Аудит-записів дій</div>
                  <div className="text-base font-bold text-purple-400 mt-1">{serverStats?.auditLogsCount ?? '0'}</div>
                </div>
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Чанкування полотна</div>
                  <div className="text-base font-bold text-amber-400 mt-1">64 x 64 px</div>
                </div>
              </div>

              {/* Anti-vandalism Rollback Tool */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-purple-900/40 space-y-3">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                  <span>🛡️</span> Інструмент відкату вандалізму (Anti-Griefing Rollback)
                </h4>
                <p className="text-xs text-slate-400">
                  Якщо гравець масово замальовує арт або запускає бота, введіть його ID для миттєвого відновлення попередніх кольорів з таблиці <code className="text-purple-300 font-mono">pixel_audit_log</code> та блокування акаунта.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                  <input
                    type="text"
                    value={rollbackId}
                    onChange={(e) => setRollbackId(e.target.value)}
                    placeholder="ID користувача (напр. ID123456)"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-600 font-mono"
                  />
                  <button
                    onClick={handleAdminRollback}
                    disabled={isRollingBack || !rollbackId.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-all whitespace-nowrap active:scale-95 shadow-md"
                  >
                    {isRollingBack ? 'Відкат...' : 'Відкотити зміни & Забанити'}
                  </button>
                </div>
                {rollbackStatus && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono">
                    {rollbackStatus}
                  </div>
                )}
              </div>

              {/* SQL Code View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-slate-300">/database/schema.sql (PostgreSQL 14+)</span>
                  <span className="text-[11px] text-slate-500">Включає функції, індекси, RLS та тригери</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[350px] overflow-y-auto custom-scrollbar">
                  <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
                    {sqlSchemaText || '-- Завантаження SQL схеми...'}
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color }: { title: string, value: string, color: string }) => (
  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl text-center md:text-left">
    <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-2 block">{title}</span>
    <div className={`text-2xl md:text-3xl font-bold tracking-tight ${color}`}>{value}</div>
  </div>
);

const TabButton = ({ active, onClick, label, badge }: { active: boolean, onClick: () => void, label: string, badge?: number | string }) => (
  <button 
    onClick={onClick} 
    className={`px-3.5 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center space-x-1.5 ${
      active 
        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' 
        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
    }`}
  >
    <span>{label}</span>
    {badge !== undefined && (
      <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
        {badge}
      </span>
    )}
  </button>
);

export default AdminPanel;
