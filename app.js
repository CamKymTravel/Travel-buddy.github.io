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
const toneKey=value=>{const v=String(value||'').toLowerCase();if(v.includes('shopping'))return'shopping';if(v.includes('expense'))return'expenses';if(v.includes('setting'))return'settings';return'home';};
const pageHead=(title,subtitle='',accent='Travel Buddy')=>`<div class="page-head head-${toneKey(accent)}"><div><p class="eyebrow">${esc(accent)}</p><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div>`;
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
    dialogRoot.innerHTML=`<div class="dialog-backdrop"><section class="app-dialog dialog-${esc(tone)}" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><div class="dialog-accent"></div><h2 id="dialogTitle">${esc(title)}</h2>${message?`<p>${esc(message)}</p>`:''}${html}<div class="dialog-actions">${cancelLabel?`<button class="btn secondary" type="button" data-dialog-cancel>${esc(cancelLabel)}</button>`:''}<button class="btn ${tone==='danger'?'danger':tone==='attention'?'warm':'primary'}" type="button" data-dialog-confirm>${esc(confirmLabel)}</button></div></section></div>`;
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
  const path={
    got:'<path d="m5 12 4 4L19 6"/>',
    undo:'<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>',
    unavailable:'<circle cx="12" cy="12" r="8"/><path d="m7 17 10-10"/>'
  }[kind]||'<path d="M12 5v14M5 12h14"/>';
  return `<span class="action-line-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span>`;
}

function stayFieldIcon(kind){
  const path={
    country:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    city:'<path d="M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>',
    start:'<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v6M16 3v6M4 10h16M8 14h3"/>',
    end:'<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v6M16 3v6M4 10h16M13 14h3M15 12v4"/>'
  }[kind]||'<circle cx="12" cy="12" r="7"/>';
  return `<span class="field-label-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${path}</svg></span>`;
}

function subscreenBack(label='Shopping',attr='data-back-shopping'){
  return `<button class="subscreen-back-button" type="button" ${attr}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>${esc(label)}</span></button>`;
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
  return `<button type="button" class="hero compact-hero stay-hero-action" data-toilet-phrase aria-label="${esc(stay.country)} ${esc(stay.city)}. Open toilet phrase helper."><div class="hero-top"><div class="flag-plate"><div class="flag">${esc(stay.flag||'◉')}</div></div><div class="hero-copy"><p class="eyebrow">Travel Buddy · Current Stay</p><h2>${esc(stay.country)}</h2><p>${esc(stay.city)}</p></div><span class="wc-badge" aria-hidden="true"><b>WC</b><small>Phrase</small></span></div><div class="hero-meta"><span class="pill">${esc(stay.startDate)} – ${esc(stay.endDate)}</span><span class="pill currency-pill">${esc(stay.currencyCode)}</span></div></button>`;
}

function stayStrip(){
  return currentStay?`<div class="screen-title-strip compact"><div class="flag-plate mini-flag"><div class="flag">${esc(currentStay.flag||'◉')}</div></div><div class="stay-strip-copy"><strong>${esc(currentStay.country)} · ${esc(currentStay.city)}</strong><small>${esc(currentStay.startDate)} – ${esc(currentStay.endDate)} · ${esc(currentStay.currencyCode)}</small></div></div>`:'';
}

function emptyCard(text,button,label,kind='empty'){
  const icon=kind==='shopping'?'<svg viewBox="0 0 24 24"><path d="M3 5h2l2.2 9h9.8l2-6H6.2"/><circle cx="9" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/></svg>':kind==='people'?settingsIcon('people').replace('settings-icon','empty-inline-icon'):kind==='expenses'?expenseCategoryIcon('Misc'):'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  return `<div class="card empty premium-empty"><span class="empty-icon" aria-hidden="true">${icon}</span><strong>${esc(text)}</strong>${button?`<button class="btn primary full" ${button}>${esc(label)}</button>`:''}</div>`;
}

function expenseRow(expense,origin=route,{showTransfer=true}={}){
  const secondary=expense.audAmount!==null&&expense.audAmount!==undefined?formatAud(expense.audAmount):'';
  return `<div class="list-row expense-row" data-tone="${expenseTone(expense.category)}"><button class="expense-open" type="button" data-edit-expense="${esc(expense.id)}" data-return-route="${esc(origin)}" aria-label="Edit ${esc(expense.note||expense.category)} expense"><span class="expense-category-icon" aria-hidden="true">${expenseCategoryIcon(expense.category)}</span><span class="expense-copy"><strong>${esc(expense.note||expense.category)}</strong><small>${esc(expense.date)} · ${esc(expense.category)}</small></span><span class="amount"><strong>${formatLocal(expense.localAmount,expense.currencyCode)}</strong>${secondary?`<small>${secondary}</small>`:''}</span></button>${showTransfer?`<button class="mini transfer-button ${expense.transferred?'is-done':'transfer-wait'}" data-toggle-transfer="${esc(expense.id)}" aria-pressed="${expense.transferred?'true':'false'}">${expense.transferred?'Transferred':'To Transfer'}</button>`:''}</div>`;
}

