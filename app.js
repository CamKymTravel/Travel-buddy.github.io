import {ensureSeedData,getAll,getRecord,putRecord,deleteRecord,resetDatabase,atomicWrite} from './db.js';
import {
  BUILD_VERSION,EXPENSE_CATEGORIES,SHOPPING_STATES,MAX_IMPORT_BYTES,MAX_IMPORT_ITEMS,
  validateAuDate,auDateToSort,isoDateToAu,auDateToIso,todayAu,formatAud,formatLocal,
  expenseSortNewest,shoppingSortStable,nextShoppingOrder,finishShopping,normalizeInitials,
  nonBlank,buildExpenseRecord,validateShoppingEnvelope,normalizeShoppingImportItem,mergeImportedShopping
} from './logic.js';
import {COUNTRIES,findCountry} from './country-data.js';
import {productArt,categoryHeroArt} from './product-art.js';

const screen=document.querySelector('#screen');
const app=document.querySelector('#app');
const bottomNav=document.querySelector('#bottomNav');
const launch=document.querySelector('#launch');
const launchBrand=document.querySelector('#launchBrand');
const launchStay=document.querySelector('#launchStay');
const navButtons=[...document.querySelectorAll('.nav-item')];
const importInput=document.querySelector('#shoppingImportFile');
const dialogRoot=document.querySelector('#dialogRoot');

let route='home';
let currentStay=null;
let expenseFilter='pending';
let shoppingFilter='all';
let expenseReturnRoute='expenses';
let justFinishedShopping=false;
let regularEditorReturn='settings';
let personEditorReturn='people';

const mealIdeas=['Pasta night','Tacos','Stir-fry','BBQ','Salad night','Breakfast for dinner'];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const id=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const stayRate=stay=>{const n=Number(stay?.exchangeRate);return Number.isFinite(n)&&n>0?n:null;};
const shortAuDate=value=>{const m=String(value||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return String(value||'');const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${Number(m[1])} ${names[Number(m[2])-1]||m[2]} ${m[3]}`;};
const toneKey=value=>{const v=String(value||'').toLowerCase();if(v.includes('shopping'))return'shopping';if(v.includes('expense'))return'expenses';if(v.includes('setting'))return'settings';return'home';};
const pageHeadVisual=tone=>{
  const art={
    home:`<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="23" fill="#15566d"/><circle cx="36" cy="36" r="17" fill="#0b2531" stroke="#6dd9ed" stroke-width="2.5"/><path d="m43 24-5 14-14 6 5-14 14-6Z" fill="#f0c864"/><circle cx="36" cy="36" r="3" fill="#f7fdff"/></svg>`,
    expenses:`<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="16" y="10" width="40" height="51" rx="8" fill="#0f607c"/><path d="M25 23h22M25 33h15M25 43h19" stroke="#a8effa" stroke-width="4" stroke-linecap="round"/><circle cx="51" cy="51" r="12" fill="#34b9e4"/><path d="M51 44v14M44 51h14" stroke="#f7fdff" stroke-width="3.6" stroke-linecap="round"/></svg>`,
    shopping:`<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M16 22h40l-5 36H21l-5-36Z" fill="#bb8124"/><path d="M25 24c0-9 4-14 11-14s11 5 11 14" fill="none" stroke="#ffe19a" stroke-width="4" stroke-linecap="round"/><circle cx="29" cy="38" r="7" fill="#55cdb8"/><circle cx="44" cy="38" r="7" fill="#d98297"/><path d="M27 50h18" stroke="#fff0bf" stroke-width="3" stroke-linecap="round"/></svg>`,
    settings:`<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M15 21h42M15 36h42M15 51h42" stroke="#a8bdca" stroke-width="5" stroke-linecap="round"/><circle cx="29" cy="21" r="8" fill="#5ec9df"/><circle cx="47" cy="36" r="8" fill="#b387e5"/><circle cx="24" cy="51" r="8" fill="#e1b44c"/></svg>`
  }[tone]||'';
  return `<span class="page-head-visual" aria-hidden="true">${art}</span>`;
};
const pageHead=(title,subtitle='',accent='Travel Buddy')=>{const tone=toneKey(accent);return `<div class="page-head head-${tone}"><div class="page-head-copy"><p class="eyebrow">${esc(accent)}</p><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${pageHeadVisual(tone)}</div>`;};
const categoryTone=category=>{const v=String(category?.name||category||'').toLowerCase();if(v.includes('fruit')||v.includes('veg'))return'teal';if(v.includes('meat'))return'copper';if(v.includes('dairy'))return'blue';if(v.includes('bakery'))return'gold';if(v.includes('pantry'))return'purple';if(v.includes('frozen'))return'ice';if(v.includes('drink'))return'cyan';if(v.includes('house'))return'green';if(v.includes('toilet'))return'rose';if(v.includes('pharmacy'))return'red';return'silver';};
const expenseTone=category=>({Groceries:'teal','Eating Out':'gold',Transport:'blue',Entertainment:'purple',Tickets:'copper',Shopping:'rose',Misc:'silver'})[category]||'silver';



const expenseCategoryIcon=category=>{
  const path={
    Groceries:'<path d="M7 8h10l1 11H6L7 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    'Eating Out':'<path d="M7 4v7M4.5 4v4a2.5 2.5 0 0 0 5 0V4M7 11v9M15 4v16M15 4c3 1 4 3 4 6h-4"/>',
    Transport:'<rect x="4" y="6" width="16" height="10" rx="3"/><path d="M7 16v2M17 16v2M7 11h10M8 8h8"/>',
    Entertainment:'<path d="M5 7h14l-1.5 10h-11L5 7Z"/><path d="M8 7V5h8v2M9 11l2 2 4-4"/>',
    Tickets:'<path d="M5 7h14v3a2 2 0 0 0 0 4v3H5v-3a2 2 0 0 0 0-4V7Z"/><path d="M12 8v8"/>',
    Shopping:'<path d="M4 6h2l2 9h9l2-6H7"/><circle cx="10" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/>',
    Misc:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'
  }[category]||'<circle cx="12" cy="12" r="7"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
};

const expenseCategoryArt=category=>{
  const art={
    Groceries:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 24h36l-4 29H18L14 24Z" fill="#2c9f8e"/><path d="M20 24c1-8 6-12 12-12s11 4 12 12" fill="none" stroke="#89eee0" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="29" r="8" fill="#ef5b56"/><path d="M25 21c2-4 6-5 9-3-3 4-6 5-9 3Z" fill="#64cf70"/><path d="M34 28c1-7 6-11 12-10 0 6-4 11-12 10Z" fill="#69cf6e"/><circle cx="41" cy="38" r="7" fill="#f2b64d"/></svg>`,
    'Eating Out':`<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="34" cy="42" rx="22" ry="10" fill="#d4a43f"/><ellipse cx="34" cy="39" rx="18" ry="7" fill="#f2e0a2"/><path d="M22 37c5-8 11-10 17-7 4 2 7 5 9 8" fill="none" stroke="#e46f43" stroke-width="5" stroke-linecap="round"/><circle cx="33" cy="31" r="3" fill="#de5144"/><path d="M37 27c5-5 9-4 12-1-5 2-8 3-12 1Z" fill="#69c774"/><path d="M11 12v17M7 12v9c0 4 2 6 4 6s4-2 4-6v-9M11 29v23" fill="none" stroke="#f5cf64" stroke-width="3.4" stroke-linecap="round"/></svg>`,
    Transport:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="13" y="10" width="38" height="39" rx="10" fill="#348bc2"/><rect x="19" y="16" width="26" height="15" rx="4" fill="#9de5f5"/><path d="M20 38h24" stroke="#d8f7ff" stroke-width="4" stroke-linecap="round"/><circle cx="23" cy="41" r="3" fill="#e9fbff"/><circle cx="41" cy="41" r="3" fill="#e9fbff"/><path d="M21 49l-5 7M43 49l5 7M22 55h20" fill="none" stroke="#66c3ee" stroke-width="3.3" stroke-linecap="round"/></svg>`,
    Entertainment:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 25h30l-4 31H22L18 25Z" fill="#8b63cf"/><path d="M23 25l4 31M33 25v31M43 25l-4 31" stroke="#f2dff8" stroke-width="4" opacity=".9"/><circle cx="20" cy="20" r="7" fill="#f5d46c"/><circle cx="30" cy="16" r="8" fill="#ffe18a"/><circle cx="40" cy="19" r="7" fill="#f5d46c"/><circle cx="48" cy="17" r="6" fill="#ffe18a"/></svg>`,
    Tickets:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 20h44v11c-5 0-5 8 0 8v11H10V39c5 0 5-8 0-8V20Z" fill="#c98055"/><path d="M32 23v24" stroke="#f7d5bd" stroke-width="3" stroke-dasharray="4 4"/><circle cx="23" cy="35" r="6" fill="#f4b36d"/><path d="m21 35 2 2 4-5" fill="none" stroke="#fff2df" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    Shopping:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 22h34l-3 34H18L15 22Z" fill="#c86f91"/><path d="M23 25c0-8 4-13 9-13s9 5 9 13" fill="none" stroke="#f5b8cf" stroke-width="4" stroke-linecap="round"/><rect x="25" y="34" width="14" height="12" rx="3" fill="#f3d2df"/><path d="M32 36v8M28 40h8" stroke="#a74b73" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    Misc:`<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="21" fill="#7f93a5"/><path d="m32 14 4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" fill="#e8f1f7"/><circle cx="48" cy="16" r="5" fill="#70d5e8"/><circle cx="15" cy="48" r="4" fill="#d9ae58"/></svg>`
  }[category];
  return art||`<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="#7f93a5"/><circle cx="32" cy="32" r="5" fill="#eef6fb"/></svg>`;
};

const expenseCategoryVisual=category=>`<span class="expense-illustration" aria-hidden="true">${expenseCategoryArt(category)}</span><span class="expense-line-badge" aria-hidden="true">${expenseCategoryIcon(category)}</span>`;

const expenseStatusIcon=kind=>{
  const path={
    pending:'<path d="M5 12h8"/><path d="m10 7 5 5-5 5"/><rect x="4" y="5" width="16" height="14" rx="3"/>',
    transferred:'<path d="m6.5 12 3.2 3.2L17.5 7.5"/><rect x="4" y="5" width="16" height="14" rx="3"/>',
    all:'<path d="M7 8h10M7 12h10M7 16h6"/><rect x="4" y="5" width="16" height="14" rx="3"/>',
    add:'<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="8"/>'
  }[kind]||'<circle cx="12" cy="12" r="8"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
};

const expenseStatusArt=kind=>{
  const art={
    add:`<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="18" y="10" width="36" height="50" rx="8" fill="#0f5872"/><path d="M26 22h20M26 31h13M26 40h10" stroke="#a8effa" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="13" fill="#35b9e6"/><path d="M50 43v14M43 50h14" stroke="#f7fdff" stroke-width="4" stroke-linecap="round"/></svg>`,
    pending:`<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="12" y="20" width="46" height="34" rx="9" fill="#a66d17"/><rect x="17" y="16" width="39" height="32" rx="8" fill="#d9911d"/><path d="M17 27h39" stroke="#ffd979" stroke-width="3"/><circle cx="53" cy="49" r="12" fill="#f2b42a"/><path d="M48 49h10M55 45l4 4-4 4" stroke="#fff7d8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    transferred:`<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M12 35 60 14 45 58 34 42 12 35Z" fill="#23bda4"/><path d="m34 42 26-28" stroke="#b7fff1" stroke-width="4" stroke-linecap="round"/><circle cx="51" cy="51" r="12" fill="#167a6d"/><path d="m45.5 51 4 4 7-9" fill="none" stroke="#eafff9" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    all:`<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="13" y="37" width="11" height="21" rx="4" fill="#8f67d9"/><rect x="30" y="26" width="11" height="32" rx="4" fill="#bb76e8"/><rect x="47" y="15" width="11" height="43" rx="4" fill="#d58cf0"/><path d="M13 61h47" stroke="#f0d9fb" stroke-width="3" stroke-linecap="round"/></svg>`,
    empty:`<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="17" y="9" width="38" height="51" rx="8" fill="#123d50"/><path d="M25 23h22M25 33h18M25 43h13" stroke="#7dd7ed" stroke-width="4" stroke-linecap="round"/><circle cx="52" cy="52" r="11" fill="#2f99bf"/><path d="M52 46v12M46 52h12" stroke="#ecfbff" stroke-width="3.5" stroke-linecap="round"/></svg>`
  }[kind]||'';
  return `<span class="expense-status-art expense-status-${esc(kind)}" aria-hidden="true">${art}</span>`;
};

const categoryArt=category=>{
  const name=String(category?.name||category||'').toLowerCase();
  let path='<path d="M5 12h14M12 5v14"/>';
  if(name.includes('fruit')||name.includes('veg'))path='<path d="M12 19c-4 0-7-3-7-7 0-3 2-6 6-6 1 0 2 .3 3 1 1-2 3-3 5-3-1 3-3 5-5 5 1 1 2 3 2 5 0 4-3 7-7 7Z"/><path d="M13 7c0-2 1-4 3-5"/>';
  else if(name.includes('meat'))path='<path d="M5 15c0-4 3-8 8-9 4-1 7 2 6 6-1 4-5 7-9 7-3 0-5-1-5-4Z"/><circle cx="14" cy="11" r="2"/>';
  else if(name.includes('dairy'))path='<path d="M8 4h8l1 4v11H7V8l1-4Z"/><path d="M8 8h9M10 4v4"/>';
  else if(name.includes('bakery'))path='<path d="M5 15c0-4 3-7 7-7s7 3 7 7v3H5v-3Z"/><path d="M9 8c0-2 1-3 3-4M15 8c0-2 1-3 3-4"/>';
  else if(name.includes('pantry'))path='<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M6 9h12M9 13h6"/>';
  else if(name.includes('frozen'))path='<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M8.5 5.5 12 8l3.5-2.5M8.5 18.5 12 16l3.5 2.5"/>';
  else if(name.includes('drink'))path='<path d="M7 5h10l-1 15H8L7 5Z"/><path d="M9 9h6M13 5l2-3"/>';
  else if(name.includes('house'))path='<path d="M4 11 12 4l8 7v9h-6v-6h-4v6H4v-9Z"/>';
  else if(name.includes('toilet'))path='<path d="M8 4h8l1 5H7l1-5Z"/><path d="M7 9h10v3c0 4-2 7-5 8-3-1-5-4-5-8V9Z"/>';
  else if(name.includes('pharmacy'))path='<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V5h6v3M12 11v6M9 14h6"/>';
  else path='<path d="M5 7h14v12H5V7Z"/><path d="M8 7V5h8v2"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
};

