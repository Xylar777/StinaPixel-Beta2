
export enum Tool {
  REVIEW = 'REVIEW',
  ERASER = 'ERASER',
  PENCIL = 'PENCIL',
  RECTANGLE = 'RECTANGLE'
}

export enum Mode {
  STANDARD = 'STANDARD',
  VIP = 'VIP'
}

export interface User {
  id: string;
  email: string;
  username: string;
  balance: number;
  isAdmin: boolean;
  isBanned?: boolean;
  avatar?: string;
  bio?: string;
  telegram?: string;
  instagram?: string;
  twitch?: string;
  registrationDate: string;
  lastActive?: number;
  referredBy?: string;
  referralEarnings?: number;
  referralCount?: number;
}

export interface PixelData {
  color: string;
  ownerId: string;
  ownerName: string;
  isVIP: boolean;
  timestamp: number;
  description?: string;
  link?: string;
  artId?: string;
}

export interface PublishedArt {
  id: string;
  ownerId: string;
  ownerName: string;
  pixelCount: number;
  cost: number;
  timestamp: number;
  description?: string; 
  link?: string;
  isVIP: boolean;
  thumbnail?: string;
  centerX: number;
  centerY: number;
  likes: number;
  likedBy: string[];
  artPixels: { [key: string]: string };
  isDeletedFromWall?: boolean; 
  isArchived?: boolean;
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  timestamp: number;
  isRead: boolean;
}

export interface FinanceLog {
  id: string;
  adminId: string;
  targetId: string;
  amount: number;
  timestamp: number;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  isAuth: boolean;
  userId?: string;
  username?: string;
}

export interface PromoCode {
  id: string;
  code: string;
  reward: number;
  maxUses: number;
  usedCount: number;
  usedBy: string[]; // List of user IDs who redeemed this code
  createdAt: number;
  isActive: boolean;
}

export interface DepositRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: number;
  reviewedBy?: string;
  note?: string;
}