async function renderHome(){
  const [expenses,shoppingRaw,people,categories]=await Promise.all([getAll('expenses'),getAll('shoppingItems'),getAll('people'),getAll('categories')]);
  const shopping=[...shoppingRaw].sort(shoppingSortStable);
  const pending=expenses.filter(expense=>!expense.transferred).sort(expenseSortNewest);
  const recent=[...expenses].sort(expenseSortNewest).slice(0,3);
  const counts=shoppingCounts(shopping);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const homeItems=shopping.slice(0,2);
  const homeArt=homeItems.length?homeItems.map(item=>{const category=categoryMap.get(item.categoryId);return `<span class="home-shopping-art product-art" data-state="${esc(item.state)}" aria-hidden="true">${productArt(item.itemName,category?.name||'Other')}</span>`;}).join(''):'<span class="home-shopping-empty-art" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 5h2l2.2 9h9.8l2-6H6.2"/><circle cx="9" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/></svg></span>';
  const shoppingStatus=shopping.length?`${counts.pending} to buy · ${counts.got} got · ${counts.unavailable} unavailable`:'Ready for your next shop';
  present(`${stayHero()}
    <div class="home-core-actions">
      <button class="home-action expense-home" data-add-expense><span class="home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span class="home-action-copy"><strong>Add Expense</strong><small>Quick ${esc(currentStay.currencyCode)} capture</small></span><span class="home-action-arrow" aria-hidden="true">›</span></button>
      <button class="home-action shopping-home" data-open-shopping><span class="home-shopping-pictures">${homeArt}</span><span class="home-action-copy"><strong>Shopping List</strong><small>${esc(shoppingStatus)}</small></span><span class="home-action-arrow" aria-hidden="true">›</span></button>
    </div>
    <button class="transfer-summary premium-transfer" data-open-expenses><span class="transfer-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 7h11l-3-3M19 17H8l3 3"/></svg></span><span class="transfer-copy"><strong>Expenses to transfer</strong><small>${pending.length?'Waiting to enter in Travel Command Centre':'Nothing waiting'}</small></span><span class="transfer-count">${pending.length}</span></button>
    <div class="section-title-row"><h3 class="section-title">Recent Expenses</h3><button class="section-link" type="button" data-open-expenses>View all</button></div><div class="list home-expense-list continuous-ledger">${recent.length?recent.map(expense=>expenseRow(expense,'home',{showTransfer:false})).join(''):emptyCard('No expenses yet','data-add-expense','Add Expense','expenses')}</div>`);
}
async function renderExpenses(){
  const expenses=await getAll('expenses');
  const pendingCount=expenses.filter(expense=>!expense.transferred).length;
  const transferredCount=expenses.length-pendingCount;
  let rows=[...expenses];
  if(expenseFilter==='pending')rows=rows.filter(expense=>!expense.transferred);
  else if(expenseFilter==='transferred')rows=rows.filter(expense=>expense.transferred);
  rows.sort(expenseSortNewest);
  present(`${pageHead('Expenses','To enter later.','Expenses')}${stayStrip()}
    <button class="btn primary full quick-add-button" data-add-expense>Add Expense</button>
    <div class="filters expense-filters" aria-label="Expense filters" aria-live="polite" aria-atomic="true">
      ${[['pending','To Transfer',pendingCount],['transferred','Transferred',transferredCount],['all','All',expenses.length]].map(([value,label,count])=>`<button class="filter ${expenseFilter===value?'is-active':''}" aria-pressed="${expenseFilter===value?'true':'false'}" data-expense-filter="${value}">${label} <b>${count}</b></button>`).join('')}
    </div>
    <div class="list continuous-ledger">${rows.length?rows.map(expense=>expenseRow(expense,'expenses')).join(''):emptyCard(expenseFilter==='pending'?'Nothing waiting to transfer':expenseFilter==='transferred'?'Nothing transferred yet':'No expenses yet','data-add-expense','Add Expense','expenses')}</div>`);
}
function expenseEditor(existing=null,defaults={}){
  const stay=existing?.staySnapshot||currentStay;
  if(!stay)return stayEditor('setup',true);
  expenseReturnRoute=defaults.returnRoute||route||'expenses';
  const defaultDate=existing?.date||defaults.date||todayAu();
  const selectedCategory=existing?.category||defaults.category||'';
  const editing=!!existing;
  present(`${subscreenBack(expenseReturnRoute==='home'?'Home':'Expenses',`data-editor-cancel data-cancel-route="${esc(expenseReturnRoute)}"`)} ${pageHead(editing?'Edit Expense':'Add Expense',editing?'Change what you need.':'Amount, category, save.','Expenses')}
    <form class="quick-expense-form" id="expenseForm">
      <div class="quick-amount-card">
        <div class="amount-card-head"><label for="expenseAmount">Amount</label><span>${esc(stay.currencyCode)}</span></div>
        <div class="amount-entry"><span class="amount-code">${esc(stay.currencyCode)}</span><input id="expenseAmount" name="localAmount" type="number" min="0.01" step="any" inputmode="decimal" autocomplete="off" placeholder="0" value="${existing?esc(existing.localAmount):''}" required></div>
      </div>
      <section class="expense-category-panel" aria-labelledby="categoryHeading">
        <div class="expense-section-head"><span><small>Required</small><strong id="categoryHeading">Category</strong></span><em id="categoryStatus" aria-live="polite" aria-atomic="true">${selectedCategory?esc(selectedCategory):'Choose one'}</em></div>
        <input type="hidden" name="category" id="expenseCategory" value="${esc(selectedCategory)}">
        <div class="expense-category-grid">${EXPENSE_CATEGORIES.map(category=>`<button type="button" class="expense-category-choice ${selectedCategory===category?'is-selected':''}" data-expense-category="${esc(category)}" data-tone="${expenseTone(category)}" aria-pressed="${selectedCategory===category?'true':'false'}"><span class="expense-choice-icon" aria-hidden="true">${expenseCategoryIcon(category)}</span><span>${esc(category)}</span></button>`).join('')}</div>
      </section>
      <button class="btn primary full save-expense-button" id="saveExpenseButton" type="submit" ${selectedCategory&&editing?'':'disabled'}>${editing?'Save Changes':'Save Expense'}</button>
      <details class="optional-details" ${editing?'open':''}>
        <summary>Optional details</summary>
        <div class="optional-details-body">
          <label>Date<input name="date" type="date" value="${esc(auDateToIso(defaultDate))}" required></label>
          <label>Note <span class="hint">Optional</span><input name="note" maxlength="180" placeholder="Lunch, taxi, tickets…" value="${esc(existing?.note||'')}"></label>
          ${editing?'<p class="micro-note">Saving an edited expense marks it To Transfer again.</p>':''}
        </div>
      </details>
      <button class="btn secondary full" type="button" data-editor-cancel data-cancel-route="${esc(expenseReturnRoute)}">Cancel</button>
    </form>
    ${editing?`<button class="btn danger full delete-below" data-delete-expense="${esc(existing.id)}">Delete Expense</button>`:''}`,
    {subscreen:true,focusSelector:editing?null:'#expenseAmount'});

  const form=screen.querySelector('#expenseForm');
  const amountInput=screen.querySelector('#expenseAmount');
  const categoryInput=screen.querySelector('#expenseCategory');
  const saveButton=screen.querySelector('#saveExpenseButton');
  const categoryStatus=screen.querySelector('#categoryStatus');
  const updateSaveState=()=>{
    const amount=Number(amountInput.value);
    const validAmount=Number.isFinite(amount)&&amount>0;
    const validCategory=EXPENSE_CATEGORIES.includes(categoryInput.value);
    saveButton.disabled=!(validAmount&&validCategory);
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
  present(`${pageHead('Shopping','','Shopping')}
    <div class="shopping-context"><div class="shopping-context-flag">${esc(currentStay.flag||'◉')}</div><div class="shopping-context-copy" aria-live="polite" aria-atomic="true"><strong>${esc(currentStay.city)} · ${esc(currentStay.country)}</strong><span>${counts.pending} to buy · ${counts.got} got · ${counts.unavailable} unavailable</span></div><span class="shopping-context-code">${esc(currentStay.currencyCode)}</span><div class="shopping-progress" aria-label="${counts.got} got and ${counts.unavailable} unavailable out of ${counts.all}"><span class="shopping-progress-got" style="width:${gotPct}%"></span><span class="shopping-progress-unavailable" style="left:${gotPct}%;width:${unavailablePct}%"></span></div></div>
    <div class="shopping-primary-actions"><button class="btn warm" data-add-shop><span class="button-line-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>Add Item</button><button class="btn secondary" data-regular-items><span class="button-line-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z"/></svg></span>Regular Items</button></div>
    ${items.length?`<div class="shopping-filterbar" role="group" aria-label="Shopping filters" aria-live="polite" aria-atomic="true">${[['all','All',counts.all],['to-buy','To Buy',counts.pending],['done','Done',counts.done]].map(([value,label,count])=>`<button class="shopping-filter ${shoppingFilter===value?'is-active':''}" type="button" data-shopping-filter="${value}" aria-pressed="${shoppingFilter===value?'true':'false'}"><span>${label}</span><b>${count}</b></button>`).join('')}</div><div class="shopping-list-head"><span>${shown.length} shown</span><button class="finish-inline" type="button" data-finish-shopping ${counts.got?'':'disabled'}>Finish Shopping</button></div>`:''}
    ${counts.unavailable?`<div class="shopping-unavailable-note"><span aria-hidden="true">${shoppingActionIcon('unavailable')}</span><strong>${counts.unavailable} unavailable</strong><small>${counts.unavailable===1?'This item will':'These items will'} stay for next time.</small></div>`:''}
    ${justFinishedShopping?`<div class="finished-shop-card"><strong>Shopping finished</strong><span>Add the shop total only if you want to remember it.</span><button class="btn primary full" data-shop-expense>Add Grocery Expense</button></div>`:''}
    <div class="shopping-list ${items.length?'has-items':''}">${shown.length?shown.map(item=>shoppingRow(item,personMap,categoryMap)).join(''):items.length?`<div class="shopping-filter-empty"><strong>No items in this view</strong><span>Try another filter.</span></div>`:emptyCard('Shopping list is empty','data-add-shop','Add Item','shopping')}</div>
    ${items.length?'<button class="btn warm full shopping-second-add" type="button" data-add-shop>Add Item</button>':''}`);
}
function shoppingRow(item,personMap,categoryMap){
  const person=personMap.get(item.requesterId);
  const category=categoryMap.get(item.categoryId);
  const art=productArt(item.itemName,category?.name||'Other');
  const meta=[item.quantity?`Qty ${item.quantity}`:'',item.note||''].filter(Boolean).join(' · ');
  const label=shoppingStateLabel(item.state);
  return `<article class="shop-row" data-state="${esc(item.state)}" data-tone="${categoryTone(category)}">
    <div class="shop-row-top">
      <button class="shop-item-main" data-edit-shop="${esc(item.id)}" aria-label="Edit ${esc(item.itemName)}">
        <span class="shop-item-picture product-art" aria-hidden="true">${art}</span>
        <span class="shop-item-copy"><span class="shop-title-line"><small class="shop-category-chip">${esc(category?.name||'Other')}</small><em class="shop-state ${esc(item.state)}">${esc(label)}</em></span><strong>${esc(item.itemName)}</strong>${meta?`<small>${esc(meta)}</small>`:''}</span>
      </button>
      ${person?`<div class="initials" title="${esc(person.name)}">${esc(person.initials)}</div>`:''}
    </div>
    <div class="shop-actions">
      <button class="btn shop-state-control ${item.state==='got'?'secondary':'success'}" type="button" data-shop-state="got" data-shop-id="${esc(item.id)}" aria-label="${item.state==='got'?'Undo Got It':'Mark Got It'}" aria-pressed="${item.state==='got'?'true':'false'}">${shoppingActionIcon(item.state==='got'?'undo':'got')}<span class="sr-only">${item.state==='got'?'Undo':'Got It'}</span></button>
      <button class="btn shop-state-control ${item.state==='couldnt'?'secondary':'unavailable'}" type="button" data-shop-state="couldnt" data-shop-id="${esc(item.id)}" aria-label="${item.state==='couldnt'?"Undo Couldn’t Get":"Mark Couldn’t Get"}" aria-pressed="${item.state==='couldnt'?'true':'false'}">${shoppingActionIcon(item.state==='couldnt'?'undo':'unavailable')}<span class="sr-only">${item.state==='couldnt'?'Undo':"Couldn’t Get"}</span></button>
    </div>
  </article>`;
}
async function showAddShopping(category=null){
  const [categories,catalogue]=await Promise.all([getAll('categories'),getAll('catalogue')]);
  if(!category){
    const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
    present(`${subscreenBack('Shopping')} ${pageHead('Add Item','Tap a picture.','Shopping')}
      <div class="category-grid">${ordered.map(c=>`<button class="category-box" data-tone="${categoryTone(c)}" data-choose-category="${esc(c.id)}"><span class="category-picture" aria-hidden="true">${categoryHeroArt(c.name)}</span><span class="category-label"><span class="category-line-art">${categoryArt(c)}</span><strong>${esc(c.name)}</strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span></button>`).join('')}</div>
      <details class="meal-ideas-panel"><summary><span>Meal Ideas</span><small>Optional inspiration</small></summary><div class="meal-ideas">${mealIdeas.map(idea=>`<span>${esc(idea)}</span>`).join('')}</div></details>
      <button class="btn secondary full back-button" data-back-shopping>Back to Shopping</button>`,{subscreen:true});
    return;
  }
  const matches=catalogue.filter(item=>item.categoryId===category.id).sort((a,b)=>a.name.localeCompare(b.name));
  present(`${subscreenBack('Categories','data-add-shop')} ${pageHead(category.name,'Tap an item to add it.','Shopping')}
    <div class="catalogue-grid">${matches.map(item=>`<button class="catalogue-tile" data-tone="${categoryTone(category)}" data-quick-shop-item="${esc(item.id)}"><span class="catalogue-picture product-art" aria-hidden="true">${productArt(item.name,category.name)}</span><strong>${esc(item.name)}</strong></button>`).join('')||`<div class="span-two">${emptyCard('No saved items in this category yet','','','shopping')}</div>`}</div>
    <button class="btn warm full custom-shop-button" data-custom-shop="${esc(category.id)}">Add Something Else</button>
    <button class="btn secondary full" data-add-shop>Back to Categories</button>`,{subscreen:true});
}
async function customShoppingItemEditor(category){
  const [people,activeItems]=await Promise.all([getAll('people'),getAll('shoppingItems')]);
  present(`${subscreenBack(category.name,`data-back-category="${esc(category.id)}"`)} ${pageHead('Add Item','Just the name is required.','Shopping')}
    <div class="shopping-editor-context" data-tone="${categoryTone(category)}"><span class="shopping-editor-context-icon category-line-art" aria-hidden="true">${categoryArt(category)}</span><span><small>Category</small><strong>${esc(category.name)}</strong></span></div>
    <div id="shoppingLivePreview">${shoppingPreviewMarkup({categoryName:category.name})}</div>
    <form class="editor-card simple-shopping-editor" id="shoppingItemForm">
      <label>Item name<input id="customShoppingName" name="itemName" required maxlength="80" autocomplete="off"></label>
      <button class="btn warm full" type="submit">Add Item</button>
      <details class="optional-details"><summary>Optional details</summary><div class="optional-details-body">
        <label>Quantity<input name="quantity" maxlength="30"></label>
        <label>Requester<select name="requesterId"><option value="">None</option>${people.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></label>
        <label>Note<input name="note" maxlength="160"></label>
      </div></details>
      <button type="button" class="btn secondary full" data-back-category="${esc(category.id)}">Cancel</button>
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
      <div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-shopping>Cancel</button><button class="btn warm" type="submit">Save</button></div>
    </form>
    <button class="btn danger full delete-below" data-delete-shop="${esc(item.id)}">Remove Item</button>`,{subscreen:true});
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
    <div class="regular-grid">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<div class="regular-card" data-tone="${categoryTone(category)}"><span class="catalogue-picture product-art" aria-hidden="true">${productArt(item.name,category?.name||'Other')}</span><div><strong>${esc(item.name)}</strong><small>${esc(category?.name||'Other')}</small></div><button class="mini" data-add-regular="${esc(item.id)}">Add</button></div>`;}).join(''):`<div class="span-two">${emptyCard('No Regular Items yet','','','shopping')}</div>`}</div>
    <button class="btn warm full" data-add-regular-inline>Add Regular Item</button>
    <button class="btn secondary full" data-back-shopping>Back</button>`,{subscreen:true});
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
      <div class="button-row"><button class="btn secondary" data-edit-stay>Edit Stay</button><button class="btn primary" data-change-stay>Change Stay</button></div>
    </section>
    <section class="settings-section settings-shopping" data-tone="gold"><h2>Shopping Setup</h2>
      <button class="settings-row" data-tone="blue" data-manage-people>${settingsIcon('people')}<span class="settings-row-copy"><strong>People</strong><span>${people.length} requester${people.length===1?'':'s'}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="gold" data-manage-categories>${settingsIcon('categories')}<span class="settings-row-copy"><strong>Categories</strong><span>${categories.length} available</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="teal" data-manage-regulars>${settingsIcon('regular')}<span class="settings-row-copy"><strong>Regular Items</strong><span>${regulars.length} saved</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="purple" data-manage-custom>${settingsIcon('custom')}<span class="settings-row-copy"><strong>Custom Items</strong><span>${catalogue.filter(item=>!item.builtIn).length} saved</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
    </section>
    <section class="settings-section settings-advanced" data-tone="silver"><h2>More</h2>
      <button class="settings-row" data-tone="silver" data-advanced-settings>${settingsIcon('advanced')}<span class="settings-row-copy"><strong>Advanced</strong><span>List transfer, optional AUD conversion and reset</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
    </section>
    <p class="app-version">Travel Buddy V1 · Build ${esc(BUILD_VERSION)} · Offline local PWA</p>`);
}

async function advancedSettings(){
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Advanced','','Settings')}
    <div class="settings-list premium-settings-list">
      <button class="settings-row" data-tone="gold" data-shopping-tools>${settingsIcon('transfer')}<span class="settings-row-copy"><strong>Shopping List Transfer</strong><span>Manual share/import only</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row" data-tone="teal" data-exchange-rate>${settingsIcon('rate')}<span class="settings-row-copy"><strong>Optional AUD Conversion</strong><span>${stayRate(currentStay)?`1 AUD = ${esc(stayRate(currentStay))} ${esc(currentStay.currencyCode)}`:'Off'}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      <button class="settings-row danger" data-tone="red" data-reset>${settingsIcon('reset')}<span class="settings-row-copy"><strong>Reset Travel Buddy</strong><span>Erase local Travel Buddy data</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
    </div>
    <button class="btn secondary full back-button" data-back-settings>Back</button>`,{subscreen:true});
}