const settingsIcon=kind=>{
  const map={
    people:'<circle cx="9" cy="8" r="3"/><path d="M4 19c0-4 2-6 5-6s5 2 5 6M16 9a2.5 2.5 0 1 1 0-5M16 13c2.5 0 4 2 4 5"/>',
    categories:'<path d="M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v4H4zM14 16h6v4h-6z"/>',
    regular:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z"/>',
    custom:'<path d="M4 17.5V20h2.5L18 8.5 15.5 6 4 17.5Z"/><path d="m14.5 7 2.5 2.5"/>',
    advanced:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 4v6M16 14v6"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
    transfer:'<path d="M5 7h11l-3-3M19 17H8l3 3"/>',
    rate:'<path d="M7 6h10M12 3v18M8 10c0 2 8 1 8 4s-8 2-8 4"/>',
    reset:'<path d="M5 8a8 8 0 1 1-1 7M5 8V3M5 8h5"/>'
  };
  return `<span class="settings-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${map[kind]||map.advanced}</svg></span>`;
};

const buttonVisual=kind=>{
  const art={
    back:'<circle cx="16" cy="16" r="13" fill="#285f79"/><path d="m17.5 9-7 7 7 7" fill="none" stroke="#eafaff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    add:'<circle cx="16" cy="16" r="13" fill="#2d9fc8"/><path d="M16 9v14M9 16h14" fill="none" stroke="#f3fdff" stroke-width="3" stroke-linecap="round"/>',
    save:'<circle cx="16" cy="16" r="13" fill="#23866e"/><path d="m9 16 4.2 4.2L23 10.5" fill="none" stroke="#effff8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    cancel:'<circle cx="16" cy="16" r="13" fill="#526676"/><path d="m11 11 10 10M21 11 11 21" stroke="#f5fbff" stroke-width="2.8" stroke-linecap="round"/>',
    delete:'<circle cx="16" cy="16" r="13" fill="#a44555"/><path d="M11 12h10l-1 11h-8l-1-11ZM13 9h6M14 14v6M18 14v6" fill="none" stroke="#fff0f3" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    edit:'<circle cx="16" cy="16" r="13" fill="#6f67b7"/><path d="M10 21l2-6 9-9 5 5-9 9-7 1Z" fill="#eadfff"/><path d="m19 8 5 5" stroke="#fff" stroke-width="2"/>',
    change:'<circle cx="16" cy="16" r="13" fill="#b47b25"/><path d="M8 12h14l-4-4M24 20H10l4 4" fill="none" stroke="#fff4ce" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    finish:'<circle cx="16" cy="16" r="13" fill="#2d8c64"/><path d="m9 16 4 4 10-10" fill="none" stroke="#f1fff7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    close:'<circle cx="16" cy="16" r="13" fill="#3d758d"/><path d="m11 11 10 10M21 11 11 21" stroke="#f4fcff" stroke-width="2.8" stroke-linecap="round"/>',
    share:'<circle cx="16" cy="16" r="13" fill="#b07d2d"/><circle cx="11" cy="16" r="3" fill="#fff3c9"/><circle cx="22" cy="10" r="3" fill="#fff3c9"/><circle cx="22" cy="22" r="3" fill="#fff3c9"/><path d="m13.7 14.5 5.6-3M13.7 17.5l5.6 3" stroke="#fff3c9" stroke-width="2" stroke-linecap="round"/>',
    import:'<circle cx="16" cy="16" r="13" fill="#378b79"/><path d="M16 7v13m-5-5 5 5 5-5M9 24h14" fill="none" stroke="#effff9" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
  }[kind]||'<circle cx="16" cy="16" r="13" fill="#526676"/>';
  return `<span class="button-visual button-${esc(kind)}" aria-hidden="true"><svg viewBox="0 0 32 32">${art}</svg></span>`;
};

const dialogVisual=tone=>{
  const kind=tone==='danger'?'delete':tone==='attention'?'finish':'save';
  return `<span class="dialog-visual dialog-visual-${esc(tone)}" aria-hidden="true">${buttonVisual(kind)}</span>`;
};

const miniActionVisual=kind=>{
  const art={
    view:'<circle cx="12" cy="12" r="10" fill="#245f7a"/><path d="M8 12h8M13 8l4 4-4 4" fill="none" stroke="#e9fbff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    add:'<circle cx="12" cy="12" r="10" fill="#278a76"/><path d="M12 7v10M7 12h10" stroke="#effff9" stroke-width="2.2" stroke-linecap="round"/>',
    finish:'<circle cx="12" cy="12" r="10" fill="#2d8c64"/><path d="m7.5 12 3 3 6-6" fill="none" stroke="#f1fff7" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
    edit:'<circle cx="12" cy="12" r="10" fill="#6f67b7"/><path d="M7.5 16.5 9 12l6-6 3 3-6 6-4.5 1.5Z" fill="#efe8ff"/><path d="m13.5 7.5 3 3" stroke="#fff" stroke-width="1.5"/>',
    rename:'<circle cx="12" cy="12" r="10" fill="#a87925"/><path d="M7 16.5 9 11l5.7-5.7 4 4L13 15l-6 1.5Z" fill="#fff1bd"/><path d="M7 18h10" stroke="#ffe59a" stroke-width="1.8" stroke-linecap="round"/>',
    delete:'<circle cx="12" cy="12" r="10" fill="#a44555"/><path d="M8.5 9h7l-.8 8h-5.4l-.8-8ZM10 7.5h4M10.5 11v4M13.5 11v4" fill="none" stroke="#fff0f3" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    cancel:'<circle cx="12" cy="12" r="10" fill="#526676"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7" stroke="#f5fbff" stroke-width="2" stroke-linecap="round"/>'
  }[kind]||'';
  return `<span class="mini-action-visual mini-action-${esc(kind)}" aria-hidden="true"><svg viewBox="0 0 24 24">${art}</svg></span>`;
};

const toiletVisual=()=>`<span class="wc-visual" aria-hidden="true"><svg viewBox="0 0 48 48"><rect x="5" y="5" width="38" height="38" rx="13" fill="#215b72"/><circle cx="18" cy="16" r="4" fill="#73d8eb"/><circle cx="31" cy="16" r="4" fill="#e3b84f"/><path d="M13 35v-9c0-4 2-6 5-6s5 2 5 6v9M26 35v-9c0-4 2-6 5-6s5 2 5 6v9" fill="none" stroke="#f4fbff" stroke-width="3" stroke-linecap="round"/></svg></span>`;

const settingsVisual=kind=>{
  const art={
    people:`<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="27" cy="25" r="11" fill="#58bde2"/><circle cx="48" cy="28" r="8" fill="#8c85e8"/><path d="M10 57c2-13 9-20 18-20s17 7 19 20" fill="#2e7ca0"/><path d="M39 56c2-10 7-15 13-15 6 0 10 5 11 15" fill="#665fb5"/></svg>`,
    categories:`<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="11" y="11" width="22" height="22" rx="6" fill="#55cdb8"/><rect x="39" y="11" width="22" height="22" rx="6" fill="#e4b94d"/><rect x="11" y="39" width="22" height="22" rx="6" fill="#6dbbe7"/><rect x="39" y="39" width="22" height="22" rx="6" fill="#b68ae8"/><path d="M18 22h8M46 22h8M18 50h8M46 50h8" stroke="#f7fbff" stroke-width="3" stroke-linecap="round"/></svg>`,
    regular:`<svg viewBox="0 0 72 72" aria-hidden="true"><path d="m36 9 7.5 15.2 16.8 2.4-12.2 11.9 2.9 16.7L36 47.3 21 55.2l2.9-16.7L11.7 26.6l16.8-2.4L36 9Z" fill="#d9ac40"/><path d="m27 36 6 6 13-15" fill="none" stroke="#fff4c8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    custom:`<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M16 49 45 20l9 9-29 29-12 2 3-11Z" fill="#9a78df"/><path d="m42 23 8 8" stroke="#eadfff" stroke-width="4"/><path d="M17 49l8 8" stroke="#f7f0ff" stroke-width="3"/><circle cx="54" cy="17" r="8" fill="#e3b44a"/></svg>`,
    advanced:`<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M14 21h44M14 36h44M14 51h44" stroke="#9fb6c6" stroke-width="5" stroke-linecap="round"/><circle cx="29" cy="21" r="8" fill="#5ec9df"/><circle cx="47" cy="36" r="8" fill="#b387e5"/><circle cx="24" cy="51" r="8" fill="#e1b44c"/></svg>`,
    transfer:`<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="13" y="15" width="32" height="42" rx="7" fill="#d09a2d"/><path d="M21 27h16M21 36h11" stroke="#fff0bd" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="48" r="14" fill="#2aa891"/><path d="M43 48h15M53 42l6 6-6 6" fill="none" stroke="#effff9" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    rate:`<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="26" cy="30" r="17" fill="#2f9b88"/><circle cx="47" cy="43" r="17" fill="#4d99c4"/><path d="M20 30h12M26 21v18M41 43h12M47 34v18" stroke="#eafff8" stroke-width="4" stroke-linecap="round"/><path d="M38 19c8 1 13 5 16 11M34 54c-8-1-13-5-16-11" fill="none" stroke="#bdeef6" stroke-width="3" stroke-linecap="round"/></svg>`,
    reset:`<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M19 23a24 24 0 1 1-5 25" fill="none" stroke="#d66d77" stroke-width="7" stroke-linecap="round"/><path d="M18 12v14H4" fill="none" stroke="#f3aab1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 24v16" stroke="#ffe6e8" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="49" r="3" fill="#ffe6e8"/></svg>`
  }[kind]||'';
  return `<span class="settings-icon premium-settings-visual" aria-hidden="true">${art}</span>`;
};

const TOILET_PHRASES={
  Germany:['de','ltr','Wo ist die Toilette?'],Austria:['de','ltr','Wo ist die Toilette?'],Switzerland:['de','ltr','Wo ist die Toilette?'],
  France:['fr','ltr','Où sont les toilettes ?'],Belgium:['fr','ltr','Où sont les toilettes ?'],Netherlands:['nl','ltr','Waar is het toilet?'],
  Spain:['es','ltr','¿Dónde está el baño?'],Portugal:['pt','ltr','Onde fica a casa de banho?'],Italy:['it','ltr','Dov’è il bagno?'],
  Greece:['el','ltr','Πού είναι η τουαλέτα;'],Cyprus:['el','ltr','Πού είναι η τουαλέτα;'],Hungary:['hu','ltr','Hol van a mosdó?'],Croatia:['hr','ltr','Gdje je WC?'],
  Czechia:['cs','ltr','Kde je toaleta?'],'Czech Republic':['cs','ltr','Kde je toaleta?'],Poland:['pl','ltr','Gdzie jest toaleta?'],Russia:['ru','ltr','Где туалет?'],Ukraine:['uk','ltr','Де туалет?'],
  Türkiye:['tr','ltr','Tuvalet nerede?'],Turkey:['tr','ltr','Tuvalet nerede?'],Egypt:['ar','rtl','أين الحمام؟'],Jordan:['ar','rtl','أين الحمام؟'],Morocco:['ar','rtl','أين الحمام؟'],Algeria:['ar','rtl','أين الحمام؟'],
  'United Arab Emirates':['ar','rtl','أين الحمام؟'],'Saudi Arabia':['ar','rtl','أين الحمام؟'],Israel:['he','rtl','איפה השירותים?'],Japan:['ja','ltr','トイレはどこですか？'],
  China:['zh','ltr','洗手间在哪里？'],Taiwan:['zh','ltr','洗手間在哪裡？'],'South Korea':['ko','ltr','화장실이 어디예요?'],Thailand:['th','ltr','ห้องน้ำอยู่ที่ไหน?'],Vietnam:['vi','ltr','Nhà vệ sinh ở đâu?'],
  Indonesia:['id','ltr','Di mana toilet?'],Malaysia:['ms','ltr','Di mana tandas?'],Philippines:['fil','ltr','Nasaan ang banyo?'],India:['hi','ltr','शौचालय कहाँ है?'],
  Mexico:['es','ltr','¿Dónde está el baño?'],Argentina:['es','ltr','¿Dónde está el baño?'],Chile:['es','ltr','¿Dónde está el baño?'],Brazil:['pt','ltr','Onde fica o banheiro?'],
  Australia:['en','ltr',"Where’s the toilet?"],'United Kingdom':['en','ltr',"Where’s the toilet?"],'United States':['en','ltr',"Where’s the restroom?"]
};
const toiletPhraseFor=country=>{const [lang,dir,text]=TOILET_PHRASES[country]||['en','ltr',"Where’s the toilet?"];return{lang,dir,text};};

