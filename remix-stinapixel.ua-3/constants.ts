
export const CANVAS_SIZE = 10000;
export const TOTAL_PIXELS = CANVAS_SIZE * CANVAS_SIZE;

export const COLORS_STANDARD = [
  '#FFFFFF', // Білий
  '#000000', // Чорний
  '#FF0000', // Червоний
  '#0000FF', // Синій
  '#00FF00', // Зелений
  '#FFFF00', // Жовтий
];

export const COST_STANDARD = 0.1;
export const COST_VIP = 0.25;

export const ADMIN_CREDENTIALS = {
  email: 'bravlsmars2000@gmail.com',
  password: '87654321',
  id: 'ID000000'
};

export const MONOBANK_JAR_URL = 'https://send.monobank.ua/jar/7qJ7czcn6v';
export const TELEGRAM_SUPPORT_HANDLE = '@do11ar1';
export const TELEGRAM_SUPPORT_URL = 'https://t.me/do11ar1';

// Оновлені нагороди згідно з запитом користувача
export const REWARDS = [
  { value: 250.0, chance: 0.005, color: 'bg-yellow-500' }, // Жовтий
  { value: 150.0, chance: 0.01, color: 'bg-red-700' },    // Темно-Червоний
  { value: 100.0, chance: 0.02, color: 'bg-red-500' },    // Червоний
  { value: 50.0, chance: 0.065, color: 'bg-pink-500' },   // Рожевий
  { value: 25.0, chance: 0.15, color: 'bg-violet-600' },  // Фіолетовий
  { value: 10.0, chance: 0.25, color: 'bg-blue-600' },    // Яскраво-синій
  { value: 5.0, chance: 0.25, color: 'bg-sky-400' },      // Світло-блакитний
  { value: 1.0, chance: 0.25, color: 'bg-slate-500' },    // Сірий
];
