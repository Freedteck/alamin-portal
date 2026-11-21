export function cn(...inputs) {
  return inputs
    .flat()
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function formatDate(date, formatType = 'PPP') {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const monthsLong = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const month = d.getMonth();
  const day = d.getDate();
  const year = d.getFullYear();

  if (formatType === 'PPP') {
    return `${monthsLong[month]} ${day}, ${year}`;
  }
  if (formatType === 'MMM dd, yyyy') {
    return `${monthsShort[month]} ${String(day).padStart(2, '0')}, ${year}`;
  }
  return d.toLocaleDateString('en-GB');
}

export const demoAccounts = {
  'student@alaminschools.edu.ng': { type: 'student', name: 'Amina Bello' },
  'student@alaminschools.edu': { type: 'student', name: 'Amina Bello' },
  'staff@alaminschools.edu.ng': { type: 'staff', name: 'Ustadh Ibrahim Al-Hassan' },
  'teacher@alaminschools.edu.ng': { type: 'staff', name: 'Ustadh Ibrahim Al-Hassan' },
  'teacher@alaminschools.edu': { type: 'staff', name: 'Ustadh Ibrahim Al-Hassan' },
  'admin@alaminschools.edu.ng': { type: 'admin', name: 'Al-Amin Administrator' },
  'admin@alaminschools.edu': { type: 'admin', name: 'Al-Amin Administrator' }
};