let activeDialogCleanup=null;
function closeDialog(value){
  if(activeDialogCleanup){activeDialogCleanup();activeDialogCleanup=null;}
  dialogRoot.hidden=true;dialogRoot.innerHTML='';
  const resolver=closeDialog._resolver;closeDialog._resolver=null;
  const origin=closeDialog._origin;closeDialog._origin=null;
  if(origin&&origin.isConnected){try{origin.focus({preventScroll:true});}catch{}}
  if(resolver)resolver(value);
}
function openDialog({title,message='',tone='info',confirmLabel='OK',cancelLabel='',html='',dismissible=true}={}){
  if(!dialogRoot)return Promise.resolve(cancelLabel?false:true);
  if(activeDialogCleanup)closeDialog(false);
  const origin=document.activeElement instanceof HTMLElement?document.activeElement:null;
  return new Promise(resolve=>{
    closeDialog._resolver=resolve;closeDialog._origin=origin;
    dialogRoot.hidden=false;
    const confirmKind=tone==='danger'?'delete':tone==='attention'?'finish':confirmLabel==='Close'?'close':'save';
    dialogRoot.innerHTML=`<div class="dialog-backdrop"><section class="app-dialog dialog-${esc(tone)}" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><div class="dialog-accent"></div>${dialogVisual(tone)}<h2 id="dialogTitle">${esc(title)}</h2>${message?`<p>${esc(message)}</p>`:''}${html}<div class="dialog-actions">${cancelLabel?`<button class="btn secondary" type="button" data-dialog-cancel>${buttonVisual('cancel')}<span>${esc(cancelLabel)}</span></button>`:''}<button class="btn ${tone==='danger'?'danger':tone==='attention'?'warm':'primary'}" type="button" data-dialog-confirm>${buttonVisual(confirmKind)}<span>${esc(confirmLabel)}</span></button></div></section></div>`;
    const backdrop=dialogRoot.querySelector('.dialog-backdrop');
    const onClick=e=>{if(e.target.closest('[data-dialog-confirm]'))closeDialog(true);else if(e.target.closest('[data-dialog-cancel]'))closeDialog(false);else if(dismissible&&e.target===backdrop)closeDialog(cancelLabel?false:true);};
    const onKey=e=>{
      if(e.key==='Escape'&&dismissible){closeDialog(cancelLabel?false:true);return;}
      if(e.key!=='Tab')return;
      const focusables=[...dialogRoot.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden&&el.offsetParent!==null);
      if(!focusables.length){e.preventDefault();return;}
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    dialogRoot.addEventListener('click',onClick);document.addEventListener('keydown',onKey);
    activeDialogCleanup=()=>{dialogRoot.removeEventListener('click',onClick);document.removeEventListener('keydown',onKey);};
    requestAnimationFrame(()=>dialogRoot.querySelector('[data-dialog-confirm]')?.focus());
  });
}
const showMessage=(title,message,options={})=>openDialog({title,message,...options});
const askConfirm=(title,message,options={})=>openDialog({title,message,cancelLabel:'Cancel',confirmLabel:'Confirm',tone:'danger',...options});

function showToiletPhrase(){
  if(!currentStay)return;
  const phrase=toiletPhraseFor(currentStay.country);
  const html=`<div class="phrase-destination"><span class="phrase-flag">${esc(currentStay.flag||'')}</span><span><strong>${esc(currentStay.country)} · ${esc(currentStay.city)}</strong><small>Quick phrase · offline</small></span></div><div class="phrase-english">Where’s the toilet?</div><div class="phrase-local" lang="${esc(phrase.lang)}" dir="${esc(phrase.dir)}">${esc(phrase.text)}</div>`;
  return openDialog({title:'Where’s the toilet?',html,tone:'info',confirmLabel:'Close'});
}

function resetView(focusSelector=null){
  try{window.scrollTo({top:0,left:0,behavior:'auto'});}catch{}
  if(document.scrollingElement) document.scrollingElement.scrollTop=0;
  screen.scrollTop=0;
  requestAnimationFrame(()=>{
    const focusTarget=focusSelector?screen.querySelector(focusSelector):screen;
    if(!focusTarget)return;
    try{focusTarget.focus({preventScroll:!focusSelector});}catch{try{focusTarget.focus();}catch{}}
  });
}

function present(html,{subscreen=false,focusSelector=null}={}){
  screen.innerHTML=html;
  const hideNav=subscreen||!currentStay;
  bottomNav.hidden=hideNav;
  app.classList.toggle('subscreen-mode',subscreen);
  app.classList.toggle('setup-mode',!currentStay);
  resetView(focusSelector);
}

function setNavigationEnabled(enabled){
  bottomNav.hidden=!enabled;
  app.classList.toggle('setup-mode',!enabled);
  if(enabled)app.classList.remove('subscreen-mode');
}

function setRoute(next){
  route=next;
  app.dataset.route=route;
  navButtons.forEach(button=>{
    const active=button.dataset.route===route;
    button.classList.toggle('is-active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
}

async function loadCurrentStay(){
  const setting=await getRecord('settings','currentStayId');
  currentStay=setting?.value?await getRecord('stays',setting.value):null;
  if(!currentStay)return;
  if(!validateAuDate(currentStay.startDate)||!validateAuDate(currentStay.endDate)){currentStay=null;return;}
  const ref=findCountry(currentStay.country);
  if(ref&&(currentStay.flag!==ref.flag||currentStay.currencyCode!==ref.currencyCode||currentStay.currencyName!==ref.currencyName||currentStay.currencySymbol!==ref.currencySymbol)){
    currentStay={...currentStay,flag:ref.flag,currencyCode:ref.currencyCode,currencyName:ref.currencyName,currencySymbol:ref.currencySymbol,modifiedAt:now()};
    await putRecord('stays',currentStay);
  }
}

async function renderRoute(next=route){
  if(!currentStay){setRoute('settings');setNavigationEnabled(false);return stayEditor('setup',true);}
  setRoute(next);
  setNavigationEnabled(true);
  if(route==='home')await renderHome();
  else if(route==='expenses')await renderExpenses();
  else if(route==='shopping')await renderShopping();
  else await renderSettings();
}

function shoppingActionIcon(kind){
  const art={
    got:'<circle cx="12" cy="12" r="9" fill="#2da884"/><path d="m7.4 12.1 3.1 3.1 6.4-7" fill="none" stroke="#effff8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    undo:'<circle cx="12" cy="12" r="9" fill="#556fc5"/><path d="M10 8 6 12l4 4" fill="none" stroke="#f2f4ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 12h6.2c3 0 5 1.8 5 4.7" fill="none" stroke="#dfe5ff" stroke-width="2.2" stroke-linecap="round"/>',
    unavailable:'<circle cx="12" cy="12" r="9" fill="#c96778"/><path d="m7.5 16.5 9-9" fill="none" stroke="#fff2f5" stroke-width="2.4" stroke-linecap="round"/>',
    add:'<circle cx="12" cy="12" r="9" fill="#b88327"/><path d="M12 7v10M7 12h10" fill="none" stroke="#fff7dc" stroke-width="2.4" stroke-linecap="round"/>'
  }[kind]||'<circle cx="12" cy="12" r="9" fill="#5b7688"/>';
  return `<span class="action-line-icon premium-action-icon action-${esc(kind)}" aria-hidden="true"><svg viewBox="0 0 24 24">${art}</svg></span>`;
}

function shoppingHeaderArt(){
  return `<span class="shopping-title-visual" aria-hidden="true"><svg viewBox="0 0 72 72"><path d="M14 24h44l-5 35H20l-6-35Z" fill="#b67f25"/><path d="M24 25c0-10 5-15 12-15s12 5 12 15" fill="none" stroke="#ffe09a" stroke-width="4" stroke-linecap="round"/><circle cx="28" cy="39" r="7" fill="#55cdb8"/><circle cx="44" cy="39" r="7" fill="#d9829b"/><path d="M27 51h18" stroke="#fff0bd" stroke-width="3.2" stroke-linecap="round"/><path d="m53 15 2 4 4 .8-3 3 .7 4.2-3.7-2-3.8 2 .8-4.2-3-3 4.1-.8 1.9-4Z" fill="#72dff1"/></svg></span>`;
}

function shoppingEmptyArt(){
  return `<span class="premium-empty-art shopping-empty-art" aria-hidden="true"><svg viewBox="0 0 72 72"><path d="M14 25h44l-5 34H20l-6-34Z" fill="#b98127"/><path d="M24 26c0-10 5-15 12-15s12 5 12 15" fill="none" stroke="#ffe19d" stroke-width="4" stroke-linecap="round"/><circle cx="28" cy="41" r="7" fill="#55cdb8"/><circle cx="44" cy="41" r="7" fill="#d9829b"/><circle cx="56" cy="17" r="10" fill="#2fa9c8"/><path d="M56 11v12M50 17h12" stroke="#effcff" stroke-width="3.2" stroke-linecap="round"/></svg></span>`;
}

function peopleEmptyArt(){
  return `<span class="premium-empty-art people-empty-art" aria-hidden="true"><svg viewBox="0 0 72 72"><circle cx="28" cy="25" r="11" fill="#58bde2"/><circle cx="48" cy="29" r="8" fill="#9c88e9"/><path d="M10 59c2-14 9-21 19-21s17 7 19 21" fill="#2e7ca0"/><path d="M40 58c2-10 7-15 13-15s10 5 11 15" fill="#6d62ba"/><circle cx="57" cy="17" r="9" fill="#e1b44c"/><path d="M57 12v10M52 17h10" stroke="#fff5cf" stroke-width="3" stroke-linecap="round"/></svg></span>`;
}

function regularItemsButtonArt(){
  return `<span class="shopping-menu-art" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="m24 7 4.6 9.2 10.2 1.5-7.4 7.2 1.8 10.2L24 30.2l-9.2 4.9 1.8-10.2-7.4-7.2 10.2-1.5L24 7Z" fill="#e5b94f"/><path d="m18.5 24 3.7 3.7 7.6-8.4" fill="none" stroke="#fff4c6" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
}

function stayFieldIcon(kind){
  const art={
    country:'<circle cx="20" cy="20" r="15" fill="#236f88"/><path d="M6 20h28M20 5c6 6 6 24 0 30M20 5c-6 6-6 24 0 30" fill="none" stroke="#a9eff8" stroke-width="2.6" stroke-linecap="round"/>',
    city:'<path d="M20 36S33 24 33 15a13 13 0 1 0-26 0c0 9 13 21 13 21Z" fill="#b78028"/><circle cx="20" cy="15" r="5" fill="#fff0bf"/><circle cx="20" cy="15" r="2.2" fill="#d39c35"/>',
    start:'<rect x="6" y="8" width="28" height="27" rx="6" fill="#277e66"/><rect x="6" y="8" width="28" height="8" rx="6" fill="#55c59f"/><path d="M12 5v7M28 5v7" stroke="#dff8ee" stroke-width="2.6" stroke-linecap="round"/><path d="M12 22h7M12 28h10" stroke="#effff8" stroke-width="2.8" stroke-linecap="round"/>',
    end:'<rect x="6" y="8" width="28" height="27" rx="6" fill="#6f57a1"/><rect x="6" y="8" width="28" height="8" rx="6" fill="#a483d8"/><path d="M12 5v7M28 5v7" stroke="#f1e8ff" stroke-width="2.6" stroke-linecap="round"/><path d="M19 22v8M15 26h8" stroke="#fbf8ff" stroke-width="2.8" stroke-linecap="round"/>'
  }[kind]||'<circle cx="20" cy="20" r="14" fill="#526676"/>';
  return `<span class="field-label-icon field-label-${esc(kind)} premium-stay-symbol" aria-hidden="true"><svg viewBox="0 0 40 40">${art}</svg></span>`;
}

function subscreenBack(label='Shopping',attr='data-back-shopping'){
  return `<button class="subscreen-back-button premium-back-button" type="button" ${attr}>${buttonVisual('back')}<span>${esc(label)}</span></button>`;
}

function shoppingFilterVisual(kind){
  const art={
    all:'<rect x="4" y="5" width="16" height="14" rx="5" fill="#7e6226"/><circle cx="9" cy="10" r="2.2" fill="#55cdb8"/><circle cx="15" cy="10" r="2.2" fill="#d9829b"/><path d="M8 15h8" stroke="#ffe8ae" stroke-width="2" stroke-linecap="round"/>',
    'to-buy':'<path d="M5 8h14l-2 11H7L5 8Z" fill="#b37c27"/><path d="M9 9c0-4 1.5-6 3-6s3 2 3 6" fill="none" stroke="#ffe2a0" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="17" r="4" fill="#4cb8d6"/><path d="M17 14.5v5M14.5 17h5" stroke="#f3fdff" stroke-width="1.8" stroke-linecap="round"/>',
    done:'<circle cx="12" cy="12" r="9" fill="#2d9f7d"/><path d="m7.5 12 3 3 6-7" fill="none" stroke="#effff7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
  }[kind]||'';
  return `<span class="shopping-filter-visual shopping-filter-${esc(kind)}" aria-hidden="true"><svg viewBox="0 0 24 24">${art}</svg></span>`;
}

function shoppingCounts(items){
  const got=items.filter(item=>item.state==='got').length;
  const unavailable=items.filter(item=>item.state==='couldnt').length;
  const pending=items.filter(item=>item.state==='pending').length;
  return {all:items.length,pending,got,unavailable,done:got+unavailable};
}

function shoppingStateLabel(state){return state==='got'?'Got It':state==='couldnt'?"Couldn’t Get":'To Buy';}

function shoppingPreviewMarkup({itemName='',categoryName='Other',requesterName='',requesterInitials='',eyebrow='Shopping Item'}={}){
  const title=String(itemName||'').trim()||'Item name';
  const category=String(categoryName||'Other');
  const requester=requesterName?` · ${requesterName}`:'';
  return `<div class="shopping-editor-preview" data-tone="${categoryTone(category)}"><span class="shopping-editor-preview-art product-art" aria-hidden="true">${productArt(title,category)}</span><span class="shopping-editor-preview-copy"><small>${esc(eyebrow)}</small><strong>${esc(title)}</strong><em>${esc(category+requester)}</em></span>${requesterInitials?`<span class="preview-requester">${esc(requesterInitials)}</span>`:''}</div>`;
}

function stayHero(stay=currentStay){
  if(!stay)return'';
  return `<button type="button" class="hero compact-hero stay-hero-action" data-toilet-phrase aria-label="${esc(stay.country)} ${esc(stay.city)}. Open toilet phrase helper."><div class="hero-top"><div class="flag-plate"><div class="flag">${esc(stay.flag||'◉')}</div></div><div class="hero-copy"><p class="eyebrow">Travel Buddy · Current Stay</p><h2>${esc(stay.country)}</h2><p>${esc(stay.city)}</p></div><span class="wc-badge premium-wc-badge" aria-hidden="true">${toiletVisual()}<small>Phrase</small></span></div><div class="hero-meta"><span class="pill">${esc(stay.startDate)} – ${esc(stay.endDate)}</span><span class="pill currency-pill">${esc(stay.currencyCode)}</span></div></button>`;
}

function stayStrip(){
  return currentStay?`<div class="screen-title-strip compact"><div class="flag-plate mini-flag"><div class="flag">${esc(currentStay.flag||'◉')}</div></div><div class="stay-strip-copy"><strong>${esc(currentStay.country)} · ${esc(currentStay.city)}</strong><small>${esc(currentStay.startDate)} – ${esc(currentStay.endDate)} · ${esc(currentStay.currencyCode)}</small></div></div>`:'';
}

function emptyCard(text,button,label,kind='empty'){
  const icon=kind==='shopping'?shoppingEmptyArt():kind==='people'?peopleEmptyArt():kind==='expenses'?expenseStatusArt('empty'):'<span class="premium-empty-art generic-empty-art"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="24" fill="#425a69"/><path d="M36 24v24M24 36h24" stroke="#eef6fa" stroke-width="5" stroke-linecap="round"/></svg></span>';
  const emptyTone=kind==='shopping'?'gold':kind==='people'?'blue':kind==='expenses'?'blue':'silver';
  const emptyActionIcon=label&&/^Add\b/i.test(label)?buttonVisual('add'):'';
  return `<div class="card empty premium-empty" data-tone="${emptyTone}"><span class="empty-icon" aria-hidden="true">${icon}</span><strong>${esc(text)}</strong>${button?`<button class="btn primary full" ${button}>${emptyActionIcon}<span>${esc(label)}</span></button>`:''}</div>`;
}

function expenseRow(expense,origin=route,{showTransfer=true}={}){
  const secondary=expense.audAmount!==null&&expense.audAmount!==undefined?formatAud(expense.audAmount):'';
  return `<div class="list-row expense-row" data-tone="${expenseTone(expense.category)}"><button class="expense-open" type="button" data-edit-expense="${esc(expense.id)}" data-return-route="${esc(origin)}" aria-label="Edit ${esc(expense.note||expense.category)} expense"><span class="expense-category-icon" aria-hidden="true">${expenseCategoryVisual(expense.category)}</span><span class="expense-copy"><strong>${esc(expense.note||expense.category)}</strong><small>${esc(expense.date)} · ${esc(expense.category)}</small></span><span class="amount"><strong>${formatLocal(expense.localAmount,expense.currencyCode)}</strong>${secondary?`<small>${secondary}</small>`:''}</span><span class="expense-row-chevron" aria-hidden="true">›</span></button>${showTransfer?`<button class="mini transfer-button ${expense.transferred?'is-done':'transfer-wait'}" data-toggle-transfer="${esc(expense.id)}" aria-pressed="${expense.transferred?'true':'false'}"><span class="transfer-button-icon" aria-hidden="true">${expenseStatusIcon(expense.transferred?'transferred':'pending')}</span>${expense.transferred?'Transferred':'To Transfer'}</button>`:''}</div>`;
}

async function renderHome(){
  const [expenses,shoppingRaw,people,categories]=await Promise.all([getAll('expenses'),getAll('shoppingItems'),getAll('people'),getAll('categories')]);
  const shopping=[...shoppingRaw].sort(shoppingSortStable);
  const pending=expenses.filter(expense=>!expense.transferred).sort(expenseSortNewest);
  const recent=[...expenses].sort(expenseSortNewest).slice(0,3);
  const counts=shoppingCounts(shopping);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const homeItems=shopping.slice(0,2);
  const homeArt=homeItems.length?homeItems.map(item=>{const category=categoryMap.get(item.categoryId);return `<span class="home-shopping-art product-art" data-item-name="${esc(item.itemName)}" data-state="${esc(item.state)}" aria-hidden="true">${productArt(item.itemName,category?.name||'Other')}</span>`;}).join(''):`<span class="home-shopping-empty-art premium-home-shopping-empty" aria-hidden="true">${shoppingEmptyArt()}</span>`;
  const shoppingStatus=shopping.length?`${counts.pending} to buy · ${counts.got} got · ${counts.unavailable} unavailable`:'Ready for your next shop';
  present(`${stayHero()}
    <div class="home-core-actions">
      <button class="home-action expense-home" data-add-expense><span class="home-action-icon premium-home-expense-art" aria-hidden="true">${expenseStatusArt('add')}</span><span class="home-action-copy"><strong>Add Expense</strong><small>Quick ${esc(currentStay.currencyCode)} capture</small></span><span class="home-action-arrow" aria-hidden="true">›</span></button>
      <button class="home-action shopping-home" data-open-shopping><span class="home-shopping-pictures">${homeArt}</span><span class="home-action-copy"><strong>Shopping List</strong><small>${esc(shoppingStatus)}</small></span><span class="home-action-arrow" aria-hidden="true">›</span></button>
    </div>
    <button class="transfer-summary premium-transfer" data-open-expenses><span class="transfer-icon premium-transfer-art" aria-hidden="true">${expenseStatusArt('pending')}</span><span class="transfer-copy"><strong>Expenses to transfer</strong><small>${pending.length?'Waiting to enter in Travel Command Centre':'Nothing waiting'}</small></span><span class="transfer-count">${pending.length}</span></button>
    <div class="section-title-row"><h3 class="section-title">Recent Expenses</h3><button class="section-link premium-section-link" type="button" data-open-expenses><span>View all</span>${miniActionVisual('view')}</button></div><div class="list home-expense-list continuous-ledger">${recent.length?recent.map(expense=>expenseRow(expense,'home',{showTransfer:false})).join(''):emptyCard('No expenses yet','data-add-expense','Add Expense','expenses')}</div>`);
}
async function renderExpenses(){
  const expenses=await getAll('expenses');
  const pendingCount=expenses.filter(expense=>!expense.transferred).length;
  const transferredCount=expenses.length-pendingCount;
  let rows=[...expenses];
  if(expenseFilter==='pending')rows=rows.filter(expense=>!expense.transferred);
  else if(expenseFilter==='transferred')rows=rows.filter(expense=>expense.transferred);
  rows.sort(expenseSortNewest);
  const summary=[['pending','To Transfer',pendingCount],['transferred','Transferred',transferredCount],['all','All Expenses',expenses.length]];
  const listTitle=expenseFilter==='pending'?'To Transfer':expenseFilter==='transferred'?'Transferred':'Recent Expenses';
  const listHint=expenseFilter==='pending'?'Waiting to enter later':expenseFilter==='transferred'?'Already entered':'Newest first';
  present(`${pageHead('Expenses','Quick local spending capture.','Expenses')}${stayStrip()}
    <button class="btn primary full quick-add-button premium-add-expense-hero" data-add-expense><span class="quick-add-leading-icon" aria-hidden="true">${expenseStatusArt('add')}</span><span class="quick-add-copy"><strong>Add Expense</strong><small>Fast ${esc(currentStay.currencyCode)} capture</small></span><span class="quick-add-chevron" aria-hidden="true">›</span></button>
    <div class="expense-overview-band" aria-label="Expense filters">
      ${summary.map(([value,label,count])=>`<button type="button" class="expense-overview-card ${expenseFilter===value?'is-active':''}" data-expense-filter="${value}" aria-pressed="${expenseFilter===value?'true':'false'}"><span class="expense-overview-icon" aria-hidden="true">${expenseStatusArt(value)}</span><span class="expense-overview-number">${count}</span><span class="expense-overview-label">${label}</span><span class="expense-overview-chevron" aria-hidden="true">›</span></button>`).join('')}
    </div>
    <div class="section-title-row expense-list-title"><div><h3 class="section-title">${listTitle}</h3><span>${listHint}</span></div><b>${rows.length}</b></div>
    <div class="list continuous-ledger expense-ledger-shell">${rows.length?rows.map(expense=>expenseRow(expense,'expenses')).join(''):emptyCard(expenseFilter==='pending'?'Nothing waiting to transfer':expenseFilter==='transferred'?'Nothing transferred yet':'No expenses yet','data-add-expense','Add Expense','expenses')}</div>`);
}
function expenseEditor(existing=null,defaults={}){
  const stay=existing?.staySnapshot||currentStay;
  if(!stay)return stayEditor('setup',true);
  expenseReturnRoute=defaults.returnRoute||route||'expenses';
  const defaultDate=existing?.date||defaults.date||todayAu();
  const selectedCategory=existing?.category||defaults.category||'';
  const editing=!!existing;
  const rate=stayRate(stay);
  const initialAud=existing&&rate?Number(existing.localAmount)/rate:null;
  present(`${subscreenBack(expenseReturnRoute==='home'?'Home':'Expenses',`data-editor-cancel data-cancel-route="${esc(expenseReturnRoute)}"`)} ${pageHead(editing?'Edit Expense':'Add Expense',editing?'Update this spend.':'Fast local spend capture.','Expenses')}
    <form class="quick-expense-form expense-premium-form" id="expenseForm">
      <div class="expense-stay-context" aria-label="Current stay">
        <span class="expense-stay-flag" aria-hidden="true">${esc(stay.flag||'🌍')}</span>
        <span class="expense-stay-copy"><small>Current stay</small><strong>${esc(stay.city||stay.country||'Current stay')}</strong><em>${esc(stay.country||'')} · ${esc(stay.currencyCode)}</em></span>
        <span class="expense-rate-chip">${rate?`1 AUD = ${esc(rate)} ${esc(stay.currencyCode)}`:`${esc(stay.currencyCode)} only`}</span>
      </div>
      <section class="quick-amount-card premium-amount-card" aria-labelledby="amountHeading">
        <div class="amount-card-head"><span><small>Local spend</small><label id="amountHeading" for="expenseAmount">Amount</label></span><b>${esc(stay.currencyCode)}</b></div>
        <div class="amount-entry premium-amount-entry"><span class="amount-code">${esc(stay.currencyCode)}</span><input id="expenseAmount" name="localAmount" type="number" min="0.01" step="any" inputmode="decimal" autocomplete="off" placeholder="0" value="${existing?esc(existing.localAmount):''}" required></div>
        <div class="expense-amount-foot"><span>Enter what you paid locally</span><strong id="expenseAudPreview" aria-live="polite">${rate?(initialAud?formatAud(initialAud):'AUD —'):'AUD conversion off'}</strong></div>
      </section>
      <section class="expense-category-panel premium-category-panel" aria-labelledby="categoryHeading">
        <div class="expense-section-head"><span><small>Required</small><strong id="categoryHeading">What was it for?</strong></span><em id="categoryStatus" aria-live="polite" aria-atomic="true">${selectedCategory?esc(selectedCategory):'Choose one'}</em></div>
        <input type="hidden" name="category" id="expenseCategory" value="${esc(selectedCategory)}">
        <div class="expense-category-grid">${EXPENSE_CATEGORIES.map(category=>`<button type="button" class="expense-category-choice ${selectedCategory===category?'is-selected':''}" data-expense-category="${esc(category)}" data-tone="${expenseTone(category)}" aria-pressed="${selectedCategory===category?'true':'false'}"><span class="expense-choice-icon" aria-hidden="true">${expenseCategoryVisual(category)}</span><span class="expense-choice-copy"><strong>${esc(category)}</strong><small>${category==='Groceries'?'Food & supermarket':category==='Eating Out'?'Cafés & restaurants':category==='Transport'?'Taxi, train & fuel':category==='Entertainment'?'Fun & activities':category==='Tickets'?'Entry & attractions':category==='Shopping'?'Things you bought':'Anything else'}</small></span></button>`).join('')}</div>
      </section>
      <button class="btn primary full save-expense-button premium-save-expense" id="saveExpenseButton" type="submit" ${selectedCategory&&editing?'':'disabled'}>${buttonVisual('save')}<span>${editing?'Save Changes':'Save Expense'}</span></button>
      <details class="optional-details premium-optional-details" ${editing?'open':''}>
        <summary><span><small>Optional</small><strong>Date & note</strong></span></summary>
        <div class="optional-details-body">
          <label>Date<input name="date" type="date" value="${esc(auDateToIso(defaultDate))}" required></label>
          <label>Note <span class="hint">Optional</span><input name="note" maxlength="180" placeholder="Lunch, taxi, tickets…" value="${esc(existing?.note||'')}"></label>
          ${editing?'<p class="micro-note">Saving an edited expense marks it To Transfer again.</p>':''}
        </div>
      </details>
      <button class="btn secondary full expense-cancel-button" type="button" data-editor-cancel data-cancel-route="${esc(expenseReturnRoute)}">${buttonVisual('cancel')}<span>Cancel</span></button>
    </form>
    ${editing?`<button class="btn danger full delete-below" data-delete-expense="${esc(existing.id)}">${buttonVisual('delete')}<span>Delete Expense</span></button>`:''}`,
    {subscreen:true,focusSelector:editing?null:'#expenseAmount'});

  const form=screen.querySelector('#expenseForm');
  const amountInput=screen.querySelector('#expenseAmount');
  const categoryInput=screen.querySelector('#expenseCategory');
  const saveButton=screen.querySelector('#saveExpenseButton');
  const categoryStatus=screen.querySelector('#categoryStatus');
  const audPreview=screen.querySelector('#expenseAudPreview');
  const updateSaveState=()=>{
    const amount=Number(amountInput.value);
    const validAmount=Number.isFinite(amount)&&amount>0;
    const validCategory=EXPENSE_CATEGORIES.includes(categoryInput.value);
    saveButton.disabled=!(validAmount&&validCategory);
    if(audPreview){audPreview.textContent=rate?(validAmount?formatAud(amount/rate):'AUD —'):'AUD conversion off';}
  };
  amountInput.addEventListener('input',updateSaveState);
  screen.querySelectorAll('[data-expense-category]').forEach(button=>button.addEventListener('click',()=>{
    categoryInput.value=button.dataset.expenseCategory;
    categoryStatus.textContent=button.dataset.expenseCategory;
    screen.querySelectorAll('[data-expense-category]').forEach(choice=>{
      const selected=choice===button;choice.classList.toggle('is-selected',selected);choice.setAttribute('aria-pressed',selected?'true':'false');
    });
    updateSaveState();
  }));
  updateSaveState();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    const dateAu=isoDateToAu(data.date);
    if(!dateAu){await showMessage('Choose a date','Choose a valid expense date.');return;}
    const amount=Number(data.localAmount);
    if(!Number.isFinite(amount)||amount<=0){await showMessage('Enter an amount',`Enter the ${stay.currencyCode} amount.`);amountInput.focus();return;}
    if(!EXPENSE_CATEGORIES.includes(data.category)){await showMessage('Choose a category','Tap one category before saving.');return;}
    data.date=dateAu;
    try{
      const record=buildExpenseRecord({existing,form:data,stay});
      await putRecord('expenses',record);
      await renderRoute(expenseReturnRoute);
    }catch(error){console.error(error);await showMessage('Couldn’t save expense','Check the amount and try again.');}
  });
}

async function renderShopping(){
  const [itemsRaw,people,categories]=await Promise.all([getAll('shoppingItems'),getAll('people'),getAll('categories')]);
  const items=[...itemsRaw].sort(shoppingSortStable);
  const counts=shoppingCounts(items);
  const personMap=new Map(people.map(person=>[person.id,person]));
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  let shown=items;
  if(shoppingFilter==='to-buy')shown=items.filter(item=>item.state==='pending');
  if(shoppingFilter==='done')shown=items.filter(item=>item.state!=='pending');
  const resolvedPct=counts.all?Math.round(((counts.got+counts.unavailable)/counts.all)*100):0;
  const gotPct=counts.all?Math.round((counts.got/counts.all)*100):0;
  const unavailablePct=Math.max(0,resolvedPct-gotPct);
  const stayDate=shortAuDate(currentStay.startDate);
  present(`<header class="shopping-screen-head">
      <div class="shopping-screen-title"><p class="eyebrow">Shopping</p><h1>My Shopping List</h1><p>${esc(currentStay.city)}, ${esc(currentStay.country)}</p><span>${esc(stayDate)}</span></div>
      ${shoppingHeaderArt()}
      <button class="shopping-head-menu" type="button" data-regular-items aria-label="Regular Items">${regularItemsButtonArt()}</button>
    </header>
    ${items.length?`<div class="shopping-filterbar target-filterbar" role="group" aria-label="Shopping filters" aria-live="polite" aria-atomic="true">${[['all','All',counts.all],['to-buy','To Buy',counts.pending],['done','Done',counts.done]].map(([value,label,count])=>`<button class="shopping-filter ${shoppingFilter===value?'is-active':''}" type="button" data-shopping-filter="${value}" aria-pressed="${shoppingFilter===value?'true':'false'}">${shoppingFilterVisual(value)}<span>${label}</span><b>${count}</b></button>`).join('')}</div>`:''}
    ${items.length?`<div class="shopping-status-rail"><div class="shopping-progress" aria-label="${counts.got} got and ${counts.unavailable} unavailable out of ${counts.all}"><span class="shopping-progress-got" style="width:${gotPct}%"></span><span class="shopping-progress-unavailable" style="left:${gotPct}%;width:${unavailablePct}%"></span></div><button class="shopping-top-add premium-shop-action" type="button" data-add-shop>${miniActionVisual('add')}<span>Add</span></button><button class="finish-inline premium-shop-action" type="button" data-finish-shopping ${counts.got?'':'disabled'}>${miniActionVisual('finish')}<span>Finish</span></button></div>`:''}
    ${counts.unavailable?`<div class="shopping-unavailable-note"><span aria-hidden="true">${shoppingActionIcon('unavailable')}</span><strong>${counts.unavailable} unavailable</strong><small>${counts.unavailable===1?'This item will':'These items will'} stay for next time.</small></div>`:''}
    ${justFinishedShopping?`<div class="finished-shop-card"><strong>Shopping finished</strong><span>Add the shop total only if you want to remember it.</span><button class="btn primary full" data-shop-expense>${buttonVisual('add')}<span>Add Grocery Expense</span></button></div>`:''}
    <div class="shopping-list target-shopping-list ${items.length?'has-items':''}">${shown.length?shown.map(item=>shoppingRow(item,personMap,categoryMap)).join(''):items.length?`<div class="shopping-filter-empty premium-filter-empty"><span class="shopping-filter-empty-icon" aria-hidden="true"><svg viewBox="0 0 72 72"><rect x="14" y="15" width="44" height="42" rx="14" fill="#162d39"/><path d="M21 28h22M49 28h3M21 44h3M30 44h22" fill="none" stroke="#8fd8e8" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="28" r="6" fill="#d7a842"/><circle cx="27" cy="44" r="6" fill="#55cdb8"/></svg></span><strong>No items in this view</strong><span>Try another filter.</span></div>`:emptyCard('Shopping list is empty','data-add-shop','Add Item','shopping')}</div>
    ${items.length?`<button class="btn warm full shopping-second-add target-bottom-add" type="button" data-add-shop>${buttonVisual('add')}<span>Add Item</span></button>`:''}`);
}
function shoppingRow(item,personMap,categoryMap){
  const person=personMap.get(item.requesterId);
  const category=categoryMap.get(item.categoryId);
  const art=productArt(item.itemName,category?.name||'Other');
  const meta=[item.quantity||'',item.note||''].filter(Boolean).join(' · ');
  const stateText=item.state==='couldnt'?`<small class="shop-state-note">Couldn’t get · keep for next time</small>`:'';
  return `<article class="shop-row target-shop-row" data-state="${esc(item.state)}" data-tone="${categoryTone(category)}">
      <button class="shop-check-control premium-shop-row-action" type="button" data-shop-state="got" data-shop-id="${esc(item.id)}" aria-label="${item.state==='got'?'Undo Got It':'Mark Got It'}" aria-pressed="${item.state==='got'?'true':'false'}">${shoppingActionIcon(item.state==='got'?'undo':'got')}</button>
      <button class="shop-item-main" data-edit-shop="${esc(item.id)}" aria-label="Edit ${esc(item.itemName)}">
        <span class="shop-item-picture product-art" data-item-name="${esc(item.itemName)}" aria-hidden="true">${art}</span>
        <span class="shop-item-copy"><strong>${esc(item.itemName)}</strong>${meta?`<small>${esc(meta)}</small>`:''}${stateText}</span>
        ${person?`<span class="initials target-initials" title="${esc(person.name)}">${esc(person.initials)}</span>`:''}
      </button>
      <button class="shop-couldnt-control premium-shop-row-action ${item.state==='couldnt'?'is-active':''}" type="button" data-shop-state="couldnt" data-shop-id="${esc(item.id)}" aria-label="${item.state==='couldnt'?"Undo Couldn’t Get":"Mark Couldn’t Get"}" aria-pressed="${item.state==='couldnt'?'true':'false'}">${shoppingActionIcon(item.state==='couldnt'?'undo':'unavailable')}</button>
    </article>`;
}
async function showAddShopping(category=null){
  const [categories,catalogue]=await Promise.all([getAll('categories'),getAll('catalogue')]);
  if(!category){
    const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
    present(`${subscreenBack('Shopping')} ${pageHead('Add Item','Tap a picture.','Shopping')}
      <div class="category-grid">${ordered.map(c=>`<button class="category-box ${c.name==='Other'?'category-other':''}" data-tone="${categoryTone(c)}" data-category-name="${esc(c.name)}" data-choose-category="${esc(c.id)}"><span class="category-picture" aria-hidden="true">${categoryHeroArt(c.name)}</span><span class="category-label"><span class="category-line-art">${categoryArt(c)}</span><strong>${esc(c.name)}</strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span></button>`).join('')}</div>
      <details class="meal-ideas-panel"><summary><span>Meal Ideas</span><small>Optional inspiration</small></summary><div class="meal-ideas">${mealIdeas.map(idea=>`<span>${esc(idea)}</span>`).join('')}</div></details>
      <button class="btn secondary full back-button" data-back-shopping>${buttonVisual('back')}<span>Back to Shopping</span></button>`,{subscreen:true});
    return;
  }
  const matches=catalogue.filter(item=>item.categoryId===category.id).sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  present(`${subscreenBack('Categories','data-add-shop')} ${pageHead(category.name,'Tap an item to add it.','Shopping')}
    <div class="catalogue-grid">${matches.map(item=>`<button class="catalogue-tile" data-tone="${categoryTone(category)}" data-category-name="${esc(category.name)}" data-item-name="${esc(item.name)}" data-quick-shop-item="${esc(item.id)}"><span class="catalogue-picture product-art" aria-hidden="true">${productArt(item.name,category.name)}</span><strong>${esc(item.name)}</strong></button>`).join('')||`<div class="span-two">${emptyCard('No saved items in this category yet','','','shopping')}</div>`}</div>
    <button class="btn warm full custom-shop-button" data-custom-shop="${esc(category.id)}">${buttonVisual('add')}<span>Add Something Else</span></button>
    <button class="btn secondary full" data-add-shop>${buttonVisual('back')}<span>Back to Categories</span></button>`,{subscreen:true});
}
async function customShoppingItemEditor(category){
  const [people,activeItems]=await Promise.all([getAll('people'),getAll('shoppingItems')]);
  present(`${subscreenBack(category.name,`data-back-category="${esc(category.id)}"`)} ${pageHead('Add Item','Just the name is required.','Shopping')}
    <div class="shopping-editor-context" data-tone="${categoryTone(category)}"><span class="shopping-editor-context-icon category-line-art" aria-hidden="true">${categoryArt(category)}</span><span><small>Category</small><strong>${esc(category.name)}</strong></span></div>
    <div id="shoppingLivePreview">${shoppingPreviewMarkup({categoryName:category.name})}</div>
    <form class="editor-card simple-shopping-editor" id="shoppingItemForm">
      <label>Item name<input id="customShoppingName" name="itemName" required maxlength="80" autocomplete="off"></label>
      <button class="btn warm full" type="submit">${buttonVisual('add')}<span>Add Item</span></button>
      <details class="optional-details"><summary>Optional details</summary><div class="optional-details-body">
        <label>Quantity<input name="quantity" maxlength="30"></label>
        <label>Requester<select name="requesterId"><option value="">None</option>${people.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></label>
        <label>Note<input name="note" maxlength="160"></label>
      </div></details>
      <button type="button" class="btn secondary full" data-back-category="${esc(category.id)}">${buttonVisual('cancel')}<span>Cancel</span></button>
    </form>`,{subscreen:true,focusSelector:'#customShoppingName'});
  const form=screen.querySelector('#shoppingItemForm');
  const nameInput=form.elements.itemName, requesterSelect=form.elements.requesterId, preview=screen.querySelector('#shoppingLivePreview');
  const refresh=()=>{const person=people.find(p=>p.id===requesterSelect.value);preview.innerHTML=shoppingPreviewMarkup({itemName:nameInput.value,categoryName:category.name,requesterName:person?.name||'',requesterInitials:person?.initials||''});};
  nameInput.addEventListener('input',refresh);requesterSelect.addEventListener('change',refresh);refresh();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.itemName||'').trim();
    if(!nonBlank(name,80)){await showMessage('Enter an item','Enter an item name.');return;}
    const quantity=String(data.quantity||'').trim();
    const note=String(data.note||'').trim();
    if(quantity.length>30||note.length>160)return;
    const catalogue=await getAll('catalogue');
    const ts=now();
    const record={id:id(),itemName:name,categoryId:category.id,quantity,note,requesterId:data.requesterId||null,state:'pending',order:nextShoppingOrder(activeItems),createdAt:ts,modifiedAt:ts};
    const existingCatalogue=catalogue.find(item=>item.categoryId===category.id&&item.name.toLowerCase()===name.toLowerCase());
    await atomicWrite(['shoppingItems','catalogue'],stores=>{
      stores.shoppingItems.put(record);
      if(!existingCatalogue)stores.catalogue.put({id:id(),name,categoryId:category.id,builtIn:false,createdAt:ts,modifiedAt:ts});
    });
    shoppingFilter='all';
    await renderRoute('shopping');
  });
}
async function addQuickShoppingItem(catalogueId){
  const [catalogueItem,items]=await Promise.all([getRecord('catalogue',catalogueId),getAll('shoppingItems')]);
  if(!catalogueItem)return;
  const ts=now();
  await putRecord('shoppingItems',{id:id(),itemName:catalogueItem.name,sourceCatalogueId:catalogueItem.id,categoryId:catalogueItem.categoryId,quantity:'',note:'',requesterId:null,state:'pending',order:nextShoppingOrder(items),createdAt:ts,modifiedAt:ts});
  await renderRoute('shopping');
}

async function shoppingItemEditor(item){
  const [people,categories]=await Promise.all([getAll('people'),getAll('categories')]);
  const orderedCategories=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  const currentCategory=orderedCategories.find(category=>category.id===item.categoryId);
  const currentPerson=people.find(person=>person.id===item.requesterId);
  present(`${subscreenBack('Shopping')} ${pageHead('Edit Item','Tap Save when finished.','Shopping')}
    <div id="shoppingEditPreview">${shoppingPreviewMarkup({itemName:item.itemName,categoryName:currentCategory?.name||'Other',requesterName:currentPerson?.name||'',requesterInitials:currentPerson?.initials||''})}</div>
    <form class="editor-card" id="shoppingEditForm">
      <label>Item name<input name="itemName" required maxlength="80" value="${esc(item.itemName)}"></label>
      <div class="field-grid two"><label>Quantity<input name="quantity" maxlength="30" value="${esc(item.quantity||'')}"></label><label>Requester<select name="requesterId"><option value="">None</option>${people.map(person=>`<option value="${esc(person.id)}" ${person.id===item.requesterId?'selected':''}>${esc(person.name)}</option>`).join('')}</select></label></div>
      <label>Category<select name="categoryId">${orderedCategories.map(category=>`<option value="${esc(category.id)}" ${category.id===item.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label>
      <label>Note <span class="hint">Optional</span><input name="note" maxlength="160" value="${esc(item.note||'')}"></label>
      <div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-shopping>${buttonVisual('cancel')}<span>Cancel</span></button><button class="btn warm" type="submit">${buttonVisual('save')}<span>Save</span></button></div>
    </form>
    <button class="btn danger full delete-below" data-delete-shop="${esc(item.id)}">${buttonVisual('delete')}<span>Remove Item</span></button>`,{subscreen:true});
  const form=screen.querySelector('#shoppingEditForm'), preview=screen.querySelector('#shoppingEditPreview');
  const refresh=()=>{const category=orderedCategories.find(c=>c.id===form.elements.categoryId.value);const person=people.find(p=>p.id===form.elements.requesterId.value);preview.innerHTML=shoppingPreviewMarkup({itemName:form.elements.itemName.value,categoryName:category?.name||'Other',requesterName:person?.name||'',requesterInitials:person?.initials||''});};
  form.elements.itemName.addEventListener('input',refresh);form.elements.categoryId.addEventListener('change',refresh);form.elements.requesterId.addEventListener('change',refresh);refresh();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.itemName||'').trim();
    if(!nonBlank(name,80)){await showMessage('Enter an item','Enter an item name.');return;}
    await putRecord('shoppingItems',{...item,itemName:name,quantity:String(data.quantity||'').trim(),requesterId:data.requesterId||null,categoryId:data.categoryId,note:String(data.note||'').trim(),modifiedAt:now()});
    await renderRoute('shopping');
  });
}
async function showRegularItems(){
  const [regulars,categories]=await Promise.all([getAll('regularItems'),getAll('categories')]);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const rows=[...regulars].sort((a,b)=>a.name.localeCompare(b.name));
  present(`${subscreenBack('Shopping')} ${pageHead('Regular Items','Tap Add for the things you buy often.','Shopping')}
    <div class="regular-grid">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<div class="regular-card" data-tone="${categoryTone(category)}"><span class="catalogue-picture product-art" data-item-name="${esc(item.name)}" aria-hidden="true">${productArt(item.name,category?.name||'Other')}</span><div><strong>${esc(item.name)}</strong><small>${esc(category?.name||'Other')}</small></div><button class="mini premium-mini-action add-action" data-add-regular="${esc(item.id)}">${miniActionVisual('add')}<span>Add</span></button></div>`;}).join(''):`<div class="span-two">${emptyCard('No Regular Items yet','','','shopping')}</div>`}</div>
    <button class="btn warm full" data-add-regular-inline>${buttonVisual('add')}<span>Add Regular Item</span></button>
    <button class="btn secondary full" data-back-shopping>${buttonVisual('back')}<span>Back</span></button>`,{subscreen:true});
}

async function shareShopping(){
  const [items,people,categories]=await Promise.all([getAll('shoppingItems'),getAll('people'),getAll('categories')]);
  const personMap=new Map(people.map(person=>[person.id,person]));
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const payload={kind:'travel-buddy-shopping-list',version:2,sourceListId:`tb-${crypto.randomUUID()}`,createdAt:now(),items:[...items].sort(shoppingSortStable).map(item=>{const person=personMap.get(item.requesterId);return{sourceItemId:item.sourceItemId||item.id,itemName:item.itemName,quantity:item.quantity||'',note:item.note||'',state:item.state,categoryName:categoryMap.get(item.categoryId)?.name||'Other',requesterName:person?.name||'',requesterInitials:person?.initials||''};})};
  const text=JSON.stringify(payload,null,2);
  const file=new File([text],`Travel_Buddy_Shopping_${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({title:'Travel Buddy Shopping List',files:[file]});return;}catch(error){if(error?.name==='AbortError')return;}
  }
  const link=document.createElement('a');
  link.href=URL.createObjectURL(file);link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

async function importShoppingFile(file){
  try{
    if(file.size>MAX_IMPORT_BYTES)throw new Error('Import file too large');
    const data=JSON.parse(await file.text());
    if(!validateShoppingEnvelope(data)||data.items.length>MAX_IMPORT_ITEMS)throw new Error('Invalid shopping list file');
    const [existing,imports,categories,people]=await Promise.all([getAll('shoppingItems'),getAll('imports'),getAll('categories'),getAll('people')]);
    if(imports.some(record=>record.id===data.sourceListId)){await showMessage('Already imported','This shared list has already been imported.');return;}

    const normalized=data.items.map(normalizeShoppingImportItem);
    const categoryByName=new Map(categories.map(category=>[category.name.toLowerCase(),category]));
    const personByName=new Map(people.map(person=>[person.name.toLowerCase(),person]));
    const categoriesToCreate=[];
    const peopleToCreate=[];

    for(const item of normalized){
      const key=item.categoryName.toLowerCase();
      if(!categoryByName.has(key)){
        const created={id:id(),name:item.categoryName,icon:'🛒',sortOrder:1000+categoriesToCreate.length,builtIn:false,createdAt:now(),modifiedAt:now()};
        categoryByName.set(key,created);categoriesToCreate.push(created);
      }
      if(item.requesterName){
        const personKey=item.requesterName.toLowerCase();
        if(!personByName.has(personKey)){
          const created={id:id(),name:item.requesterName,initials:normalizeInitials(item.requesterName,item.requesterInitials),createdAt:now(),modifiedAt:now()};
          personByName.set(personKey,created);peopleToCreate.push(created);
        }
      }
    }

    const incoming=normalized.map(item=>({
      ...item,
      categoryId:categoryByName.get(item.categoryName.toLowerCase())?.id||categories[0]?.id||null,
      requesterId:item.requesterName?personByName.get(item.requesterName.toLowerCase())?.id||null:null
    }));
    const known=new Set(existing.map(item=>item.sourceItemId).filter(Boolean));
    const result=mergeImportedShopping(existing,incoming,known);
    const added=result.items.slice(existing.length);
    const importedAt=now();
    await atomicWrite(['shoppingItems','imports','categories','people'],stores=>{
      for(const category of categoriesToCreate)stores.categories.put(category);
      for(const person of peopleToCreate)stores.people.put(person);
      for(const item of added)stores.shoppingItems.put(item);
      stores.imports.put({id:data.sourceListId,version:data.version,importedAt,added:result.added,skipped:result.skipped});
    });
    await showMessage('Shopping list imported',`Imported ${result.added} item${result.added===1?'':'s'}; skipped ${result.skipped} duplicate${result.skipped===1?'':'s'}.`,{tone:'info'});
    await renderRoute('shopping');
  }catch(error){
    console.error(error);
    await showMessage('Import failed','That file could not be imported safely. Your current list was not changed.',{tone:'danger'});
  }
}

async function renderSettings(){
  const [people,categories,catalogue,regulars]=await Promise.all([getAll('people'),getAll('categories'),getAll('catalogue'),getAll('regularItems')]);
  present(`${pageHead('Settings','','Settings')}
    <section class="settings-section settings-current" data-tone="blue"><h2>Current Stay</h2>
      <div class="settings-summary premium-stay-summary"><div class="flag-plate mini-flag"><div class="flag">${esc(currentStay.flag)}</div></div><div><strong>${esc(currentStay.country)} · ${esc(currentStay.city)}</strong><span>${esc(currentStay.startDate)} – ${esc(currentStay.endDate)} · ${esc(currentStay.currencyCode)}</span></div></div>
      <div class="button-row"><button class="btn secondary" data-edit-stay>${buttonVisual('edit')}<span>Edit Stay</span></button><button class="btn primary" data-change-stay>${buttonVisual('change')}<span>Change Stay</span></button></div>
    </section>
    <section class="settings-section settings-shopping" data-tone="gold"><h2>Shopping Setup</h2>
      <button class="settings-row" data-tone="blue" data-manage-people>${settingsVisual('people')}<span class="settings-row-copy"><strong>People</strong><span>${people.length} requester${people.length===1?'':'s'}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="gold" data-manage-categories>${settingsVisual('categories')}<span class="settings-row-copy"><strong>Categories</strong><span>${categories.length} available</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="teal" data-manage-regulars>${settingsVisual('regular')}<span class="settings-row-copy"><strong>Regular Items</strong><span>${regulars.length} saved</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="purple" data-manage-custom>${settingsVisual('custom')}<span class="settings-row-copy"><strong>Custom Items</strong><span>${catalogue.filter(item=>!item.builtIn).length} saved</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
    </section>
    <section class="settings-section settings-advanced" data-tone="silver"><h2>More</h2>
      <button class="settings-row" data-tone="silver" data-advanced-settings>${settingsVisual('advanced')}<span class="settings-row-copy"><strong>Advanced</strong><span>List transfer, optional AUD conversion and reset</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
    </section>
    <p class="app-version">Travel Buddy V1 · Build ${esc(BUILD_VERSION)} · Offline local PWA</p>`);
}

async function advancedSettings(){
  const shoppingItems=await getAll('shoppingItems');
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Advanced','','Settings')}
    <div class="utility-summary-band" data-tone="silver"><span class="utility-summary-icon">${settingsVisual('advanced')}</span><span><small>Offline Controls</small><strong>Local tools for this phone</strong><em>${shoppingItems.length} shopping item${shoppingItems.length===1?'':'s'} · ${stayRate(currentStay)?'AUD conversion on':'AUD conversion off'}</em></span></div>
    <div class="settings-list premium-settings-list advanced-tool-list">
      <button class="settings-row" data-tone="gold" data-shopping-tools>${settingsVisual('transfer')}<span class="settings-row-copy"><strong>Shopping List Transfer</strong><span>Manual share/import only</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="teal" data-exchange-rate>${settingsVisual('rate')}<span class="settings-row-copy"><strong>Optional AUD Conversion</strong><span>${stayRate(currentStay)?`1 AUD = ${esc(stayRate(currentStay))} ${esc(currentStay.currencyCode)}`:'Off'}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row danger" data-tone="red" data-reset>${settingsVisual('reset')}<span class="settings-row-copy"><strong>Reset Travel Buddy</strong><span>Erase local Travel Buddy data</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
    </div>
    <button class="btn secondary full back-button" data-back-settings>${buttonVisual('back')}<span>Back</span></button>`,{subscreen:true});
}

async function stayEditor(mode='edit',force=false){
  const base=mode==='edit'?currentStay:null;
  const title=mode==='setup'?'Current Stay Setup':mode==='change'?'Change Current Stay':'Edit Current Stay';
  const subtitle=mode==='setup'?'Country, place and dates. That’s it.':mode==='change'?'Set the next place.':'Correct the current place or dates.';
  const existingExpenses=mode==='edit'&&base?await getAll('expenses'):[];
  const countryLocked=!!(base&&existingExpenses.some(expense=>expense.stayId===base.id));
  if(force)setNavigationEnabled(false);
  const options=COUNTRIES.map(country=>`<option value="${esc(country.name)}"></option>`).join('');
  present(`${force?'':subscreenBack('Settings','data-back-settings')} <div class="stay-editor-head">${pageHead(title,subtitle,'Settings')}</div>
    <div class="stay-live-preview ${mode==='setup'?'setup-preview-hidden':''}" id="stayLivePreview"><small>Current Stay Preview</small><div class="stay-preview-main"><span class="stay-preview-flag">${esc(base?.flag||'◉')}</span><span><strong>${esc(base?.country||'Choose a country')}</strong><em>${esc(base?.city||'City / Destination')}</em></span></div><div class="stay-preview-dates">${esc(base?.startDate||'Start date')} – ${esc(base?.endDate||'End date')}</div></div>
    <form class="editor-card quick-stay premium-stay-editor target-stay-editor" id="stayForm">
      <label class="stay-field"><span class="field-label"><span>Country</span></span><span class="stay-control"><span class="stay-control-prefix country-prefix" id="countryPrefix">${base?.flag?esc(base.flag):stayFieldIcon('country')}</span><input name="country" list="countryList" required maxlength="60" autocomplete="off" placeholder="Start typing a country" value="${esc(base?.country||'')}" ${countryLocked?'readonly':''}><span class="stay-control-chevron" aria-hidden="true">⌄</span></span><datalist id="countryList">${options}</datalist></label>
      <div class="auto-country ${base?'is-ready':''}" id="countryAuto" ${base?'':'hidden'}>${base?`${esc(base.flag)} ${esc(base.currencyCode)} · ${esc(base.currencyName)}`:''}</div>
      ${countryLocked?'<p class="micro-note">Use Change Stay when you move to another country.</p>':''}
      <label class="stay-field"><span class="field-label"><span>City / Destination</span></span><span class="stay-control"><span class="stay-control-prefix">${stayFieldIcon('city')}</span><input name="city" required maxlength="80" autocomplete="address-level2" placeholder="City or place" value="${esc(base?.city||'')}"><span class="stay-control-chevron" aria-hidden="true">›</span></span></label>
      <div class="stay-date-stack"><label class="stay-field"><span class="field-label"><span>Stay start</span></span><span class="stay-control date-control"><span class="stay-control-prefix">${stayFieldIcon('start')}</span><input name="startDate" type="date" required value="${esc(auDateToIso(base?.startDate||''))}"></span></label><label class="stay-field"><span class="field-label"><span>Stay end</span></span><span class="stay-control date-control"><span class="stay-control-prefix">${stayFieldIcon('end')}</span><input name="endDate" type="date" required value="${esc(auDateToIso(base?.endDate||''))}"></span></label></div>
      <div class="editor-actions static-actions">${force?'':`<button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">${buttonVisual('cancel')}<span>Cancel</span></button>`}<button class="btn primary" type="submit">${buttonVisual(mode==='change'?'change':'save')}<span>${mode==='setup'?'Start Travel Buddy':mode==='change'?'Change Stay':'Save'}</span></button></div>
    </form>`,{subscreen:true});

  const form=screen.querySelector('#stayForm');
  const countryInput=form.elements.country;
  const auto=screen.querySelector('#countryAuto');
  const preview=screen.querySelector('#stayLivePreview');
  const countryPrefix=screen.querySelector('#countryPrefix');
  const updatePreview=()=>{const ref=findCountry(countryInput.value);const city=String(form.elements.city.value||'').trim();const start=isoDateToAu(form.elements.startDate.value)||'Start date';const end=isoDateToAu(form.elements.endDate.value)||'End date';preview.innerHTML=`<small>Current Stay Preview</small><div class="stay-preview-main"><span class="stay-preview-flag">${esc(ref?.flag||'◉')}</span><span><strong>${esc(ref?.name||countryInput.value||'Choose a country')}</strong><em>${esc(city||'City / Destination')}</em></span></div><div class="stay-preview-dates">${esc(start)} – ${esc(end)}</div>`;};
  const updateCountry=()=>{
    const ref=findCountry(countryInput.value);
    auto.hidden=!ref;
    auto.textContent=ref?`${ref.flag} ${ref.currencyCode} · ${ref.currencyName}`:'';
    auto.classList.toggle('is-ready',!!ref);
    if(countryPrefix)countryPrefix.innerHTML=ref?esc(ref.flag):stayFieldIcon('country');
    updatePreview();
  };
  countryInput.addEventListener('input',updateCountry);countryInput.addEventListener('change',updateCountry);form.elements.city.addEventListener('input',updatePreview);form.elements.startDate.addEventListener('change',updatePreview);form.elements.endDate.addEventListener('change',updatePreview);updateCountry();updatePreview();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    const countryRef=findCountry(data.country);
    const city=String(data.city||'').trim();
    const startDate=isoDateToAu(data.startDate);
    const endDate=isoDateToAu(data.endDate);
    if(!countryRef){await showMessage('Choose a country','Choose a country from the suggestions.');countryInput.focus();return;}
    if(!nonBlank(city,80)){await showMessage('Enter a destination','Enter the city or destination.');return;}
    if(!startDate||!endDate){await showMessage('Choose both dates','Choose the stay start and end dates.');return;}
    if(auDateToSort(endDate)<auDateToSort(startDate)){await showMessage('Check the dates','Stay end date cannot be before the start date.');return;}
    if(mode==='change'&&currentStay){const ok=await askConfirm('Change Current Stay?','Old expenses will stay unchanged.',{tone:'attention',confirmLabel:'Change Stay'});if(!ok)return;}
    const ts=now();
    const sameCurrency=base&&base.currencyCode===countryRef.currencyCode;
    const record={id:mode==='edit'&&base?base.id:id(),country:countryRef.name,city,flag:countryRef.flag,startDate,endDate,currencyName:countryRef.currencyName,currencyCode:countryRef.currencyCode,currencySymbol:countryRef.currencySymbol,exchangeRate:sameCurrency?(stayRate(base)||null):null,createdAt:mode==='edit'&&base?base.createdAt:ts,modifiedAt:ts};
    await atomicWrite(['stays','settings'],stores=>{stores.stays.put(record);stores.settings.put({key:'currentStayId',value:record.id});});
    currentStay=record;
    setNavigationEnabled(true);
    await renderRoute(force?'home':'settings');
  });
}
async function exchangeRateEditor(){
  if(!currentStay)return stayEditor('setup',true);
  const rate=stayRate(currentStay);
  present(`${subscreenBack('Advanced','data-advanced-settings')} ${pageHead('Optional AUD Conversion','Only use this if you want an AUD figure saved too.','Settings')}
    <div class="rate-preview-card" data-tone="teal"><span class="rate-preview-icon">${settingsVisual('rate')}</span><span class="rate-preview-copy"><small>Current Stay Currency</small><strong>AUD ↔ ${esc(currentStay.currencyCode)}</strong><em>${esc(currentStay.country)} · ${esc(currentStay.city)}${rate?` · 1 AUD = ${esc(rate)} ${esc(currentStay.currencyCode)}`:' · Conversion is off'}</em></span></div>
    <form class="editor-card rate-editor-card" id="rateForm"><label><span class="rate-label-row"><span>1 AUD =</span><span class="hint">${esc(currentStay.currencyCode)}</span></span><input id="rateInput" name="exchangeRate" type="number" min="0.000001" step="any" inputmode="decimal" placeholder="Leave blank to turn it off" value="${esc(rate||'')}"></label><p class="editor-help">Enter the fixed rate you want Travel Buddy to use for this stay. Leave it blank to keep AUD conversion off.</p><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">${buttonVisual('cancel')}<span>Cancel</span></button><button class="btn primary" type="submit">${buttonVisual('save')}<span>Save</span></button></div></form>`,{subscreen:true});
  screen.querySelector('#rateForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const raw=String(new FormData(event.currentTarget).get('exchangeRate')||'').trim();
    let nextRate=null;
    if(raw){nextRate=Number(raw);if(!Number.isFinite(nextRate)||nextRate<=0){await showMessage('Check the exchange rate','Enter a valid exchange rate or leave it blank.');return;}}
    currentStay={...currentStay,exchangeRate:nextRate,modifiedAt:now()};
    await putRecord('stays',currentStay);
    await renderRoute('settings');
  });
}

