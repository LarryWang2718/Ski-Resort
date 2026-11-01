// Display helpers shared by the list and detail pages

// Resort stats are stored as text such as "3330.0"; show them rounded, with a unit
export const formatStat = (value, unit = '') => {
  const number = parseFloat(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return [Math.round(number).toLocaleString(), unit].filter(Boolean).join(' ');
};

export const formatLocation = (resort) =>
  [resort?.location_region, resort?.location_country].filter(Boolean).join(', ');

export const humanize = (value) => {
  if (!value || value === 'unknown') return '';
  const text = String(value).replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Piste colours, shared with the map so rows and lines match
export const DIFFICULTIES = {
  novice: { label: 'Novice', color: '#9e9e9e' },
  easy: { label: 'Easy', color: '#2e7d32' },
  intermediate: { label: 'Intermediate', color: '#1976d2' },
  advanced: { label: 'Advanced', color: '#212121' },
  expert: { label: 'Expert', color: '#000000' },
  freeride: { label: 'Freeride', color: '#ef6c00' },
  extreme: { label: 'Extreme', color: '#b71c1c' }
};

export const UNKNOWN_DIFFICULTY_COLOR = '#757575';

export const LIFT_TYPES = {
  gondola: 'Gondola',
  cable_car: 'Cable car',
  chair_lift: 'Chairlift',
  mixed_lift: 'Mixed lift',
  drag_lift: 'Drag lift',
  't-bar': 'T-bar',
  'j-bar': 'J-bar',
  platter: 'Platter',
  rope_tow: 'Rope tow',
  magic_carpet: 'Magic carpet',
  funicular: 'Funicular'
};

export const liftLabel = (type) => LIFT_TYPES[type] || humanize(type);

// The import marks almost everything "open", so only surface statuses that say something
const QUIET_STATUSES = new Set(['open', 'operational', 'unknown']);
export const statusNote = (status) => (status && !QUIET_STATUSES.has(status) ? humanize(status) : '');
