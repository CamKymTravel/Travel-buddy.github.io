export const BUILD_VERSION = '0.10.1';
export const SCHEMA_VERSION = 3;
export const EXPENSE_CATEGORIES = ['Groceries','Eating Out','Transport','Entertainment','Tickets','Shopping','Misc'];
export const SHOPPING_STATES = ['pending','got','couldnt'];
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_IMPORT_ITEMS = 500;

const CURRENCY_DIGITS = new Map([
  ['BHD',3],['IQD',3],['JOD',3],['KWD',3],['LYD',3],['OMR',3],['TND',3],
  ['BIF',0],['CLP',0],['DJF',0],['GNF',0],['ISK',0],['JPY',0],['KMF',0],
  ['KRW',0],['PYG',0],['RWF',0],['UGX',0],['VND',0],['VUV',0],['XAF',0],['XOF',0],['XPF',0]
]);

export function validateAuDate(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
  if (!m) return false;
  const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

export function auDateToSort(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

export function isoDateToAu(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return '';
  const au = `${m[3]}/${m[2]}/${m[1]}`;
  return validateAuDate(au) ? au : '';
}

export function auDateToIso(value) {
  return validateAuDate(value) ? auDateToSort(value) : '';
}

export function todayAu(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return `${map.day}/${map.month}/${map.year}`;
}

export function convertLocalToAud(localAmount, exchangeRate) {
  const local = Number(localAmount), rate = Number(exchangeRate);
  if (!Number.isFinite(local) || local < 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return local / rate;
}

export function formatAud(value) {
  if (value === null || value === undefined || value === '') return 'AUD —';
  const n = Number(value);
  return Number.isFinite(n) ? `AUD ${n.toFixed(2)}` : 'AUD —';
}

export function currencyFractionDigits(code='') {
  return CURRENCY_DIGITS.get(String(code).trim().toUpperCase()) ?? 2;
}

export function formatLocal(value, code = '', locale='en-AU') {
  const n = Number(value);
  const cleanCode = String(code).trim().toUpperCase();
  if (!Number.isFinite(n)) return `${cleanCode} —`.trim();
  const digits = currencyFractionDigits(cleanCode);
  return `${cleanCode} ${n.toLocaleString(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits})}`.trim();
}

export function expenseSortNewest(a,b) {
  const byDate = auDateToSort(b.date).localeCompare(auDateToSort(a.date));
  if (byDate) return byDate;
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

export function shoppingSortStable(a,b) {
  const ao=Number(a.order), bo=Number(b.order);
  if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao-bo;
  if (Number.isFinite(ao) !== Number.isFinite(bo)) return Number.isFinite(ao) ? -1 : 1;
  const byCreated=String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  return byCreated || String(a.id||'').localeCompare(String(b.id||''));
}

export function nextShoppingOrder(items=[]) {
  let max=0;
  for(const item of items){ const n=Number(item?.order); if(Number.isFinite(n)&&n>max) max=n; }
  return max+1;
}

export function finishShopping(items, modifiedAt = new Date().toISOString()) {
  return items.filter(i => i.state !== 'got').map(i => i.state === 'couldnt' ? {...i,state:'pending',modifiedAt} : {...i});
}

export function normalizeInitials(name, supplied='') {
  const clean = String(supplied || '').trim().toUpperCase();
  if (clean) return clean.slice(0,3);
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('').slice(0,3);
}

export function nonBlank(value, max=Infinity) {
  const clean=String(value ?? '').trim();
  return clean.length>0 && clean.length<=max;
}

export function normalizeCurrencyCode(value) {
  const code=String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function buildExpenseRecord({existing=null, form, stay, now = new Date().toISOString()}) {
  const localAmount = Number(form.localAmount);
  if (!stay || !Number.isFinite(localAmount) || localAmount <= 0) throw new Error('Invalid expense amount');
  if (!validateAuDate(form.date)) throw new Error('Invalid expense date');
  if (!EXPENSE_CATEGORIES.includes(form.category)) throw new Error('Invalid expense category');
  const savedRate = Number(stay.exchangeRate);
  const hasRate = Number.isFinite(savedRate) && savedRate > 0;
  const aud = hasRate ? convertLocalToAud(localAmount, savedRate) : null;
  return {
    id: existing?.id || crypto.randomUUID(),
    date: String(form.date).trim(),
    category: form.category,
    localAmount,
    currencyCode: stay.currencyCode,
    currencySymbol: stay.currencySymbol,
    audAmount: aud,
    exchangeRate: hasRate ? savedRate : null,
    country: stay.country,
    city: stay.city,
    stayId: stay.id,
    staySnapshot: {
      id: stay.id, country: stay.country, city: stay.city, flag: stay.flag,
      startDate: stay.startDate, endDate: stay.endDate,
      currencyName: stay.currencyName, currencyCode: stay.currencyCode,
      currencySymbol: stay.currencySymbol, exchangeRate: hasRate ? savedRate : null
    },
    note: String(form.note || '').trim().slice(0,180),
    transferred: false,
    createdAt: existing?.createdAt || now,
    modifiedAt: now
  };
}

export function validateShoppingEnvelope(data) {
  return !!data && data.kind==='travel-buddy-shopping-list' && [1,2].includes(Number(data.version)) &&
    nonBlank(data.sourceListId,120) && Array.isArray(data.items) && data.items.length<=MAX_IMPORT_ITEMS;
}

export function normalizeShoppingImportItem(raw) {
  if(!raw || typeof raw!=='object') throw new Error('Invalid shopping item');
  const itemName=String(raw.itemName ?? raw.name ?? '').trim();
  const quantity=String(raw.quantity ?? '').trim();
  const note=String(raw.note ?? '').trim();
  const categoryName=String(raw.categoryName ?? raw.category ?? 'Other').trim() || 'Other';
  const requesterName=String(raw.requesterName ?? '').trim();
  const requesterInitials=String(raw.requesterInitials ?? '').trim().toUpperCase().slice(0,3);
  if(!nonBlank(itemName,80) || quantity.length>30 || note.length>160 || categoryName.length>60 || requesterName.length>60) throw new Error('Invalid shopping item fields');
  return {
    sourceItemId: nonBlank(raw.sourceItemId ?? raw.id,120) ? String(raw.sourceItemId ?? raw.id) : null,
    itemName, quantity, note, categoryName,
    requesterId: nonBlank(raw.requesterId,120) ? String(raw.requesterId) : null,
    requesterName, requesterInitials,
    state: SHOPPING_STATES.includes(raw.state) ? raw.state : 'pending'
  };
}

export function mergeImportedShopping(existing, incoming, alreadyImportedIds = new Set()) {
  const visibleKey = i => [i.itemName,i.quantity,i.note,i.requesterId,i.categoryId].map(x=>String(x||'').trim().toLowerCase()).join('|');
  const ids = new Set(existing.map(i=>i.id));
  const keys = new Set(existing.map(visibleKey));
  const merged = [...existing];
  let added = 0, skipped = 0, order = nextShoppingOrder(existing);
  const createdBase = Date.now();
  for (let index=0; index<(incoming || []).length; index++) {
    const raw=incoming[index];
    const sourceId = raw.sourceItemId || raw.id || null;
    const key = visibleKey(raw);
    if ((sourceId && (ids.has(sourceId) || alreadyImportedIds.has(sourceId))) || keys.has(key)) { skipped++; continue; }
    const stamp=new Date(createdBase+index).toISOString();
    const item = {...raw,id:crypto.randomUUID(),sourceItemId:sourceId,state:SHOPPING_STATES.includes(raw.state)?raw.state:'pending',order:order++,createdAt:stamp,modifiedAt:stamp};
    merged.push(item); keys.add(key); if (sourceId) alreadyImportedIds.add(sourceId); added++;
  }
  return {items:merged,added,skipped};
}
