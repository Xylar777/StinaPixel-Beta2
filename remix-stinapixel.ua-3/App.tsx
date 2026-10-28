
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ActivityLog } from './types';
import LandingPage from './components/LandingPage';
import MainWall from './components/MainWall';
import AdminPanel from './components/AdminPanel';
import Museum from './components/Museum';
import ProfileView from './components/ProfileView';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<'landing' | 'wall' | 'admin' | 'museum' | 'profile'>('landing');
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [targetLocation, setTargetLocation] = useState<{x: number, y: number} | null>(null);
  const [initialChatId, setInitialChatId] = useState<string | null>(null);
  const hasLoggedActivity = useRef(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('stnapixel_user');
    let currentUser: User | null = null;
    
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.isBanned) {
          handleLogout();
          return;
        }
        setUser(parsed);
        setIsAuth(true);
        setCurrentPage('wall');
        currentUser = parsed;
      } catch (e) {
        localStorage.removeItem('stnapixel_user');
      }
    }

    // Log Activity (once per mount, with deduplication and high-entropy IDs)
    if (!hasLoggedActivity.current) {
      hasLoggedActivity.current = true;
      const log: ActivityLog = {
        id: `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        isAuth: !!currentUser,
        userId: currentUser?.id,
        username: currentUser?.username
      };
      const rawLogs: ActivityLog[] = JSON.parse(localStorage.getItem('stnapixel_activity_logs') || '[]');
      const seenIds = new Set<string>();
      const dedupedLogs: ActivityLog[] = [];
      for (const item of [log, ...rawLogs]) {
        if (item && item.id && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          dedupedLogs.push(item);
        }
      }
      localStorage.setItem('stnapixel_activity_logs', JSON.stringify(dedupedLogs.slice(0, 1000)));
    }
  }, []);

  const handleLogin = (loggedUser: User) => {
    if (loggedUser.isBanned) {
      alert("Ваш акаунт заблоковано адміністрацією.");
      return;
    }
    setUser(loggedUser);
    setIsAuth(true);
    setCurrentPage('wall');
    localStorage.setItem('stnapixel_user', JSON.stringify(loggedUser));
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuth(false);
    setCurrentPage('landing');
    localStorage.removeItem('stnapixel_user');
  };

  const updateBalance = useCallback((amount: number) => {
    setUser(prev => {
      if (!prev) return null;
      const newBalance = prev.balance + amount;
      const updated = { ...prev, balance: newBalance };
      localStorage.setItem('stnapixel_user', JSON.stringify(updated));
      const allUsers = JSON.parse(localStorage.getItem('stnapixel_all_users') || '[]');
      const userIdx = allUsers.findIndex((u: any) => u.id === prev.id);
      if (userIdx !== -1) {
        allUsers[userIdx].balance = newBalance;
        localStorage.setItem('stnapixel_all_users', JSON.stringify(allUsers));
      }
      return updated;
    });
  }, []);

  const updateUser = useCallback((updatedData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedData };
      localStorage.setItem('stnapixel_user', JSON.stringify(updated));
      const allUsers = JSON.parse(localStorage.getItem('stnapixel_all_users') || '[]');
      const userIdx = allUsers.findIndex((u: any) => u.id === prev.id);
      if (userIdx !== -1) {
        allUsers[userIdx] = { ...allUsers[userIdx], ...updatedData };
        localStorage.setItem('stnapixel_all_users', JSON.stringify(allUsers));
      }
      return updated;
    });
  }, []);

  const banUser = useCallback((userId: string, status: boolean) => {
    const allUsers = JSON.parse(localStorage.getItem('stnapixel_all_users') || '[]');
    const updatedUsers = allUsers.map((u: any) => {
      if (u.id === userId) return { ...u, isBanned: status };
      return u;
    });
    localStorage.setItem('stnapixel_all_users', JSON.stringify(updatedUsers));
    if (user?.id === userId && status) { handleLogout(); }
  }, [user]);

  const navigateToProfile = (targetId?: string) => {
    setViewUserId(targetId || null);
    setInitialChatId(null);
    setCurrentPage('profile');
  };

  const startChatFromProfile = (targetId: string) => {
    setInitialChatId(targetId);
    setViewUserId(null); 
    setCurrentPage('profile');
  };

  const goToLocation = (x: number, y: number) => {
    setTargetLocation({ x, y });
    setCurrentPage('wall');
  };

  if (!isAuth || !user) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 overflow-hidden select-none">
      {currentPage === 'wall' && (
        <MainWall 
          user={user} 
          onNavigate={setCurrentPage} 
          onViewProfile={navigateToProfile} 
          updateBalance={updateBalance} 
          onLogout={handleLogout} 
          targetLocation={targetLocation} 
          clearTargetLocation={() => setTargetLocation(null)} 
        />
      )}
      {currentPage === 'admin' && user.isAdmin && (
        <AdminPanel 
          user={user} 
          onBack={() => setCurrentPage('wall')} 
          onViewProfile={navigateToProfile} 
          onBanUser={banUser} 
        />
      )}
      {currentPage === 'museum' && (
        <Museum 
          onBack={() => setCurrentPage('wall')} 
          onGoToLocation={goToLocation} 
          onViewProfile={navigateToProfile} 
          currentUserId={user.id} 
          isAdmin={user.isAdmin}
        />
      )}
      {currentPage === 'profile' && (
        <ProfileView 
          user={user} 
          targetUserId={viewUserId} 
          onBack={() => { setCurrentPage('wall'); setViewUserId(null); }} 
          updateBalance={updateBalance} 
          updateUser={updateUser} 
          onLogout={handleLogout} 
          onViewProfile={navigateToProfile}
          onStartChat={startChatFromProfile}
          onGoToLocation={goToLocation}
          initialChatTargetId={initialChatId}
        />
      )}
    </div>
  );
};

export default App;