async function managePeople(){
  const people=await getAll('people');
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('People','Requester initials for Shopping.','Settings')}
    <div class="management-summary-band" data-tone="blue"><span class="management-summary-icon">${settingsVisual('people')}</span><span><small>Shopping Requesters</small><strong>${people.length} ${people.length===1?'person':'people'}</strong></span></div>
    <div class="management-list">${people.length?people.map(person=>`<article class="management-card person-card" data-tone="blue"><div class="person-avatar">${esc(person.initials)}</div><div class="management-copy"><strong>${esc(person.name)}</strong><span>Initials · ${esc(person.initials)}</span></div><div class="mini-actions"><button class="mini premium-mini-action edit-action" data-edit-person="${esc(person.id)}">${miniActionVisual('edit')}<span>Edit</span></button><button class="mini danger premium-mini-action delete-action" data-delete-person="${esc(person.id)}">${miniActionVisual('delete')}<span>Delete</span></button></div></article>`).join(''):emptyCard('No people yet','','','people')}<button class="btn primary full" data-add-person>${buttonVisual('add')}<span>Add Person</span></button></div>
    <button class="btn secondary full back-button" data-back-settings>${buttonVisual('back')}<span>Back</span></button>`,{subscreen:true});
}

async function personEditor(person=null){
  personEditorReturn='people';
  present(`${subscreenBack('People','data-back-people')} ${pageHead(person?'Edit Person':'Add Person','Name and initials.','Settings')}
    <div class="management-editor-preview" id="personPreview" data-tone="blue"><span class="person-avatar">${person?.initials?esc(person.initials):settingsVisual('people')}</span><span><small>Requester Preview</small><strong>${esc(person?.name||'Person name')}</strong><em>${esc(person?.initials||'Initials')}</em></span></div>
    <form class="editor-card" id="personForm"><label>Name<input id="personName" name="name" required maxlength="60" value="${esc(person?.name||'')}"></label><label>Initials<input name="initials" maxlength="3" value="${esc(person?.initials||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-people>${buttonVisual('cancel')}<span>Cancel</span></button><button class="btn primary" type="submit">${buttonVisual('save')}<span>Save</span></button></div></form>`,{subscreen:true,focusSelector:person?null:'#personName'});
  const form=screen.querySelector('#personForm'), preview=screen.querySelector('#personPreview');
  const refresh=()=>{const name=String(form.elements.name.value||'').trim();const initials=normalizeInitials(name,form.elements.initials.value);preview.innerHTML=`<span class="person-avatar">${initials?esc(initials):settingsVisual('people')}</span><span><small>Requester Preview</small><strong>${esc(name||'Person name')}</strong><em>${esc(initials||'Initials')}</em></span>`;};
  form.elements.name.addEventListener('input',refresh);form.elements.initials.addEventListener('input',refresh);refresh();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.name||'').trim();
    if(!nonBlank(name,60)){await showMessage('Enter a name','Enter a name.');return;}
    const all=await getAll('people');
    if(all.some(other=>other.id!==person?.id&&other.name.trim().toLowerCase()===name.toLowerCase())){await showMessage('Already exists','That person already exists.');return;}
    const ts=now();
    await putRecord('people',{id:person?.id||id(),name,initials:normalizeInitials(name,data.initials),createdAt:person?.createdAt||ts,modifiedAt:ts});
    await managePeople();
  });
}
async function deletePerson(personId){
  if(!await askConfirm('Delete this person?','Shopping items stay, but the requester link will be cleared.',{confirmLabel:'Delete'}))return;
  const items=await getAll('shoppingItems');
  const changed=items.filter(item=>item.requesterId===personId).map(item=>({...item,requesterId:null,modifiedAt:now()}));
  await atomicWrite(['people','shoppingItems'],stores=>{for(const item of changed)stores.shoppingItems.put(item);stores.people.delete(personId);});
  await managePeople();
}