async function stayEditor(mode='edit',force=false){
  const base=mode==='edit'?currentStay:null;
  const title=mode==='setup'?'Current Stay Setup':mode==='change'?'Change Current Stay':'Edit Current Stay';
  const subtitle=mode==='setup'?'Country, place and dates. That’s it.':mode==='change'?'Set the next place.':'Correct the current place or dates.';
  const existingExpenses=mode==='edit'&&base?await getAll('expenses'):[];
  const countryLocked=!!(base&&existingExpenses.some(expense=>expense.stayId===base.id));
  if(force)setNavigationEnabled(false);
  const options=COUNTRIES.map(country=>`<option value="${esc(country.name)}"></option>`).join('');
  present(`${force?'':subscreenBack('Settings','data-back-settings')} ${pageHead(title,subtitle,'Settings')}
    <div class="stay-live-preview" id="stayLivePreview"><small>Current Stay Preview</small><div class="stay-preview-main"><span class="stay-preview-flag">${esc(base?.flag||'◉')}</span><span><strong>${esc(base?.country||'Choose a country')}</strong><em>${esc(base?.city||'City / Destination')}</em></span></div><div class="stay-preview-dates">${esc(base?.startDate||'Start date')} – ${esc(base?.endDate||'End date')}</div></div>
    <form class="editor-card quick-stay premium-stay-editor" id="stayForm">
      <label><span class="field-label">${stayFieldIcon('country')}<span>Country</span></span><input name="country" list="countryList" required maxlength="60" autocomplete="off" placeholder="Start typing a country" value="${esc(base?.country||'')}" ${countryLocked?'readonly':''}><datalist id="countryList">${options}</datalist></label>
      <div class="auto-country ${base?'is-ready':''}" id="countryAuto" ${base?'':'hidden'}>${base?`${esc(base.flag)} ${esc(base.currencyCode)} · ${esc(base.currencyName)}`:''}</div>
      ${countryLocked?'<p class="micro-note">Use Change Stay when you move to another country.</p>':''}
      <label><span class="field-label">${stayFieldIcon('city')}<span>City / Destination</span></span><input name="city" required maxlength="80" autocomplete="address-level2" placeholder="City or place" value="${esc(base?.city||'')}"></label>
      <div class="stay-date-stack"><label><span class="field-label">${stayFieldIcon('start')}<span>Stay start</span></span><input name="startDate" type="date" required value="${esc(auDateToIso(base?.startDate||''))}"></label><label><span class="field-label">${stayFieldIcon('end')}<span>Stay end</span></span><input name="endDate" type="date" required value="${esc(auDateToIso(base?.endDate||''))}"></label></div>
      <div class="editor-actions static-actions">${force?'':'<button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">Cancel</button>'}<button class="btn primary" type="submit">${mode==='setup'?'Start Travel Buddy':mode==='change'?'Change Stay':'Save'}</button></div>
    </form>`,{subscreen:true});

  const form=screen.querySelector('#stayForm');
  const countryInput=form.elements.country;
  const auto=screen.querySelector('#countryAuto');
  const preview=screen.querySelector('#stayLivePreview');
  const updatePreview=()=>{const ref=findCountry(countryInput.value);const city=String(form.elements.city.value||'').trim();const start=isoDateToAu(form.elements.startDate.value)||'Start date';const end=isoDateToAu(form.elements.endDate.value)||'End date';preview.innerHTML=`<small>Current Stay Preview</small><div class="stay-preview-main"><span class="stay-preview-flag">${esc(ref?.flag||'◉')}</span><span><strong>${esc(ref?.name||countryInput.value||'Choose a country')}</strong><em>${esc(city||'City / Destination')}</em></span></div><div class="stay-preview-dates">${esc(start)} – ${esc(end)}</div>`;};
  const updateCountry=()=>{
    const ref=findCountry(countryInput.value);
    auto.hidden=!ref;
    auto.textContent=ref?`${ref.flag} ${ref.currencyCode} · ${ref.currencyName}`:'';
    auto.classList.toggle('is-ready',!!ref);
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
  present(`${subscreenBack('Advanced','data-advanced-settings')} ${pageHead('Optional AUD Conversion','Only use this if you want an AUD figure saved too.','Settings')}
    <form class="editor-card" id="rateForm"><label>1 AUD = <span class="hint">${esc(currentStay.currencyCode)}</span><input id="rateInput" name="exchangeRate" type="number" min="0.000001" step="any" inputmode="decimal" placeholder="Leave blank to turn it off" value="${esc(stayRate(currentStay)||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true});
  screen.querySelector('#rateForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const raw=String(new FormData(event.currentTarget).get('exchangeRate')||'').trim();
    let rate=null;
    if(raw){rate=Number(raw);if(!Number.isFinite(rate)||rate<=0){await showMessage('Check the exchange rate','Enter a valid exchange rate or leave it blank.');return;}}
    currentStay={...currentStay,exchangeRate:rate,modifiedAt:now()};
    await putRecord('stays',currentStay);
    await renderRoute('settings');
  });
}

async function managePeople(){
  const people=await getAll('people');
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('People','Requester initials for Shopping.','Settings')}
    <div class="management-summary-band" data-tone="blue"><span class="management-summary-icon">${settingsIcon('people')}</span><span><small>Shopping Requesters</small><strong>${people.length} ${people.length===1?'person':'people'}</strong></span></div>
    <div class="management-list">${people.length?people.map(person=>`<article class="management-card person-card" data-tone="blue"><div class="person-avatar">${esc(person.initials)}</div><div class="management-copy"><strong>${esc(person.name)}</strong><span>Initials · ${esc(person.initials)}</span></div><div class="mini-actions"><button class="mini" data-edit-person="${esc(person.id)}">Edit</button><button class="mini danger" data-delete-person="${esc(person.id)}">Delete</button></div></article>`).join(''):emptyCard('No people yet','','','people')}<button class="btn primary full" data-add-person>Add Person</button></div>
    <button class="btn secondary full back-button" data-back-settings>Back</button>`,{subscreen:true});
}

async function personEditor(person=null){
  personEditorReturn='people';
  present(`${subscreenBack('People','data-back-people')} ${pageHead(person?'Edit Person':'Add Person','Name and initials.','Settings')}
    <div class="management-editor-preview" id="personPreview"><span class="person-avatar">${esc(person?.initials||'—')}</span><span><small>Requester Preview</small><strong>${esc(person?.name||'Person name')}</strong><em>${esc(person?.initials||'Initials')}</em></span></div>
    <form class="editor-card" id="personForm"><label>Name<input id="personName" name="name" required maxlength="60" value="${esc(person?.name||'')}"></label><label>Initials<input name="initials" maxlength="3" value="${esc(person?.initials||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-people>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:person?null:'#personName'});
  const form=screen.querySelector('#personForm'), preview=screen.querySelector('#personPreview');
  const refresh=()=>{const name=String(form.elements.name.value||'').trim();const initials=normalizeInitials(name,form.elements.initials.value);preview.innerHTML=`<span class="person-avatar">${esc(initials||'—')}</span><span><small>Requester Preview</small><strong>${esc(name||'Person name')}</strong><em>${esc(initials||'Initials')}</em></span>`;};
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
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Categories','Used when adding items.','Shopping Setup')}<div class="management-summary-band" data-tone="gold"><span class="management-summary-icon">${settingsIcon('categories')}</span><span><small>Shopping Categories</small><strong>${ordered.length} available</strong></span></div><div class="management-list">${ordered.map(category=>`<article class="management-card" data-tone="${categoryTone(category)}"><span class="management-item-icon category-line-art" aria-hidden="true">${categoryArt(category)}</span><div class="management-copy"><strong>${esc(category.name)}</strong><span>${category.builtIn?'Built in':'Custom category'}</span></div><div class="mini-actions"><button class="mini" data-rename-category="${esc(category.id)}">Rename</button>${category.builtIn?'':`<button class="mini danger" data-delete-category="${esc(category.id)}">Delete</button>`}</div></article>`).join('')}<button class="btn secondary full" data-add-category>Add Category</button></div><button class="btn secondary full back-button" data-back-settings>Back</button>`,{subscreen:true});
}

async function categoryEditor(category=null){
  present(`${subscreenBack('Categories','data-back-categories')} ${pageHead(category?'Rename Category':'Add Category','The active shopping list stays continuous.','Shopping Setup')}
    <div class="management-editor-preview category-editor-preview" id="categoryPreview" data-tone="${categoryTone(category?.name||'Other')}"><span class="management-preview-icon category-line-art">${categoryArt(category?.name||'Other')}</span><span><small>Category Preview</small><strong>${esc(category?.name||'Category name')}</strong><em>${category?.builtIn?'Built in':'Custom category'}</em></span></div>
    <form class="editor-card" id="categoryForm"><label>Category name<input id="categoryName" name="name" required maxlength="60" value="${esc(category?.name||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-categories>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:category?null:'#categoryName'});
  const form=screen.querySelector('#categoryForm'), preview=screen.querySelector('#categoryPreview');
  const refresh=()=>{const name=String(form.elements.name.value||'').trim()||'Category name';preview.dataset.tone=categoryTone(name);preview.innerHTML=`<span class="management-preview-icon category-line-art">${categoryArt(name)}</span><span><small>Category Preview</small><strong>${esc(name)}</strong><em>${category?.builtIn?'Built in':'Custom category'}</em></span>`;};form.elements.name.addEventListener('input',refresh);refresh();
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
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Custom Items','Reusable items you have added.','Shopping Setup')}<div class="management-summary-band" data-tone="purple"><span class="management-summary-icon">${settingsIcon('custom')}</span><span><small>Reusable Catalogue</small><strong>${rows.length} custom ${rows.length===1?'item':'items'}</strong></span></div><div class="management-list">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<article class="management-card" data-tone="${categoryTone(category)}"><span class="management-item-icon product-icon product-art" aria-hidden="true">${productArt(item.name,category?.name||'Other')}</span><div class="management-copy"><strong>${esc(item.name)}</strong><span>${esc(category?.name||'Other')}</span></div><div class="mini-actions"><button class="mini" data-edit-custom="${esc(item.id)}">Edit</button><button class="mini danger" data-delete-custom="${esc(item.id)}">Delete</button></div></article>`;}).join(''):emptyCard('No custom items yet','','','shopping')}<button class="btn secondary full" data-add-custom>Add Custom Item</button></div><button class="btn secondary full back-button" data-back-settings>Back</button>`,{subscreen:true});
}

async function customEditor(item=null){
  const categories=await getAll('categories');
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  const initialCategory=ordered.find(category=>category.id===item?.categoryId)||ordered[0];
  present(`${subscreenBack('Custom Items','data-back-custom')} ${pageHead(item?'Edit Custom Item':'Add Custom Item','Saved for future shops.','Shopping Setup')}<div id="customPreview">${shoppingPreviewMarkup({itemName:item?.name||'',categoryName:initialCategory?.name||'Other',eyebrow:'Reusable Item Preview'})}</div><form class="editor-card" id="customForm"><label>Item name<input id="customItemName" name="name" required maxlength="80" value="${esc(item?.name||'')}"></label><label>Category<select name="categoryId">${ordered.map(category=>`<option value="${esc(category.id)}" ${category.id===item?.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-custom>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:item?null:'#customItemName'});
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
  present(`${subscreenBack('Settings','data-back-settings')} ${pageHead('Regular Items','Things you buy often.','Shopping Setup')}<div class="management-summary-band" data-tone="teal"><span class="management-summary-icon">${settingsIcon('regular')}</span><span><small>Quick Add Favourites</small><strong>${rows.length} regular ${rows.length===1?'item':'items'}</strong></span></div><div class="management-list">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<article class="management-card" data-tone="${categoryTone(category)}"><span class="management-item-icon product-icon product-art" aria-hidden="true">${productArt(item.name,category?.name||'Other')}</span><div class="management-copy"><strong>${esc(item.name)}</strong><span>${esc(category?.name||'Other')}</span></div><div class="mini-actions"><button class="mini" data-edit-regular="${esc(item.id)}">Edit</button><button class="mini danger" data-delete-regular="${esc(item.id)}">Delete</button></div></article>`;}).join(''):emptyCard('No Regular Items yet','','','shopping')}<button class="btn primary full" data-add-regular-setting>Add Regular Item</button></div><button class="btn secondary full back-button" data-back-settings>Back</button>`,{subscreen:true});
}

