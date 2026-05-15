export const KARAOKE_WINDOW_MS = 5000;      // 5s rolling window for word match check
export const IDLE_TIMEOUT_MS = 30000;        // 30s no match → show motivational screen
export const WEAK_ARTICLE_THRESHOLD = 0.7;  // below 70% = weak article
export const MAX_ATTEMPTS = 2;              // attempts per MCQ question
export const OPENING_CARDS_PER_SESSION = 2; // random cards shown per visit

export const COLORS = {
  pink: '#F472B6',
  pinkLight: '#FCE7F3',
  pinkMid: '#F9A8D4',
  blue: '#60A5FA',
  blueLight: '#DBEAFE',
  blueMid: '#93C5FD',
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  gray: '#6B7280',
  grayLight: '#F3F4F6',
  dark: '#1F2937',
};