async function manageCategories(){
  const categories=await getAll('categories');
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Categories','Used when adding items.','Shopping Setup')}<div class="management-summary-band" data-tone="gold"><span class="management-summary-icon">${settingsVisual('categories')}</span><span><small>Shopping Categories</small><strong>${ordered.length} available</strong></span></div><div class="management-list">${ordered.map(category=>`<article class="management-card" data-tone="${categoryTone(category)}"><span class="management-item-icon category-product-art" aria-hidden="true">${categoryHeroArt(category.name)}</span><div class="management-copy"><strong>${esc(category.name)}</strong><span>${category.builtIn?'Built in':'Custom category'}</span></div><div class="mini-actions"><button class="mini premium-mini-action rename-action" data-rename-category="${esc(category.id)}">${miniActionVisual('rename')}<span>Rename</span></button>${category.builtIn?'':`<button class="mini danger premium-mini-action delete-action" data-delete-category="${esc(category.id)}">${miniActionVisual('delete')}<span>Delete</span></button>`}</div></article>`).join('')}<button class="btn warm full shopping-setup-primary" data-add-category>${buttonVisual('add')}<span>Add Category</span></button></div><button class="btn secondary full back-button" data-back-settings>${buttonVisual('back')}<span>Back</span></button>`,{subscreen:true});
}