async function regularEditor(item=null,returnTo='settings'){
  regularEditorReturn=returnTo;
  const [categories,regulars]=await Promise.all([getAll('categories'),getAll('regularItems')]);
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  const initialCategory=ordered.find(category=>category.id===item?.categoryId)||ordered[0];
  present(`${subscreenBack(returnTo==='shopping'?'Regular Items':'Regular Items','data-regular-cancel')} ${pageHead(item?'Edit Regular Item':'Add Regular Item','Saved for quick reuse.','Shopping')}<div id="regularPreview">${shoppingPreviewMarkup({itemName:item?.name||'',categoryName:initialCategory?.name||'Other',eyebrow:'Regular Item Preview'})}</div><form class="editor-card" id="regularForm"><label>Item name<input id="regularItemName" name="name" required maxlength="80" value="${esc(item?.name||'')}"></label><label>Category<select name="categoryId">${ordered.map(category=>`<option value="${esc(category.id)}" ${category.id===item?.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-regular-cancel>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:item?null:'#regularItemName'});
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
  present(`${subscreenBack('Advanced','data-advanced-settings')} ${pageHead('Shopping List Transfer','Manual only. No sync.','Settings')}<div class="settings-list premium-settings-list"><button class="settings-row" data-tone="gold" data-share-shopping>${settingsIcon('transfer')}<span class="settings-row-copy"><strong>Share Shopping List</strong><span>Send a versioned list file.</span></span><span class="row-chevron" aria-hidden="true">›</span></button><button class="settings-row" data-tone="teal" data-import-shopping>${settingsIcon('transfer')}<span class="settings-row-copy"><strong>Import Shopping List</strong><span>Merge safely without replacing this list.</span></span><span class="row-chevron" aria-hidden="true">›</span></button></div><button class="btn secondary full back-button" data-back-settings>Back</button>`,{subscreen:true});
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

    launchBrand.classList.remove('is-visible');
    await delay(320);
    if(currentStay){
      launchStay.innerHTML=`<div class="launch-stay-flag">${esc(currentStay.flag||'◉')}</div><div class="launch-stay-country">${esc(currentStay.country)}</div><div class="launch-stay-city">${esc(currentStay.city)}</div><div class="launch-stay-dates">${esc(currentStay.startDate)} – ${esc(currentStay.endDate)}</div>`;
      launchStay.classList.add('is-visible');
      await delay(1550);
      launchStay.classList.remove('is-visible');
      await delay(360);
    }
    launch.remove();
    app.hidden=false;
    if(!currentStay){setRoute('settings');setNavigationEnabled(false);await stayEditor('setup',true);}else{setNavigationEnabled(true);await renderRoute('home');}
    if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
  }catch(error){
    console.error(error);
    document.body.innerHTML='<main style="padding:calc(env(safe-area-inset-top) + 24px) 24px 24px;color:white;background:#071018;min-height:100vh">Travel Buddy could not start safely. Close any other Travel Buddy tab and reopen the app.</main>';
  }
}

autoLaunch();
