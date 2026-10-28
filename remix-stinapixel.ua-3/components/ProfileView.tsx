
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, PublishedArt, Message, DepositRequest, PromoCode } from '../types';
import { MONOBANK_JAR_URL, TELEGRAM_SUPPORT_URL, TELEGRAM_SUPPORT_HANDLE } from '../constants';

interface Props {
  user: User;
  targetUserId: string | null;
  onBack: () => void;
  updateBalance: (amount: number) => void;
  updateUser: (data: Partial<User>) => void;
  onLogout: () => void;
  onViewProfile: (id: string) => void;
  onStartChat: (id: string) => void;
  onGoToLocation: (x: number, y: number) => void;
  initialChatTargetId?: string | null;
}

interface NewsItem {
  id: string;
  text: string;
  link?: string;
  timestamp: number;
}

const ProfileView: React.FC<Props> = ({ 
  user, targetUserId, onBack, updateBalance, updateUser, onLogout, onViewProfile, onStartChat, onGoToLocation, initialChatTargetId 
}) => {
  const isGuest = user.id === 'GUEST';
  const isOwnProfile = !targetUserId || targetUserId === user.id;
  
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'wallet' | 'referrals' | 'history' | 'chats' | 'news' | 'admin_msgs'>(isOwnProfile && !isGuest ? 'info' : 'history');
  const [profileData, setProfileData] = useState<User | null>(null);
  const [history, setHistory] = useState<PublishedArt[]>([]);
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  
  const [tempUsername, setTempUsername] = useState('');
  const [tempBio, setTempBio] = useState('');
  const [tempTelegram, setTempTelegram] = useState('');
  const [tempInstagram, setTempInstagram] = useState('');
  const [tempTwitch, setTempTwitch] = useState('');
  
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [depositNote, setDepositNote] = useState<string>('');
  const [depositStatusMsg, setDepositStatusMsg] = useState<string | null>(null);
  const [userDepositRequests, setUserDepositRequests] = useState<DepositRequest[]>([]);
  
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [promoStatus, setPromoStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedRefLink, setCopiedRefLink] = useState(false);
  const [copiedRefCode, setCopiedRefCode] = useState(false);
  const [referredUsersList, setReferredUsersList] = useState<any[]>([]);

  const [chats, setChats] = useState<{ userId: string, lastMessage: string, username: string, unreadCount: number }[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [searchUserId, setSearchUserId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isTargetAdmin = profileData?.isAdmin;
  const isPrivacyProtected = isTargetAdmin && !isOwnProfile && !user.isAdmin;
  const canSeeChats = (isOwnProfile || user.isAdmin) && !isGuest;

  useEffect(() => {
    refreshContent();
  }, [targetUserId, user, isOwnProfile]);

  useEffect(() => {
    if (canSeeChats && initialChatTargetId) {
      setActiveSubTab('chats');
      loadMessages(initialChatTargetId);
    }
  }, [initialChatTargetId, canSeeChats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const refreshContent = () => {
    let currentP: User | null = null;
    const allUsersRaw = localStorage.getItem('stnapixel_all_users');
    const allUsers = allUsersRaw ? JSON.parse(allUsersRaw) : [];
    if (isOwnProfile && !isGuest) {
      currentP = user;
    } else {
      currentP = allUsers.find((u: any) => u.id === targetUserId) || (isGuest && isOwnProfile ? user : null);
    }

    if (currentP) {
      setProfileData(currentP);
      setTempUsername(currentP.username);
      setTempBio(currentP.bio || '');
      setTempTelegram(currentP.telegram || '');
      setTempInstagram(currentP.instagram || '');
      setTempTwitch(currentP.twitch || '');
    }
    
    const idToFetch = targetUserId || user.id;
    const savedH = localStorage.getItem(`stnapixel_user_history_${idToFetch}`);
    if (savedH) setHistory(JSON.parse(savedH));

    const savedNewsRaw = localStorage.getItem('stnapixel_news');
    const savedNews = savedNewsRaw ? JSON.parse(savedNewsRaw) : [];
    setAllNews(savedNews);
    
    // Load deposit requests
    const allReqsRaw = localStorage.getItem('stnapixel_deposit_requests');
    const allReqs: DepositRequest[] = allReqsRaw ? JSON.parse(allReqsRaw) : [];
    setUserDepositRequests(allReqs.filter(r => r.userId === (idToFetch)));

    // Load referred users
    const referredList = allUsers.filter((u: any) => u.referredBy === idToFetch);
    setReferredUsersList(referredList);

    if (canSeeChats) loadChats();
  };

  const copyId = () => {
    const idToCopy = profileData?.id || user.id;
    navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRefLink = () => {
    const link = `${window.location.origin}/?ref=${user.id}`;
    navigator.clipboard.writeText(link);
    setCopiedRefLink(true);
    setTimeout(() => setCopiedRefLink(false), 2500);
  };

  const copyRefCode = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedRefCode(true);
    setTimeout(() => setCopiedRefCode(false), 2500);
  };

  const loadChats = () => {
    if (isGuest) return;
    const allMessagesRaw = localStorage.getItem('stnapixel_messages');
    const allMessages: Message[] = allMessagesRaw ? JSON.parse(allMessagesRaw) : [];
    const monitoredId = (activeSubTab === 'admin_msgs' && profileData) ? profileData.id : user.id;
    const relevantMessages = allMessages.filter(m => m.fromId === monitoredId || m.toId === monitoredId);
    const uniqueUserIds = Array.from(new Set(relevantMessages.map(m => m.fromId === monitoredId ? m.toId : m.fromId)));
    const allUsersRaw = localStorage.getItem('stnapixel_all_users');
    const allUsers = allUsersRaw ? JSON.parse(allUsersRaw) : [];
    
    const chatList = uniqueUserIds.map(uid => {
      const contact = allUsers.find((u: any) => u.id === uid);
      const userMsgs = relevantMessages.filter(m => m.fromId === uid || m.toId === uid);
      const last = userMsgs[userMsgs.length - 1];
      const unreadCount = userMsgs.filter(m => m.toId === monitoredId && !m.isRead).length;
      return { 
        userId: uid, 
        username: contact?.username || uid, 
        lastMessage: last?.text || '',
        unreadCount
      };
    });
    setChats(chatList);
  };

  const loadMessages = (contactId: string) => {
    if (isGuest) return;
    const allMessagesRaw = localStorage.getItem('stnapixel_messages');
    const allMessages: Message[] = allMessagesRaw ? JSON.parse(allMessagesRaw) : [];
    const monitoredId = (activeSubTab === 'admin_msgs' && profileData) ? profileData.id : user.id;
    
    if (monitoredId === user.id) {
       const updatedMessages = allMessages.map(m => {
         if (m.fromId === contactId && m.toId === user.id) return { ...m, isRead: true };
         return m;
       });
       localStorage.setItem('stnapixel_messages', JSON.stringify(updatedMessages));
    }

    const filtered = allMessages.filter(m => 
      (m.fromId === monitoredId && m.toId === contactId) || (m.fromId === contactId && m.toId === monitoredId)
    ).sort((a,b) => a.timestamp - b.timestamp);
    
    setChatMessages(filtered);
    setSelectedChatId(contactId);
    loadChats();
  };

  const sendMessage = () => {
    if (!selectedChatId || !newMessageText.trim() || isGuest) return;
    const senderId = (activeSubTab === 'admin_msgs' && profileData) ? profileData.id : user.id;
    const msg: Message = { 
      id: `MSG_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, 
      fromId: senderId, 
      toId: selectedChatId, 
      text: newMessageText, 
      timestamp: Date.now(), 
      isRead: false 
    };
    const allRaw = localStorage.getItem('stnapixel_messages');
    const all = allRaw ? JSON.parse(allRaw) : [];
    localStorage.setItem('stnapixel_messages', JSON.stringify([...all, msg]));
    setNewMessageText('');
    loadMessages(selectedChatId);
  };

  const handleStartChatById = () => {
    if (!searchUserId.trim() || isGuest) return;
    const allUsersRaw = localStorage.getItem('stnapixel_all_users');
    const allUsers = allUsersRaw ? JSON.parse(allUsersRaw) : [];
    const found = allUsers.find((u: any) => u.id.trim().toLowerCase() === searchUserId.trim().toLowerCase());
    if (!found) return alert("Користувача не знайдено.");
    loadMessages(found.id);
    setSearchUserId('');
  };

  const handleSaveProfile = () => {
    if (!tempUsername.trim() || isGuest) return alert("Помилка.");
    const newData = {
      username: tempUsername,
      bio: tempBio,
      telegram: tempTelegram,
      instagram: tempInstagram,
      twitch: tempTwitch
    };
    updateUser(newData);
    setIsEditing(false);
    alert("Профіль оновлено!");
  };

  const handleTopUp = () => {
    if (isGuest) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 10) return alert("Мінімальна сума поповнення — 10 ГРН.");
    window.open(`${MONOBANK_JAR_URL}?a=${amount}&t=${encodeURIComponent(user.id)}`, '_blank');
  };

  const handleSubmitDepositRequest = () => {
    if (isGuest) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 10) {
      alert("Мінімальна сума поповнення — 10 ГРН.");
      return;
    }
    const newRequest: DepositRequest = {
      id: `DEP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId: user.id,
      username: user.username,
      amount,
      timestamp: Date.now(),
      status: 'pending',
      note: depositNote.trim() || undefined
    };
    const allReqsRaw = localStorage.getItem('stnapixel_deposit_requests');
    const allReqs: DepositRequest[] = allReqsRaw ? JSON.parse(allReqsRaw) : [];
    const updatedReqs = [newRequest, ...allReqs];
    localStorage.setItem('stnapixel_deposit_requests', JSON.stringify(updatedReqs));
    
    setUserDepositRequests(updatedReqs.filter(r => r.userId === user.id));
    setDepositStatusMsg('Заявку створено успішно! Очікуйте підтвердження адміністратора.');
    setDepositNote('');
    setTimeout(() => setDepositStatusMsg(null), 5000);
  };

  const handleActivatePromo = () => {
    if (isGuest) return;
    const cleanCode = promoCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setPromoStatus({ message: 'Будь ласка, введіть промокод.', type: 'error' });
      return;
    }
    const savedPromosRaw = localStorage.getItem('stnapixel_promocodes');
    const savedPromos: PromoCode[] = savedPromosRaw ? JSON.parse(savedPromosRaw) : [];
    const promoIndex = savedPromos.findIndex(p => p.code.toUpperCase() === cleanCode);
    
    if (promoIndex === -1) {
      setPromoStatus({ message: 'Промокод не знайдено або термін його дії закінчився.', type: 'error' });
      return;
    }
    
    const promo = savedPromos[promoIndex];
    if (promo.isActive === false || promo.usedCount >= promo.maxUses) {
      setPromoStatus({ message: 'Цей промокод вже вичерпав максимальну кількість активацій.', type: 'error' });
      return;
    }
    
    if (promo.usedBy && promo.usedBy.includes(user.id)) {
      setPromoStatus({ message: 'Ви вже активували цей промокод.', type: 'error' });
      return;
    }
    
    const updatedUsedBy = [...(promo.usedBy || []), user.id];
    const updatedCount = (promo.usedCount || 0) + 1;
    const isNowActive = updatedCount < promo.maxUses;
    
    savedPromos[promoIndex] = {
      ...promo,
      usedCount: updatedCount,
      usedBy: updatedUsedBy,
      isActive: isNowActive
    };
    localStorage.setItem('stnapixel_promocodes', JSON.stringify(savedPromos));
    
    updateBalance(promo.reward);
    setPromoStatus({ message: `🎉 Промокод успішно активовано! +${promo.reward} ₴ додано на баланс.`, type: 'success' });
    setPromoCodeInput('');
  };

  const getContactInfo = (id: string) => {
    const allUsersRaw = localStorage.getItem('stnapixel_all_users');
    const allUsers = allUsersRaw ? JSON.parse(allUsersRaw) : [];
    return allUsers.find((u: any) => u.id === id);
  };

  if (!profileData) return null;

  return (
    <div className="flex-1 bg-slate-950 p-3 sm:p-6 md:p-8 overflow-y-auto relative text-white custom-scrollbar">
      <button onClick={onBack} className="absolute top-3 right-3 sm:top-6 sm:right-6 md:top-8 md:right-8 text-slate-400 hover:text-white transition-all bg-slate-900/80 p-2 sm:p-2.5 rounded-xl border border-slate-700/80 z-50 flex items-center space-x-1.5 group">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        <span className="font-bold uppercase tracking-wider text-[11px] pr-1">Назад</span>
      </button>

      <div className="max-w-5xl mx-auto pt-8 sm:pt-4">
        <div className="bg-slate-900/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-800 shadow-xl mb-6 md:mb-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 blur-[120px] pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-8 relative z-10">
            <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl md:text-5xl font-bold shadow-xl border-2 border-slate-800 uppercase flex-shrink-0">
              {profileData.username[0]?.toUpperCase() || 'U'}
            </div>
            
            <div className="flex-1 text-center md:text-left w-full min-w-0">
              <div className="flex flex-col md:flex-row items-center justify-between mb-4 md:mb-6 gap-3">
                <div className="mb-1 md:mb-0">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1 truncate">{profileData.username}</h2>
                  {!isGuest && !isPrivacyProtected && (
                    <div onClick={copyId} className="inline-flex items-center space-x-1.5 text-blue-400 font-mono text-xs bg-blue-600/10 px-2.5 py-1 rounded-lg border border-blue-500/20 cursor-pointer hover:bg-blue-600/20 transition-all">
                      <span className="opacity-50">#</span><span>{profileData.id}</span>
                      {copied && <span className="text-[10px] text-green-400 font-bold uppercase ml-1.5">Скопійовано</span>}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap justify-center gap-2">
                  {isOwnProfile && !isGuest && (
                    <button 
                      onClick={() => setIsEditing(!isEditing)} 
                      className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl border border-slate-700 transition-all active:scale-95"
                    >
                      {isEditing ? 'Скасувати' : 'Редагувати'}
                    </button>
                  )}
                  {!isOwnProfile && !isGuest && (
                    <button onClick={() => onStartChat(profileData.id)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl flex items-center space-x-1.5 shadow-md active:scale-95 transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                      <span>Написати</span>
                    </button>
                  )}
                  {isGuest && (
                    <button onClick={onLogout} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase px-4 py-2.5 rounded-xl shadow-md active:scale-95 transition-all">Увійти</button>
                  )}
                  {!isGuest && isOwnProfile && (
                    <button onClick={onLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase px-4 py-2.5 rounded-xl border border-red-500/20 transition-all">Вийти</button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                 {!isGuest && !isPrivacyProtected && (
                   <div className="bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 text-center shadow-inner">
                      <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">БАЛАНС</span>
                      <span className="text-xl sm:text-2xl font-bold text-white">₴{profileData.balance.toFixed(2)}</span>
                   </div>
                 )}
                 {user.isAdmin && !isOwnProfile && (
                    <button onClick={() => setActiveSubTab('admin_msgs')} className={`p-3 rounded-xl border text-center font-bold uppercase tracking-wider text-xs transition-all ${activeSubTab === 'admin_msgs' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-purple-600/10 border-purple-500/20 text-purple-400'}`}>
                      Адмін повідомлення
                    </button>
                 )}
                 <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noreferrer" className="bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 p-3 rounded-xl border border-slate-800 text-center font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center">Підтримка Telegram ({TELEGRAM_SUPPORT_HANDLE})</a>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-2 sm:space-x-4 md:space-x-8 mb-5 border-b border-slate-800 overflow-x-auto no-scrollbar px-1 pb-1">
          <TabButton active={activeSubTab === 'info'} onClick={() => setActiveSubTab('info')} label="Профіль" />
          {isOwnProfile && !isGuest && <TabButton active={activeSubTab === 'wallet'} onClick={() => setActiveSubTab('wallet')} label="Гаманець" />}
          {isOwnProfile && !isGuest && <TabButton active={activeSubTab === 'referrals'} onClick={() => setActiveSubTab('referrals')} label="Реферали (+10 ₴)" />}
          {isOwnProfile && !isGuest && <TabButton active={activeSubTab === 'news'} onClick={() => setActiveSubTab('news')} label="Оголошення" />}
          {!isPrivacyProtected && <TabButton active={activeSubTab === 'history'} onClick={() => setActiveSubTab('history')} label="Арти" />}
          {activeSubTab === 'admin_msgs' && <TabButton active={true} onClick={() => {}} label="Переписки" />}
          {isOwnProfile && !isGuest && (
             <div className="relative">
               <TabButton active={activeSubTab === 'chats'} onClick={() => setActiveSubTab('chats')} label="Повідомлення" />
               {chats.some(c => c.unreadCount > 0) && <div className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>}
             </div>
          )}
        </div>

        <div className="bg-slate-900/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-800 min-h-[300px] shadow-xl relative backdrop-blur-xl">
          {activeSubTab === 'wallet' && isOwnProfile && !isGuest && (
             <div className="max-w-4xl space-y-6 sm:space-y-8 animate-in fade-in duration-300">
                {/* Balance & TopUp Header */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950/80 p-5 sm:p-6 rounded-2xl border border-slate-800">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Поточний баланс</span>
                    <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">₴{user.balance.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a 
                      href={MONOBANK_JAR_URL} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center space-x-2 transition-all active:scale-95 shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      <span>Monobank Банка</span>
                    </a>
                  </div>
                </div>

                {/* Promo Code Activation Box */}
                <div className="bg-slate-950/80 border border-purple-900/30 p-5 sm:p-6 rounded-2xl space-y-4 shadow-inner relative overflow-hidden">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xl">🎟️</span>
                    <div>
                      <h4 className="text-purple-400 font-bold uppercase text-xs tracking-wider">Активація промокоду</h4>
                      <p className="text-slate-400 text-xs">Введіть промокод від адміністрації, щоб миттєво отримати кошти на баланс</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-purple-600 transition-all text-white placeholder:text-slate-600"
                      value={promoCodeInput} 
                      onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                      placeholder="Введіть промокод (наприклад STINA2026)" 
                    />
                    <button 
                      onClick={handleActivatePromo}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl uppercase tracking-wider text-xs transition-all active:scale-95 shadow-lg shadow-purple-900/30 flex-shrink-0"
                    >
                      Активувати
                    </button>
                  </div>

                  {promoStatus && (
                    <div className={`p-3 rounded-xl text-xs font-semibold ${promoStatus.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                      {promoStatus.message}
                    </div>
                  )}
                </div>

                {/* Deposit Request Creation Form */}
                <div className="bg-slate-950/80 border border-blue-900/30 p-5 sm:p-6 rounded-2xl space-y-4 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl pointer-events-none"></div>
                  <h4 className="text-blue-400 font-bold uppercase text-xs tracking-wider flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Створити заявку на поповнення</span>
                  </h4>
                  <div className="text-slate-300 font-medium space-y-1 leading-relaxed text-xs sm:text-sm">
                    <p>1. Переведіть кошти у банку: <a href={MONOBANK_JAR_URL} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-bold">Monobank Банка</a> (в призначенні вкажіть ваш ID: <span className="font-mono text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">{user.id}</span>).</p>
                    <p>2. Вкажіть суму та натисніть "Надіслати заявку". Адміністратор перевірить зарахування та підтвердить заявку.</p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Сума (від 10 ₴)</label>
                        <input 
                          type="number" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-base font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white placeholder:text-slate-600 shadow-inner" 
                          value={topUpAmount} 
                          onChange={e => setTopUpAmount(e.target.value)} 
                          min="10" 
                          placeholder="Сума в ₴" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Коментар або нік платника (необов'язково)</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white placeholder:text-slate-600 shadow-inner" 
                          value={depositNote} 
                          onChange={e => setDepositNote(e.target.value)} 
                          placeholder="Наприклад: з картки Приват/Моно Іван" 
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <button 
                        onClick={handleSubmitDepositRequest}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        <span>Надіслати заявку на поповнення</span>
                      </button>
                      <button 
                        onClick={handleTopUp} 
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        <span>Відкрити банку</span>
                      </button>
                    </div>

                    {depositStatusMsg && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl text-center animate-fadeIn">
                        {depositStatusMsg}
                      </div>
                    )}
                  </div>
                </div>

                {/* My Deposit Requests List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                    <span>Історія ваших заявок на поповнення</span>
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{userDepositRequests.length}</span>
                  </h4>

                  {userDepositRequests.length === 0 ? (
                    <div className="p-6 bg-slate-950/40 rounded-2xl border border-slate-800 text-center text-xs text-slate-500 italic">
                      Заявок поки що немає. Після подання заявки тут відображатиметься її статус.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userDepositRequests.map((req, idx) => (
                        <div key={`${req.id}-${idx}`} className="bg-slate-950/70 p-3.5 sm:p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-base">₴{req.amount.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-500 font-mono">#{req.id.slice(-6)}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">{new Date(req.timestamp).toLocaleString()}</span>
                            {req.note && <p className="text-[11px] text-slate-400 italic mt-0.5">{req.note}</p>}
                          </div>
                          <div>
                            {req.status === 'pending' && (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                                <span>Очікує розгляду</span>
                              </span>
                            )}
                            {req.status === 'approved' && (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                                <span>✅ Підтверджено (+₴{req.amount})</span>
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase tracking-wider">
                                <span>❌ Відхилено</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             </div>
          )}

          {/* Referrals SubTab */}
          {activeSubTab === 'referrals' && isOwnProfile && !isGuest && (
            <div className="max-w-4xl space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-blue-950/40 border border-emerald-500/30 p-6 sm:p-8 rounded-2xl sm:rounded-3xl relative overflow-hidden shadow-xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                      <span>🤝 Реферальна Програма</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Запрошуй друзів — отримуй <span className="text-emerald-400">10 ₴</span></h3>
                    <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-xl leading-relaxed">
                      За кожного користувача, який зареєструється за вашим реферальним посиланням чи кодом, ви миттєво отримуєте <span className="text-emerald-400 font-bold">10 грн</span> на свій баланс для малювання пікселів!
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-center min-w-[120px]">
                      <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Запрошено</span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-white">{referredUsersList.length}</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl text-center min-w-[120px]">
                      <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Зароблено</span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">₴{(referredUsersList.length * 10).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral Links and Codes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ваше реферальне посилання</span>
                  <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={`${window.location.origin}/?ref=${user.id}`} 
                      className="bg-transparent text-xs font-mono text-slate-300 flex-1 outline-none px-2 truncate select-all"
                    />
                    <button 
                      onClick={copyRefLink}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-md flex-shrink-0"
                    >
                      {copiedRefLink ? 'Скопійовано!' : 'Копіювати'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">Надішліть це посилання другові. При переході реферальний код підставиться автоматично.</p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ваш реферальний код</span>
                  <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={user.id} 
                      className="bg-transparent text-sm font-bold font-mono text-emerald-400 flex-1 outline-none px-2 select-all"
                    />
                    <button 
                      onClick={copyRefCode}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-md flex-shrink-0"
                    >
                      {copiedRefCode ? 'Скопійовано!' : 'Копіювати'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">Друг може ввести цей ID у поле "Реферальний код" при реєстрації вручну.</p>
                </div>
              </div>

              {/* List of Invited Friends */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                  <span>Список ваших рефералів</span>
                  <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{referredUsersList.length}</span>
                </h4>

                {referredUsersList.length === 0 ? (
                  <div className="p-8 bg-slate-950/40 rounded-2xl border border-slate-800 text-center space-y-2">
                    <span className="text-3xl block">👥</span>
                    <p className="text-slate-400 text-sm font-medium">Ви ще не запросили жодного друга.</p>
                    <p className="text-slate-600 text-xs">Скопіюйте посилання вище та поділіться з друзями в Telegram чи соціальних мережах!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {referredUsersList.map((refUser, idx) => (
                      <div key={`${refUser.id || 'ref'}-${idx}`} className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
                            {refUser.username?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-white text-sm block leading-tight">{refUser.username}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{refUser.id}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-400 block">+10 ₴</span>
                          <span className="text-[9px] text-slate-500">{refUser.registrationDate ? new Date(refUser.registrationDate).toLocaleDateString() : 'Нещодавно'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'info' && (
            <div className="space-y-12 animate-in fade-in duration-500">
               {isEditing && !isGuest ? (
                  <div className="space-y-8 max-w-2xl">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Нікнейм</label>
                           <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={tempUsername} onChange={e => setTempUsername(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Telegram</label>
                           <input type="text" placeholder="@нік" className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={tempTelegram} onChange={e => setTempTelegram(e.target.value)} />
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Instagram</label>
                           <input type="text" placeholder="username" className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={tempInstagram} onChange={e => setTempInstagram(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Twitch</label>
                           <input type="text" placeholder="username" className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={tempTwitch} onChange={e => setTempTwitch(e.target.value)} />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Біографія</label>
                        <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all min-h-[120px]" value={tempBio} onChange={e => setTempBio(e.target.value)} />
                     </div>
                     <button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-12 py-5 rounded-2xl uppercase tracking-widest shadow-xl transition-all active:scale-95">Зберегти зміни</button>
                  </div>
               ) : isPrivacyProtected ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-40 italic text-center">
                    <svg className="w-20 h-20 mb-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <p className="text-xl font-black uppercase tracking-widest">Приватний профіль</p>
                  </div>
               ) : (
                  <>
                     <div>
                       <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] mb-8 italic">Біографія</h4>
                       <p className="text-slate-200 font-bold italic text-3xl border-l-[6px] border-blue-600 pl-10 py-8 bg-blue-600/5 rounded-r-[3rem] leading-relaxed">
                         {profileData.bio || "Художник поки мовчить."}
                       </p>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                       <div className="bg-slate-950/60 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
                          <span className="block text-[10px] font-black text-slate-600 uppercase mb-3 tracking-widest">Реєстрація</span>
                          <span className="text-sm font-black text-slate-300 leading-none">{new Date(profileData.registrationDate).toLocaleDateString()}</span>
                       </div>
                       {profileData.telegram && <div className="bg-slate-950/60 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
                          <span className="block text-[10px] font-black text-slate-600 uppercase mb-3 tracking-widest">Telegram</span>
                          <a href={`https://t.me/${profileData.telegram.replace('@','')}`} target="_blank" rel="noreferrer" className="text-sm font-black text-blue-500 hover:text-blue-400 transition-colors leading-none truncate block">{profileData.telegram}</a>
                       </div>}
                       {profileData.instagram && <div className="bg-slate-950/60 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
                          <span className="block text-[10px] font-black text-slate-600 uppercase mb-3 tracking-widest">Instagram</span>
                          <a href={`https://instagram.com/${profileData.instagram}`} target="_blank" rel="noreferrer" className="text-sm font-black text-blue-500 hover:text-blue-400 transition-colors leading-none truncate block">@{profileData.instagram}</a>
                       </div>}
                       {profileData.twitch && <div className="bg-slate-950/60 p-8 rounded-[2.5rem] border border-slate-800 shadow-inner">
                          <span className="block text-[10px] font-black text-slate-600 uppercase mb-3 tracking-widest">Twitch</span>
                          <a href={`https://twitch.tv/${profileData.twitch}`} target="_blank" rel="noreferrer" className="text-sm font-black text-purple-500 hover:text-purple-400 transition-colors leading-none truncate block">{profileData.twitch}</a>
                       </div>}
                     </div>
                  </>
               )}
            </div>
          )}

          {activeSubTab === 'history' && !isPrivacyProtected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in duration-500">
               {history.length === 0 ? (
                 <div className="col-span-full py-48 text-center opacity-20 font-black uppercase tracking-widest text-xl italic">Арти поки що відсутні</div>
               ) : history.map((art, idx) => (
                 <div key={`${art.id}-${idx}`} className="bg-slate-950/50 p-10 rounded-[3.5rem] border border-slate-800 flex flex-col justify-between group hover:bg-slate-900 hover:border-blue-600/40 transition-all shadow-2xl relative">
                    <div className="flex justify-between items-start mb-8">
                       <h5 className="font-bold text-2xl text-white tracking-tight leading-none">"{art.description || "Арт"}"</h5>
                       <span className="text-[9px] text-slate-700 font-mono font-bold">{new Date(art.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="bg-black/40 p-6 rounded-[1.8rem] border border-slate-800 shadow-inner mb-6">
                       <div className="flex justify-between items-center"><div className="flex flex-col"><span className="text-[10px] text-slate-600 font-bold uppercase mb-1 tracking-wider">Розмір</span><span className="text-white font-bold text-xl leading-none tracking-tight">{art.pixelCount.toLocaleString()} PX</span></div></div>
                    </div>
                    <div className="flex space-x-3">
                      {!art.isDeletedFromWall && (
                        <button onClick={() => onGoToLocation(art.centerX, art.centerY)} className="flex-1 bg-slate-800 hover:bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all border border-slate-700 active:scale-95 shadow-lg">Знайти</button>
                      )}
                      {user.isAdmin && (
                        <button 
                          onClick={() => {
                            if (!confirm("ВИДАЛИТИ АРТ ПОВНІСТЮ?")) return;
                            const musRaw = localStorage.getItem('stnapixel_museum_gallery');
                            const arcRaw = localStorage.getItem('stnapixel_museum_archive');
                            const updatedG = musRaw ? JSON.parse(musRaw).filter((a: any) => a.id !== art.id) : [];
                            const updatedA = arcRaw ? JSON.parse(arcRaw).filter((a: any) => a.id !== art.id) : [];
                            localStorage.setItem('stnapixel_museum_gallery', JSON.stringify(updatedG));
                            localStorage.setItem('stnapixel_museum_archive', JSON.stringify(updatedA));
                            
                            const histKey = `stnapixel_user_history_${profileData.id}`;
                            const updatedH = history.filter(a => a.id !== art.id);
                            localStorage.setItem(histKey, JSON.stringify(updatedH));
                            setHistory(updatedH);
                            alert("Видалено.");
                          }} 
                          className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white p-4 rounded-2xl border border-red-600/30 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      )}
                    </div>
                    {art.isDeletedFromWall && !user.isAdmin && <div className="text-center text-[10px] font-black uppercase text-red-500 italic opacity-50 bg-red-500/10 py-3 rounded-xl border border-red-500/20">Видалено назавжди</div>}
                 </div>
               ))}
            </div>
          )}

          {(activeSubTab === 'chats' || activeSubTab === 'admin_msgs') && !isGuest && (
            <div className="flex flex-col md:flex-row h-auto md:h-[550px] space-y-8 md:space-y-0 md:space-x-12 animate-in fade-in duration-500">
               <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-800/50 pb-8 md:pb-0 md:pr-12 flex flex-col">
                  <div className="mb-6 space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Пошук за ID</label>
                    <div className="flex space-x-2">
                       <input type="text" placeholder="ID..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-blue-600 font-bold" value={searchUserId} onChange={e => setSearchUserId(e.target.value)} />
                       <button onClick={handleStartChatById} className="bg-blue-600 p-3 rounded-xl hover:bg-blue-500 transition-all"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[300px] md:max-h-full space-y-4 custom-scrollbar">
                    {chats.map((chat, idx) => (
                      <div key={`${chat.userId}-${idx}`} onClick={() => loadMessages(chat.userId)} className={`p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] cursor-pointer transition-all border-2 relative ${selectedChatId === chat.userId ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-slate-950/40 border-slate-800 hover:bg-slate-950/60'}`}>
                         <p className="font-black text-sm md:text-base truncate leading-none mb-2">{chat.username}</p>
                         <p className="text-[10px] md:text-[11px] truncate opacity-60 italic font-bold leading-none">{chat.lastMessage || '...'}</p>
                         {chat.unreadCount > 0 && selectedChatId !== chat.userId && <div className="absolute top-3 md:top-4 right-3 md:right-4 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-full animate-bounce shadow-lg">{chat.unreadCount}</div>}
                      </div>
                    ))}
                  </div>
               </div>
               <div className="flex-1 flex flex-col bg-black/20 rounded-2xl md:rounded-[3rem] overflow-hidden border border-slate-800 min-h-[400px] md:min-h-0">
                  {selectedChatId ? (
                    <>
                      <div className="bg-slate-900/80 p-4 md:p-6 border-b border-slate-800 flex items-center justify-between shadow-lg">
                        <div className="flex items-center space-x-3 md:space-x-4">
                           <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-black text-white shadow-md">{getContactInfo(selectedChatId)?.username[0]}</div>
                           <div>
                             <h4 className="font-black text-sm md:text-base leading-none mb-1">{getContactInfo(selectedChatId)?.username || 'Користувач'}</h4>
                             <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div><span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest italic leading-none">В мережі</span></div>
                           </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar">
                         {chatMessages.map((m, idx) => {
                           const senderId = activeSubTab === 'admin_msgs' ? profileData.id : user.id;
                           const isMe = m.fromId === senderId;
                           return (
                             <div key={`${m.id}-${idx}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                                <div className="flex flex-col max-w-[90%] md:max-w-[85%] space-y-1">
                                  <div className={`p-4 md:p-5 rounded-2xl md:rounded-[2rem] text-xs md:text-sm font-bold shadow-xl ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>{m.text}</div>
                                  <div className={`flex items-center space-x-2 px-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <span className="text-[8px] text-slate-600 font-bold uppercase">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMe && <span className={`text-[8px] font-black uppercase tracking-widest ${m.isRead ? 'text-green-500' : 'text-red-500'}`}>{m.isRead ? 'прочитано' : 'не прочитано'}</span>}
                                  </div>
                                </div>
                             </div>
                           );
                         })}
                         <div ref={messagesEndRef} />
                      </div>
                      <div className="p-4 md:p-6 bg-slate-900/50 border-t border-slate-800">
                        <div className="flex space-x-3 md:space-x-4 bg-slate-950 p-1.5 md:p-2 rounded-2xl md:rounded-[2.5rem] border border-slate-700 shadow-inner">
                           <input type="text" className="flex-1 bg-transparent px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold outline-none text-white" placeholder="Повідомлення..." value={newMessageText} onChange={e => setNewMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                           <button onClick={sendMessage} className="bg-blue-600 hover:bg-blue-500 w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 rotate-45 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
                        </div>
                      </div>
                    </>
                  ) : <div className="flex-1 flex items-center justify-center opacity-20 italic font-black uppercase tracking-widest text-center px-8 md:px-12 leading-relaxed text-sm md:text-base">Оберіть діалог</div>}
               </div>
            </div>
          )}

          {isGuest && (activeSubTab === 'chats' || activeSubTab === 'wallet' || activeSubTab === 'news') && (
            <div className="flex flex-col items-center justify-center py-32 space-y-8 opacity-40 italic text-center">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <p className="text-xl font-black uppercase tracking-widest max-w-sm">Цей розділ доступний лише авторизованим художникам</p>
              <button onClick={onLogout} className="bg-blue-600 not-italic text-white font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-blue-500 transition-all opacity-100 shadow-xl">Зареєструватися</button>
            </div>
          )}
          
          {activeSubTab === 'news' && isOwnProfile && !isGuest && (
            <div className="space-y-8 animate-in fade-in duration-500">
               {allNews.length === 0 ? (
                 <div className="py-32 text-center opacity-20 font-black uppercase tracking-widest italic text-xl">Наразі оголошень немає</div>
               ) : allNews.map((n, idx) => (
                 <div key={`${n.id}-${idx}`} className="bg-slate-950/40 p-10 rounded-[3rem] border border-slate-800 shadow-xl group hover:border-blue-600/30 transition-all duration-300">
                    <span className="text-xs text-slate-600 font-mono font-bold mb-4 block">{new Date(n.timestamp).toLocaleDateString()}</span>
                    <p className="text-slate-100 text-xl font-bold leading-relaxed italic mb-8">"{n.text}"</p>
                    {n.link && <a href={n.link} target="_blank" rel="noreferrer" className="text-blue-600 text-[11px] font-black uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">Докладніше</a>}
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button onClick={onClick} className={`text-sm font-black uppercase pb-10 px-6 relative transition-all tracking-[0.2em] ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-300'}`}>
    {label}{active && <div className="absolute bottom-0 left-0 w-full h-2 bg-blue-600 rounded-full shadow-[0_0_25px_rgba(37,99,235,1)] animate-in slide-in-from-left duration-300"></div>}
  </button>
);

export default ProfileView;