async function categoryEditor(category=null){
  present(`${subscreenBack('Categories','data-back-categories')} ${pageHead(category?'Rename Category':'Add Category','The active shopping list stays continuous.','Shopping Setup')}
    <div class="management-editor-preview category-editor-preview" id="categoryPreview" data-tone="${categoryTone(category?.name||'Other')}"><span class="management-preview-icon category-product-art">${categoryHeroArt(category?.name||'Other')}</span><span><small>Category Preview</small><strong>${esc(category?.name||'Category name')}</strong><em>${category?.builtIn?'Built in':'Custom category'}</em></span></div>
    <form class="editor-card shopping-setup-editor" id="categoryForm"><label>Category name<input id="categoryName" name="name" required maxlength="60" value="${esc(category?.name||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-categories>${buttonVisual('cancel')}<span>Cancel</span></button><button class="btn warm" type="submit">${buttonVisual('save')}<span>Save</span></button></div></form>`,{subscreen:true,focusSelector:category?null:'#categoryName'});
  const form=screen.querySelector('#categoryForm'), preview=screen.querySelector('#categoryPreview');
  const refresh=()=>{const name=String(form.elements.name.value||'').trim()||'Category name';preview.dataset.tone=categoryTone(name);preview.innerHTML=`<span class="management-preview-icon category-product-art">${categoryHeroArt(name)}</span><span><small>Category Preview</small><strong>${esc(name)}</strong><em>${category?.builtIn?'Built in':'Custom category'}</em></span>`;};form.elements.name.addEventListener('input',refresh);refresh();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const name=String(new FormData(event.currentTarget).get('name')||'').trim();
    if(!nonBlank(name,60)){await showMessage('Enter a category','Enter a category name.');return;}
    const categories=await getAll('categories');
    if(categories.some(existing=>existing.id!==category?.id&&existing.name.toLowerCase()===name.toLowerCase())){await showMessage('Already exists','That category already exists.');return;}
    const ts=now();
    const maxSort=Math.max(1000,...categories.map(existing=>Number(existing.sortOrder)||0));
    await putRecord('categories',{id:category?.id||id(),name,icon:category?.icon||'🛒',sortOrder:category?.sortOrder??maxSort+10,builtIn:category?.builtIn||false,createdAt:category?.createdAt||ts,modifiedAt:ts});
    await manageCategories();
  });
}
async function deleteCategory(categoryId){
  const category=await getRecord('categories',categoryId);
  if(!category||category.builtIn)return;
  const [items,catalogue,regulars]=await Promise.all([getAll('shoppingItems'),getAll('catalogue'),getAll('regularItems')]);
  if(items.some(item=>item.categoryId===category.id)||catalogue.some(item=>item.categoryId===category.id)||regulars.some(item=>item.categoryId===category.id)){await showMessage('Category still in use','Move or remove its items first.');return;}
  if(await askConfirm('Delete category?',`Delete “${category.name}”?`,{confirmLabel:'Delete'}))await deleteRecord('categories',category.id);
  await manageCategories();
}

