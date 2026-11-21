import crypto from 'node:crypto';

export const SCHOOL_CLASSES = ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];
export const SSS_DEPARTMENTS = ['Science', 'Humanities', 'Business'];
export const ACADEMIC_SESSIONS = ['2026/2027', '2025/2026', '2024/2025'];
export const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const isSeniorClass = (cls: string) => String(cls || '').startsWith('SSS');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = String(stored || '').split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export const computeGrade = (total: number) => {
  if (total >= 75) return { grade: 'A1', remark: 'Excellent' };
  if (total >= 70) return { grade: 'B2', remark: 'Very Good' };
  if (total >= 65) return { grade: 'B3', remark: 'Good' };
  if (total >= 60) return { grade: 'C4', remark: 'Credit' };
  if (total >= 55) return { grade: 'C5', remark: 'Credit' };
  if (total >= 50) return { grade: 'C6', remark: 'Credit' };
  if (total >= 45) return { grade: 'D7', remark: 'Pass' };
  if (total >= 40) return { grade: 'E8', remark: 'Pass' };
  return { grade: 'F9', remark: 'Fail' };
};

export const getClassCode = (className: string) => {
  const map: Record<string, string> = {
    'JSS 1': 'JA',
    'JSS 2': 'JB',
    'JSS 3': 'JC',
    'SSS 1': 'SA',
    'SSS 2': 'SB',
    'SSS 3': 'SC'
  };
  if (map[className]) return map[className];
  const clean = String(className || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.length >= 2 ? clean.slice(0, 2) : (clean + 'X').slice(0, 2);
};

export const generateAdmissionNumber = (className: string, existingStudents: any[] = [], year?: number | string) => {
  const currentYear = year ? String(year) : String(new Date().getFullYear());
  const yearPrefix = currentYear.slice(-2);
  const classCode = getClassCode(className);
  const matching = existingStudents.filter((s) => s.class === className);
  const nextNum = matching.length + 1;
  const padded = String(nextNum).padStart(3, '0');
  return `${yearPrefix}/ASS/${classCode}${padded}`;
};

export function createInitialUsers() {
  const envEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const envPass = process.env.INITIAL_ADMIN_PASSWORD || '';

  if (!envEmail && !envPass) {
    console.warn('Initial administrator was not seeded; set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to provision one.');
    return [];
  }
  if (!envEmail || envPass.trim().length < 12) {
    throw new Error('INITIAL_ADMIN_EMAIL and an INITIAL_ADMIN_PASSWORD of at least 12 characters are required to seed the administrator.');
  }

  return [
    {
      id: 'usr-admin-1',
      email: envEmail,
      name: 'Al-Amin Administrator',
      role: 'admin',
      passwordHash: hashPassword(envPass)
    }
  ];
}
