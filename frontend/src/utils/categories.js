/**
 * Category Definitions & Color Synchronizer (Light Minimalist GIS Theme)
 *
 * Ensures 100% visual and logical sync between:
 *  - Map markers & popups
 *  - Map legend
 *  - Tweet Feed filter pills
 *  - Tweet Feed card rows
 *  - Backend API categories & Demo fallback categories
 *
 * Color Specification:
 *  - Red   (#ef4444): Rescue / Help  OR  Elder / Home Water
 *  - Orange (#f97316): Infrastructure OR  Submerged Road / Bridge
 *  - Amber (#eab308): Evacuation     OR  Rising Water / Evacuation
 *  - Blue  (#3b82f6): Weather / Water OR  Other relevant categories
 */

export const SYNCED_CATEGORIES = [
  {
    key: 'Rescue / Help',
    label: 'Rescue / Help',
    altLabel: 'Elder / Home Water',
    colorHex: '#ef4444',
    strokeHex: '#b91c1c',
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
    pillActiveClass: 'bg-zinc-900 text-white border-zinc-900',
    pillInactiveClass: 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400',
    dotBg: 'bg-red-500',
  },
  {
    key: 'Infrastructure',
    label: 'Infrastructure',
    altLabel: 'Submerged Road / Bridge',
    colorHex: '#f97316',
    strokeHex: '#c2410c',
    badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
    pillActiveClass: 'bg-zinc-900 text-white border-zinc-900',
    pillInactiveClass: 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400',
    dotBg: 'bg-orange-500',
  },
  {
    key: 'Evacuation',
    label: 'Evacuation',
    altLabel: 'Rising Water / Evacuation',
    colorHex: '#eab308',
    strokeHex: '#a16207',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    pillActiveClass: 'bg-zinc-900 text-white border-zinc-900',
    pillInactiveClass: 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400',
    dotBg: 'bg-amber-500',
  },
  {
    key: 'Weather / Water',
    label: 'Weather / Water',
    altLabel: 'Weather / Water Levels',
    colorHex: '#3b82f6',
    strokeHex: '#1d4ed8',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    pillActiveClass: 'bg-zinc-900 text-white border-zinc-900',
    pillInactiveClass: 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400',
    dotBg: 'bg-blue-500',
  },
];

/**
 * Get color tokens for Map markers & SVG shapes
 */
export function getMarkerColor(category) {
  if (!category) return { fill: '#3b82f6', stroke: '#1d4ed8' };
  const cat = category.toLowerCase().trim();

  // Red: Rescue / Help OR Elder / Home Water
  if (cat.includes('rescue') || cat.includes('elder') || (cat.includes('home') && cat.includes('water'))) {
    return { fill: '#ef4444', stroke: '#b91c1c' };
  }

  // Orange: Infrastructure OR Submerged Road / Bridge
  if (cat.includes('infrastructure') || cat.includes('road') || cat.includes('bridge') || cat.includes('submerged')) {
    return { fill: '#f97316', stroke: '#c2410c' };
  }

  // Amber: Evacuation OR Rising Water / Evacuation
  if (cat.includes('evacuation') || cat.includes('rising')) {
    return { fill: '#eab308', stroke: '#a16207' };
  }

  // Blue: Weather / Water OR other
  return { fill: '#3b82f6', stroke: '#1d4ed8' };
}

/**
 * Get category display badge styling for feed rows & map popups
 */
export function getCategoryBadge(category) {
  if (!category) return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
  const cat = category.toLowerCase().trim();

  if (cat.includes('rescue') || cat.includes('elder') || (cat.includes('home') && cat.includes('water'))) {
    return 'bg-red-50 text-red-700 border border-red-200';
  }
  if (cat.includes('infrastructure') || cat.includes('road') || cat.includes('bridge') || cat.includes('submerged')) {
    return 'bg-orange-50 text-orange-700 border border-orange-200';
  }
  if (cat.includes('evacuation') || cat.includes('rising')) {
    return 'bg-amber-50 text-amber-800 border border-amber-200';
  }
  if (cat.includes('donation') || cat.includes('volunteer')) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }
  return 'bg-blue-50 text-blue-700 border border-blue-200';
}

/**
 * Standardize label for display
 */
export function getCategoryDisplay(category) {
  if (!category) return 'Signal';
  const cat = category.toLowerCase().trim();

  if (cat.includes('rescue') || cat.includes('elder')) return 'Rescue / Help';
  if (cat.includes('infrastructure') || cat.includes('road') || cat.includes('bridge')) return 'Infrastructure';
  if (cat.includes('evacuation') || cat.includes('rising')) return 'Evacuation';
  if (cat.includes('weather') || cat.includes('water')) return 'Weather / Water';
  if (cat.includes('donation')) return 'Donations';

  // Capitalize snake_case backend names
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Robust matcher checking both backend category keys and demo category names
 */
export function matchesCategory(tweetCat, filterCat) {
  if (!filterCat) return true;
  if (!tweetCat) return false;

  const t = tweetCat.toLowerCase().trim();
  const f = filterCat.toLowerCase().trim();

  if (t === f) return true;

  // Red
  const isRed = (s) => s.includes('rescue') || s.includes('elder') || (s.includes('home') && s.includes('water'));
  if (isRed(f) && isRed(t)) return true;

  // Orange
  const isOrange = (s) => s.includes('infrastructure') || s.includes('road') || s.includes('bridge') || s.includes('submerged');
  if (isOrange(f) && isOrange(t)) return true;

  // Amber
  const isAmber = (s) => s.includes('evacuation') || s.includes('rising');
  if (isAmber(f) && isAmber(t)) return true;

  // Blue
  const isBlue = (s) => s.includes('weather') || s.includes('water');
  if (isBlue(f) && isBlue(t)) return true;

  return false;
}