async function manageCustom(){
  const [catalogue,categories]=await Promise.all([getAll('catalogue'),getAll('categories')]);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const rows=catalogue.filter(item=>!item.builtIn).sort((a,b)=>a.name.localeCompare(b.name));
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Custom Items','Reusable items you have added.','Shopping Setup')}<div class="management-summary-band" data-tone="purple"><span class="management-summary-icon">${settingsVisual('custom')}</span><span><small>Reusable Catalogue</small><strong>${rows.length} custom ${rows.length===1?'item':'items'}</strong></span></div><div class="management-list">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<article class="management-card" data-tone="${categoryTone(category)}"><span class="management-item-icon product-icon product-art" data-item-name="${esc(item.name)}" aria-hidden="true">${productArt(item.name,category?.name||'Other')}</span><div class="management-copy"><strong>${esc(item.name)}</strong><span>${esc(category?.name||'Other')}</span></div><div class="mini-actions"><button class="mini premium-mini-action edit-action" data-edit-custom="${esc(item.id)}">${miniActionVisual('edit')}<span>Edit</span></button><button class="mini danger premium-mini-action delete-action" data-delete-custom="${esc(item.id)}">${miniActionVisual('delete')}<span>Delete</span></button></div></article>`;}).join(''):emptyCard('No custom items yet','','','shopping')}<button class="btn warm full shopping-setup-primary" data-add-custom>${buttonVisual('add')}<span>Add Custom Item</span></button></div><button class="btn secondary full back-button" data-back-settings>${buttonVisual('back')}<span>Back</span></button>`,{subscreen:true});
}

async function customEditor(item=null){
  const categories=await getAll('categories');
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  const initialCategory=ordered.find(category=>category.id===item?.categoryId)||ordered[0];
  present(`${subscreenBack('Custom Items','data-back-custom')} ${pageHead(item?'Edit Custom Item':'Add Custom Item','Saved for future shops.','Shopping Setup')}<div id="customPreview">${shoppingPreviewMarkup({itemName:item?.name||'',categoryName:initialCategory?.name||'Other',eyebrow:'Reusable Item Preview'})}</div><form class="editor-card shopping-setup-editor" id="customForm"><label>Item name<input id="customItemName" name="name" required maxlength="80" value="${esc(item?.name||'')}"></label><label>Category<select name="categoryId">${ordered.map(category=>`<option value="${esc(category.id)}" ${category.id===item?.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-custom>${buttonVisual('cancel')}<span>Cancel</span></button><button class="btn warm" type="submit">${buttonVisual('save')}<span>Save</span></button></div></form>`,{subscreen:true,focusSelector:item?null:'#customItemName'});
  const form=screen.querySelector('#customForm'), preview=screen.querySelector('#customPreview');const refresh=()=>{const category=ordered.find(c=>c.id===form.elements.categoryId.value);preview.innerHTML=shoppingPreviewMarkup({itemName:form.elements.name.value,categoryName:category?.name||'Other',eyebrow:'Reusable Item Preview'});};form.elements.name.addEventListener('input',refresh);form.elements.categoryId.addEventListener('change',refresh);refresh();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.name||'').trim();
    if(!nonBlank(name,80)){await showMessage('Enter an item','Enter an item name.');return;}
    const all=await getAll('catalogue');
    if(all.some(existing=>existing.id!==item?.id&&existing.categoryId===data.categoryId&&existing.name.toLowerCase()===name.toLowerCase())){await showMessage('Already exists','That item already exists in this category.');return;}
    const ts=now();
    await putRecord('catalogue',{id:item?.id||id(),name,categoryId:data.categoryId,builtIn:false,createdAt:item?.createdAt||ts,modifiedAt:ts});
    await manageCustom();
  });
}
async function manageRegulars(){
  const [regulars,categories]=await Promise.all([getAll('regularItems'),getAll('categories')]);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const rows=[...regulars].sort((a,b)=>a.name.localeCompare(b.name));
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Regular Items','Things you buy often.','Shopping Setup')}<div class="management-summary-band" data-tone="teal"><span class="management-summary-icon">${settingsVisual('regular')}</span><span><small>Quick Add Favourites</small><strong>${rows.length} regular ${rows.length===1?'item':'items'}</strong></span></div><div class="management-list">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<article class="management-card" data-tone="${categoryTone(category)}"><span class="management-item-icon product-icon product-art" data-item-name="${esc(item.name)}" aria-hidden="true">${productArt(item.name,category?.name||'Other')}</span><div class="management-copy"><strong>${esc(item.name)}</strong><span>${esc(category?.name||'Other')}</span></div><div class="mini-actions"><button class="mini premium-mini-action edit-action" data-edit-regular="${esc(item.id)}">${miniActionVisual('edit')}<span>Edit</span></button><button class="mini danger premium-mini-action delete-action" data-delete-regular="${esc(item.id)}">${miniActionVisual('delete')}<span>Delete</span></button></div></article>`;}).join(''):emptyCard('No Regular Items yet','','','shopping')}<button class="btn warm full shopping-setup-primary" data-add-regular-setting>${buttonVisual('add')}<span>Add Regular Item</span></button></div><button class="btn secondary full back-button" data-back-settings>${buttonVisual('back')}<span>Back</span></button>`,{subscreen:true});
}

async function regularEditor(item=null,returnTo='settings'){
  regularEditorReturn=returnTo;
  const [categories,regulars]=await Promise.all([getAll('categories'),getAll('regularItems')]);
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  const initialCategory=ordered.find(category=>category.id===item?.categoryId)||ordered[0];
  present(`${subscreenBack(returnTo==='shopping'?'Regular Items':'Regular Items','data-regular-cancel')} ${pageHead(item?'Edit Regular Item':'Add Regular Item','Saved for quick reuse.','Shopping')}<div id="regularPreview">${shoppingPreviewMarkup({itemName:item?.name||'',categoryName:initialCategory?.name||'Other',eyebrow:'Regular Item Preview'})}</div><form class="editor-card shopping-setup-editor" id="regularForm"><label>Item name<input id="regularItemName" name="name" required maxlength="80" value="${esc(item?.name||'')}"></label><label>Category<select name="categoryId">${ordered.map(category=>`<option value="${esc(category.id)}" ${category.id===item?.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-regular-cancel>${buttonVisual('cancel')}<span>Cancel</span></button><button class="btn warm" type="submit">${buttonVisual('save')}<span>Save</span></button></div></form>`,{subscreen:true,focusSelector:item?null:'#regularItemName'});
  const form=screen.querySelector('#regularForm'), preview=screen.querySelector('#regularPreview');const refresh=()=>{const category=ordered.find(c=>c.id===form.elements.categoryId.value);preview.innerHTML=shoppingPreviewMarkup({itemName:form.elements.name.value,categoryName:category?.name||'Other',eyebrow:'Regular Item Preview'});};form.elements.name.addEventListener('input',refresh);form.elements.categoryId.addEventListener('change',refresh);refresh();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.name||'').trim();
    if(!nonBlank(name,80)){await showMessage('Enter an item','Enter an item name.');return;}
    if(regulars.some(existing=>existing.id!==item?.id&&existing.categoryId===data.categoryId&&existing.name.toLowerCase()===name.toLowerCase())){await showMessage('Already exists','That Regular Item already exists.');return;}
    const ts=now();
    await putRecord('regularItems',{id:item?.id||id(),name,categoryId:data.categoryId,createdAt:item?.createdAt||ts,modifiedAt:ts});
    if(regularEditorReturn==='shopping')await showRegularItems();else await manageRegulars();
  });
}
async function addRegularToList(regularId){
  const [regular,items]=await Promise.all([getRecord('regularItems',regularId),getAll('shoppingItems')]);
  if(!regular)return;
  const ts=now();
  await putRecord('shoppingItems',{id:id(),itemName:regular.name,categoryId:regular.categoryId,quantity:'',note:'',requesterId:null,state:'pending',order:nextShoppingOrder(items),createdAt:ts,modifiedAt:ts});
  await showRegularItems();
}

async function shoppingTools(){
  const items=await getAll('shoppingItems');
  const counts=shoppingCounts(items);
  present(`${subscreenBack('Advanced','data-advanced-settings')} ${pageHead('Shopping List Transfer','Manual only. No sync.','Settings')}
    <div class="utility-summary-band" data-tone="gold"><span class="utility-summary-icon">${settingsVisual('transfer')}</span><span><small>Current Shopping List</small><strong>${items.length} item${items.length===1?'':'s'} ready to share</strong><em>${counts.pending} to buy · ${counts.got} got · ${counts.unavailable} unavailable</em></span></div>
    <div class="settings-list premium-settings-list transfer-tool-list"><button class="settings-row" data-tone="gold" data-share-shopping>${settingsVisual('transfer')}<span class="settings-row-copy"><strong>Share Shopping List</strong><span>Create a versioned Travel Buddy list file.</span></span><span class="row-chevron" aria-hidden="true">›</span></button><button class="settings-row" data-tone="teal" data-import-shopping>${settingsVisual('transfer')}<span class="settings-row-copy"><strong>Import Shopping List</strong><span>Merge safely without replacing this list.</span></span><span class="row-chevron" aria-hidden="true">›</span></button></div>
    <div class="transfer-safety-note"><strong>Manual and local</strong><span>Nothing syncs automatically. Imports merge into the current list and keep existing items.</span></div>
    <button class="btn secondary full back-button" data-back-settings>${buttonVisual('back')}<span>Back</span></button>`,{subscreen:true});
}

async function resetTravelBuddy(){
  if(!await askConfirm('Reset Travel Buddy?','This removes all local Travel Buddy data.',{confirmLabel:'Continue'}))return;
  if(!await askConfirm('Final confirmation','Erase Travel Buddy local data and return to Current Stay setup?',{confirmLabel:'Erase Data'}))return;
  await resetDatabase();
  currentStay=null;
  setRoute('settings');
  setNavigationEnabled(false);
  await stayEditor('setup',true);
}

screen.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button)return;

  if(button.matches('[data-toilet-phrase]'))return showToiletPhrase();
  if(button.matches('[data-add-expense]'))return expenseEditor(null,{category:button.hasAttribute('data-groceries')?'Groceries':undefined,returnRoute:route});
  if(button.matches('[data-open-shopping]')){shoppingFilter='all';return renderRoute('shopping');}
  if(button.matches('[data-open-expenses]'))return renderRoute('expenses');
  if(button.matches('[data-expense-filter]')){expenseFilter=button.dataset.expenseFilter;return renderExpenses();}
  if(button.matches('[data-edit-expense]'))return expenseEditor(await getRecord('expenses',button.dataset.editExpense),{returnRoute:button.dataset.returnRoute||route});
  if(button.matches('[data-toggle-transfer]')){const expense=await getRecord('expenses',button.dataset.toggleTransfer);if(expense)await putRecord('expenses',{...expense,transferred:!expense.transferred,modifiedAt:now()});return renderExpenses();}
  if(button.matches('[data-delete-expense]')){if(await askConfirm('Delete this expense?','This cannot be undone.',{confirmLabel:'Delete'}))await deleteRecord('expenses',button.dataset.deleteExpense);return renderRoute(expenseReturnRoute);}
  if(button.matches('[data-editor-cancel]'))return renderRoute(button.dataset.cancelRoute||'settings');

  if(button.matches('[data-add-shop]'))return showAddShopping();
  if(button.matches('[data-shopping-filter]')){shoppingFilter=button.dataset.shoppingFilter;return renderShopping();}
  if(button.matches('[data-choose-category]'))return showAddShopping(await getRecord('categories',button.dataset.chooseCategory));
  if(button.matches('[data-back-category]'))return showAddShopping(await getRecord('categories',button.dataset.backCategory));
  if(button.matches('[data-custom-shop]'))return customShoppingItemEditor(await getRecord('categories',button.dataset.customShop));
  if(button.matches('[data-quick-shop-item]'))return addQuickShoppingItem(button.dataset.quickShopItem);
  if(button.matches('[data-back-shopping]'))return renderRoute('shopping');
  if(button.matches('[data-edit-shop]'))return shoppingItemEditor(await getRecord('shoppingItems',button.dataset.editShop));
  if(button.matches('[data-shop-state]')){const item=await getRecord('shoppingItems',button.dataset.shopId);if(!item)return;const next=item.state===button.dataset.shopState?'pending':button.dataset.shopState;await putRecord('shoppingItems',{...item,state:next,modifiedAt:now()});justFinishedShopping=false;return renderShopping();}
  if(button.matches('[data-delete-shop]')){if(await askConfirm('Remove this item?','Remove it from the active shopping list?',{confirmLabel:'Remove'}))await deleteRecord('shoppingItems',button.dataset.deleteShop);return renderRoute('shopping');}
  if(button.matches('[data-finish-shopping]')){
    const items=await getAll('shoppingItems');
    const counts=shoppingCounts(items);
    if(!counts.got){await showMessage('Nothing marked Got It','Mark at least one item Got It before finishing this shop.');return;}
    const kept=items.length-counts.got;
    const detail=`${counts.got} bought item${counts.got===1?'':'s'} will be cleared. ${kept} item${kept===1?'':'s'} will stay${counts.unavailable?`, including ${counts.unavailable} unavailable`:''}.`;
    if(!await askConfirm('Finish shopping?',detail,{tone:'attention',confirmLabel:'Finish Shopping'}))return;
    const next=finishShopping(items);
    const purchased=items.filter(item=>item.state==='got');
    await atomicWrite('shoppingItems',stores=>{for(const item of purchased)stores.shoppingItems.delete(item.id);for(const item of next)stores.shoppingItems.put(item);});
    justFinishedShopping=true;shoppingFilter='all';
    return renderShopping();
  }
  if(button.matches('[data-shop-expense]')){justFinishedShopping=false;return expenseEditor(null,{category:'Groceries',returnRoute:'shopping'});}
  if(button.matches('[data-regular-items]'))return showRegularItems();
  if(button.matches('[data-add-regular]'))return addRegularToList(button.dataset.addRegular);
  if(button.matches('[data-add-regular-inline]'))return regularEditor(null,'shopping');

  if(button.matches('[data-edit-stay]'))return stayEditor('edit');
  if(button.matches('[data-change-stay]'))return stayEditor('change');
  if(button.matches('[data-exchange-rate]'))return exchangeRateEditor();
  if(button.matches('[data-manage-people]'))return managePeople();
  if(button.matches('[data-add-person]'))return personEditor();
  if(button.matches('[data-edit-person]'))return personEditor(await getRecord('people',button.dataset.editPerson));
  if(button.matches('[data-delete-person]'))return deletePerson(button.dataset.deletePerson);
  if(button.matches('[data-back-people]'))return managePeople();
  if(button.matches('[data-manage-categories]'))return manageCategories();
  if(button.matches('[data-add-category]'))return categoryEditor();
  if(button.matches('[data-rename-category]'))return categoryEditor(await getRecord('categories',button.dataset.renameCategory));
  if(button.matches('[data-back-categories]'))return manageCategories();
  if(button.matches('[data-delete-category]'))return deleteCategory(button.dataset.deleteCategory);
  if(button.matches('[data-manage-custom]'))return manageCustom();
  if(button.matches('[data-add-custom]'))return customEditor();
  if(button.matches('[data-edit-custom]'))return customEditor(await getRecord('catalogue',button.dataset.editCustom));
  if(button.matches('[data-delete-custom]')){const item=await getRecord('catalogue',button.dataset.deleteCustom);if(item&&await askConfirm('Delete custom item?',`Delete “${item.name}”?`,{confirmLabel:'Delete'}))await deleteRecord('catalogue',item.id);return manageCustom();}
  if(button.matches('[data-back-custom]'))return manageCustom();
  if(button.matches('[data-manage-regulars]'))return manageRegulars();
  if(button.matches('[data-add-regular-setting]'))return regularEditor(null,'settings');
  if(button.matches('[data-edit-regular]'))return regularEditor(await getRecord('regularItems',button.dataset.editRegular),'settings');
  if(button.matches('[data-delete-regular]')){const item=await getRecord('regularItems',button.dataset.deleteRegular);if(item&&await askConfirm('Delete Regular Item?',`Delete “${item.name}”?`,{confirmLabel:'Delete'}))await deleteRecord('regularItems',item.id);return manageRegulars();}
  if(button.matches('[data-regular-cancel]'))return regularEditorReturn==='shopping'?showRegularItems():manageRegulars();
  if(button.matches('[data-advanced-settings]'))return advancedSettings();
  if(button.matches('[data-shopping-tools]'))return shoppingTools();
  if(button.matches('[data-share-shopping]'))return shareShopping();
  if(button.matches('[data-import-shopping]'))return importInput.click();
  if(button.matches('[data-back-settings]'))return renderRoute('settings');
  if(button.matches('[data-reset]'))return resetTravelBuddy();
});

importInput.addEventListener('change',async()=>{
  const file=importInput.files?.[0];
  importInput.value='';
  if(file)await importShoppingFile(file);
});

navButtons.forEach(button=>button.addEventListener('click',()=>{if(currentStay){justFinishedShopping=false;renderRoute(button.dataset.route);}}));

async function autoLaunch(){
  try{
    const started=performance.now();
    await ensureSeedData();
    await loadCurrentStay();
    const brandMinimum=1350;
    const elapsed=performance.now()-started;
    if(elapsed<brandMinimum)await delay(brandMinimum-elapsed);

    const stageHandoff=420;
    launchBrand.classList.remove('is-visible');
    await delay(stageHandoff);
    if(currentStay){
      launchStay.innerHTML=`<div class="launch-stay-flag">${esc(currentStay.flag||'◉')}</div><div class="launch-stay-country">${esc(currentStay.country)}</div><div class="launch-stay-city">${esc(currentStay.city)}</div><div class="launch-stay-dates">${esc(currentStay.startDate)} – ${esc(currentStay.endDate)}</div>`;
      launchStay.classList.add('is-visible');
      await delay(1550);
      launchStay.classList.remove('is-visible');
      await delay(stageHandoff);
    }

    /* Prepare the real app behind the launch layer, then fade the launch away. */
    app.hidden=false;
    if(!currentStay){setRoute('settings');setNavigationEnabled(false);await stayEditor('setup',true);}else{setNavigationEnabled(true);await renderRoute('home');}
    await delay(40);
    launch.classList.add('is-exiting');
    await delay(440);
    launch.remove();
    if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
  }catch(error){
    console.error(error);
    document.body.innerHTML='<main class="startup-failure"><section><img src="./travel-buddy-pink-192.png" alt="" aria-hidden="true"><p class="eyebrow">Travel Buddy</p><h1>Couldn’t start safely</h1><p>Close any other Travel Buddy tab, then reopen the app.</p><small>Your saved travel data has not been deliberately cleared.</small></section></main>';
  }
}

autoLaunch();
