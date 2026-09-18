import {ensureSeedData,getAll,getRecord,putRecord,deleteRecord,resetDatabase,atomicWrite} from './db.js';
import {
  BUILD_VERSION,EXPENSE_CATEGORIES,SHOPPING_STATES,MAX_IMPORT_BYTES,MAX_IMPORT_ITEMS,
  validateAuDate,auDateToSort,isoDateToAu,auDateToIso,todayAu,formatAud,formatLocal,
  expenseSortNewest,shoppingSortStable,nextShoppingOrder,finishShopping,normalizeInitials,
  nonBlank,buildExpenseRecord,validateShoppingEnvelope,normalizeShoppingImportItem,mergeImportedShopping
} from './logic.js';
import {COUNTRIES,findCountry} from './country-data.js';

const screen=document.querySelector('#screen');
const app=document.querySelector('#app');
const bottomNav=document.querySelector('#bottomNav');
const launch=document.querySelector('#launch');
const launchBrand=document.querySelector('#launchBrand');
const launchStay=document.querySelector('#launchStay');
const navButtons=[...document.querySelectorAll('.nav-item')];
const importInput=document.querySelector('#shoppingImportFile');

let route='home';
let currentStay=null;
let expenseFilter='pending';
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
const expenseTone=category=>({Groceries:'teal','Eating Out':'gold',Transport:'blue',Entertainment:'purple',Shopping:'rose',Misc:'silver'})[category]||'silver';

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

function categoryIcon(category){
  if(category?.icon)return category.icon;
  const name=String(category?.name||category||'').toLowerCase();
  if(name.includes('fruit')||name.includes('veg'))return'🥦';
  if(name.includes('meat'))return'🥩';
  if(name.includes('dairy'))return'🥛';
  if(name.includes('bakery'))return'🥖';
  if(name.includes('pantry'))return'🥫';
  if(name.includes('frozen'))return'❄️';
  if(name.includes('drink'))return'🥤';
  if(name.includes('house'))return'🧽';
  if(name.includes('toilet'))return'🧴';
  if(name.includes('pharmacy'))return'💊';
  return'🛒';
}

function itemIcon(name,category=null,storedIcon=''){
  if(storedIcon)return storedIcon;
  const text=String(name||'').toLowerCase();
  const rules=[
    [/apple/,'🍎'],[/banana/,'🍌'],[/orange/,'🍊'],[/grape/,'🍇'],[/strawber/,'🍓'],[/avocado/,'🥑'],[/tomato/,'🍅'],[/potato/,'🥔'],[/carrot/,'🥕'],[/broccoli/,'🥦'],[/lettuce/,'🥬'],[/onion/,'🧅'],
    [/chicken/,'🍗'],[/bacon/,'🥓'],[/sausage/,'🌭'],[/(beef|steak|pork)/,'🥩'],[/(fish|salmon)/,'🐟'],
    [/milk/,'🥛'],[/cheese/,'🧀'],[/yog(h)?urt/,'🥣'],[/butter/,'🧈'],[/egg/,'🥚'],
    [/(bread|roll)/,'🍞'],[/croissant/,'🥐'],[/wrap/,'🫓'],[/muffin/,'🧁'],
    [/rice/,'🍚'],[/pasta/,'🍝'],[/cereal/,'🥣'],[/coffee/,'☕'],[/tea/,'🍵'],[/chocolate/,'🍫'],[/snack/,'🍿'],[/tin(ned)?/,'🥫'],
    [/pizza/,'🍕'],[/ice cream/,'🍨'],[/chip/,'🍟'],[/frozen/,'🧊'],[/water/,'💧'],[/juice/,'🧃'],[/(soft drink|soda)/,'🥤'],
    [/(toilet paper|paper towel)/,'🧻'],[/detergent/,'🧺'],[/(dishwash|sponge|cleaning)/,'🧽'],[/bin bag/,'🗑️'],
    [/tooth/,'🪥'],[/(shampoo|conditioner|deodorant|sunscreen|body wash)/,'🧴'],[/soap/,'🧼'],[/tissue/,'🤧'],
    [/(pain|cold|flu|tablet|medicine)/,'💊'],[/bandage/,'🩹'],[/battery/,'🔋'],[/charger/,'🔌'],[/umbrella/,'☂️'],[/gift/,'🎁']
  ];
  for(const [pattern,icon] of rules)if(pattern.test(text))return icon;
  return categoryIcon(category);
}

function stayHero(stay=currentStay){
  if(!stay)return'';
  return `<section class="hero compact-hero"><div class="hero-top"><div class="flag">${esc(stay.flag||'◉')}</div><div><p class="eyebrow">Travel Buddy · Current Stay</p><h2>${esc(stay.country)}</h2><p>${esc(stay.city)}</p></div></div><div class="hero-meta"><span class="pill">${esc(stay.startDate)} – ${esc(stay.endDate)}</span><span class="pill">${esc(stay.currencyCode)}</span></div></section>`;
}

function stayStrip(){
  return currentStay?`<div class="screen-title-strip compact"><div class="flag">${esc(currentStay.flag||'◉')}</div><div><strong>${esc(currentStay.country)} · ${esc(currentStay.city)}</strong><small>${esc(currentStay.currencyCode)}</small></div></div>`:'';
}

function emptyCard(text,button,label){
  return `<div class="card empty">${esc(text)}${button?`<button class="btn primary full" ${button}>${esc(label)}</button>`:''}</div>`;
}

function expenseRow(expense,origin=route,{showTransfer=true}={}){
  const secondary=expense.audAmount!==null&&expense.audAmount!==undefined?formatAud(expense.audAmount):'';
  return `<div class="list-row expense-row" data-tone="${expenseTone(expense.category)}"><button class="expense-open" type="button" data-edit-expense="${esc(expense.id)}" data-return-route="${esc(origin)}" aria-label="Edit ${esc(expense.note||expense.category)} expense"><span class="expense-copy"><strong>${esc(expense.note||expense.category)}</strong><small>${esc(expense.date)}${expense.category&&expense.category!=='Misc'?` · ${esc(expense.category)}`:''}</small></span><span class="amount"><strong>${formatLocal(expense.localAmount,expense.currencyCode)}</strong>${secondary?`<small>${secondary}</small>`:''}</span></button>${showTransfer?`<button class="mini transfer-button ${expense.transferred?'is-done':'transfer-wait'}" data-toggle-transfer="${esc(expense.id)}" aria-pressed="${expense.transferred?'true':'false'}">${expense.transferred?'Transferred':'To Transfer'}</button>`:''}</div>`;
}

async function renderHome(){
  const [expenses,shopping]=await Promise.all([getAll('expenses'),getAll('shoppingItems')]);
  const pending=expenses.filter(expense=>!expense.transferred).sort(expenseSortNewest);
  const recent=[...expenses].sort(expenseSortNewest).slice(0,3);
  const couldnt=shopping.filter(item=>item.state==='couldnt').length;
  present(`${stayHero()}
    <button class="home-action expense-home" data-add-expense><span class="home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span><strong>Add Expense</strong><small>Quick ${esc(currentStay.currencyCode)} capture</small></span></button>
    <button class="home-action shopping-home" data-open-shopping><span class="home-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 5h2l2.2 9h9.8l2-6H6.2"/><circle cx="9" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/></svg></span><span><strong>Shopping List</strong><small>${shopping.length} active${couldnt?` · ${couldnt} couldn’t get`:''}</small></span></button>
    <button class="transfer-summary" data-open-expenses><span>Expenses to transfer</span><strong>${pending.length}</strong></button>
    ${recent.length?`<h3 class="section-title">Recent Expenses</h3><div class="list">${recent.map(expense=>expenseRow(expense,'home',{showTransfer:false})).join('')}</div>`:''}`);
}

async function renderExpenses(){
  const expenses=await getAll('expenses');
  let rows=[...expenses];
  if(expenseFilter==='pending')rows=rows.filter(expense=>!expense.transferred);
  else if(expenseFilter==='transferred')rows=rows.filter(expense=>expense.transferred);
  rows.sort(expenseSortNewest);
  present(`${pageHead('Expenses','To enter later.','Expenses')}${stayStrip()}
    <button class="btn primary full quick-add-button" data-add-expense>Add Expense</button>
    <div class="filters expense-filters" aria-label="Expense filters">
      ${[['pending','To Transfer'],['transferred','Transferred'],['all','All']].map(([value,label])=>`<button class="filter ${expenseFilter===value?'is-active':''}" aria-pressed="${expenseFilter===value?'true':'false'}" data-expense-filter="${value}">${label}</button>`).join('')}
    </div>
    <div class="list">${rows.length?rows.map(expense=>expenseRow(expense,'expenses')).join(''):emptyCard(expenseFilter==='pending'?'Nothing waiting to transfer':'No expenses yet','data-add-expense','Add Expense')}</div>`);
}

function expenseEditor(existing=null,defaults={}){
  const stay=existing?.staySnapshot||currentStay;
  if(!stay)return stayEditor('setup',true);
  expenseReturnRoute=defaults.returnRoute||route||'expenses';
  const defaultDate=existing?.date||defaults.date||todayAu();
  const category=existing?.category||defaults.category||'Misc';
  present(`${pageHead(existing?'Edit Expense':'Add Expense',existing?'Change what you need.':'Type the amount and save.','Expenses')}
    <form class="quick-expense-form" id="expenseForm">
      <div class="quick-amount-card">
        <label for="expenseAmount">Amount</label>
        <div class="amount-entry"><span class="amount-code">${esc(stay.currencyCode)}</span><input id="expenseAmount" name="localAmount" type="number" min="0.01" step="any" inputmode="decimal" autocomplete="off" placeholder="0" value="${existing?esc(existing.localAmount):''}" required></div>
        <button class="btn primary full save-expense-button" type="submit">Save Expense</button>
      </div>
      <details class="optional-details" ${existing?'open':''}>
        <summary>Optional details</summary>
        <div class="optional-details-body">
          <label>Date<input name="date" type="date" value="${esc(auDateToIso(defaultDate))}" required></label>
          <label>Category<select name="category">${EXPENSE_CATEGORIES.map(c=>`<option ${c===category?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
          <label>Note <span class="hint">Optional</span><input name="note" maxlength="180" placeholder="Lunch, taxi, tickets…" value="${esc(existing?.note||'')}"></label>
          ${existing?'<p class="micro-note">Saving an edited expense marks it To Transfer again.</p>':''}
        </div>
      </details>
      <button class="btn secondary full" type="button" data-editor-cancel data-cancel-route="${esc(expenseReturnRoute)}">Cancel</button>
    </form>
    ${existing?`<button class="btn danger full delete-below" data-delete-expense="${esc(existing.id)}">Delete Expense</button>`:''}`,
    {subscreen:true,focusSelector:existing?null:'#expenseAmount'});

  const form=screen.querySelector('#expenseForm');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    const dateAu=isoDateToAu(data.date);
    if(!dateAu){alert('Choose a valid expense date.');return;}
    const amount=Number(data.localAmount);
    if(!Number.isFinite(amount)||amount<=0){alert(`Enter the ${stay.currencyCode} amount.`);screen.querySelector('#expenseAmount')?.focus();return;}
    data.date=dateAu;
    try{
      const record=buildExpenseRecord({existing,form:data,stay});
      await putRecord('expenses',record);
      await renderRoute(expenseReturnRoute);
    }catch(error){console.error(error);alert('That expense could not be saved. Check the amount and try again.');}
  });
}

async function renderShopping(){
  const [itemsRaw,people,categories]=await Promise.all([getAll('shoppingItems'),getAll('people'),getAll('categories')]);
  const items=[...itemsRaw].sort(shoppingSortStable);
  const personMap=new Map(people.map(person=>[person.id,person]));
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const couldnt=items.filter(item=>item.state==='couldnt').length;
  present(`${pageHead('Shopping','','Shopping')}
    <div class="shopping-primary-actions"><button class="btn warm" data-add-shop><span class="button-icon">＋</span>Add Item</button><button class="btn secondary" data-regular-items><span class="button-icon">★</span>Regular Items</button></div>
    ${items.length?`<button class="btn finish full finish-shopping" data-finish-shopping>Finish Shopping</button>`:''}
    ${couldnt?`<div class="notice compact-notice">${couldnt} couldn’t-get item${couldnt===1?'':'s'} will stay for next time.</div>`:''}
    ${justFinishedShopping?`<div class="finished-shop-card"><strong>Shopping finished</strong><span>Add the shop total only if you want to remember it.</span><button class="btn primary full" data-shop-expense>Add Grocery Expense</button></div>`:''}
    <div class="shopping-list">${items.length?items.map(item=>shoppingRow(item,personMap,categoryMap)).join(''):emptyCard('Shopping list is empty','data-add-shop','Add Item')}</div>`);
}

function shoppingRow(item,personMap,categoryMap){
  const person=personMap.get(item.requesterId);
  const category=categoryMap.get(item.categoryId);
  const icon=itemIcon(item.itemName,category,item.icon);
  const meta=[item.quantity?`Qty ${item.quantity}`:'',item.note||''].filter(Boolean).join(' · ');
  return `<article class="shop-row" data-state="${esc(item.state)}" data-tone="${categoryTone(category)}">
    <div class="shop-row-top">
      <button class="shop-item-main" data-edit-shop="${esc(item.id)}" aria-label="Edit ${esc(item.itemName)}">
        <span class="shop-item-picture" aria-hidden="true">${esc(icon)}</span>
        <span class="shop-item-copy"><strong>${esc(item.itemName)}</strong>${meta?`<small>${esc(meta)}</small>`:''}${item.state!=='pending'?`<em class="shop-state ${item.state}">${item.state==='got'?'Got It':'Couldn’t Get'}</em>`:''}</span>
      </button>
      ${person?`<div class="initials" title="${esc(person.name)}">${esc(person.initials)}</div>`:''}
    </div>
    <div class="shop-actions">
      <button class="btn ${item.state==='got'?'secondary':'success'}" data-shop-state="got" data-shop-id="${esc(item.id)}" aria-pressed="${item.state==='got'?'true':'false'}">${item.state==='got'?'Undo':'Got It'}</button>
      <button class="btn ${item.state==='couldnt'?'secondary':'unavailable'}" data-shop-state="couldnt" data-shop-id="${esc(item.id)}" aria-pressed="${item.state==='couldnt'?'true':'false'}">${item.state==='couldnt'?'Undo':'Couldn’t Get'}</button>
    </div>
  </article>`;
}

async function showAddShopping(category=null){
  const [categories,catalogue]=await Promise.all([getAll('categories'),getAll('catalogue')]);
  if(!category){
    const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
    present(`${pageHead('Add Item','Tap a picture.','Shopping')}
      <div class="category-grid">${ordered.map(c=>`<button class="category-box" data-tone="${categoryTone(c)}" data-choose-category="${esc(c.id)}"><span class="category-picture" aria-hidden="true">${esc(categoryIcon(c))}</span><strong>${esc(c.name)}</strong></button>`).join('')}</div>
      <h3 class="section-title">Meal Ideas</h3><div class="meal-ideas">${mealIdeas.map(idea=>`<span>${esc(idea)}</span>`).join('')}</div>
      <button class="btn secondary full back-button" data-back-shopping>Cancel</button>`,{subscreen:true});
    return;
  }
  const matches=catalogue.filter(item=>item.categoryId===category.id).sort((a,b)=>a.name.localeCompare(b.name));
  present(`${pageHead(category.name,'Tap an item to add it.','Shopping')}
    <div class="catalogue-grid">${matches.map(item=>`<button class="catalogue-tile" data-tone="${categoryTone(category)}" data-quick-shop-item="${esc(item.id)}"><span class="catalogue-picture" aria-hidden="true">${esc(itemIcon(item.name,category,item.icon))}</span><strong>${esc(item.name)}</strong></button>`).join('')||'<div class="card empty span-two">No saved items in this category yet.</div>'}</div>
    <button class="btn warm full custom-shop-button" data-custom-shop="${esc(category.id)}">Add Something Else</button>
    <button class="btn secondary full" data-add-shop>Back to Categories</button>`,{subscreen:true});
}

async function customShoppingItemEditor(category){
  const [people,activeItems]=await Promise.all([getAll('people'),getAll('shoppingItems')]);
  present(`${pageHead('Add Item','Just the name is required.','Shopping')}
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
  screen.querySelector('#shoppingItemForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(form.itemName||'').trim();
    if(!nonBlank(name,80)){alert('Enter an item name.');return;}
    const quantity=String(form.quantity||'').trim();
    const note=String(form.note||'').trim();
    if(quantity.length>30||note.length>160)return;
    const catalogue=await getAll('catalogue');
    const ts=now();
    const record={id:id(),itemName:name,categoryId:category.id,quantity,note,requesterId:form.requesterId||null,state:'pending',order:nextShoppingOrder(activeItems),createdAt:ts,modifiedAt:ts};
    const existingCatalogue=catalogue.find(item=>item.categoryId===category.id&&item.name.toLowerCase()===name.toLowerCase());
    await atomicWrite(['shoppingItems','catalogue'],stores=>{
      stores.shoppingItems.put(record);
      if(!existingCatalogue)stores.catalogue.put({id:id(),name,categoryId:category.id,builtIn:false,createdAt:ts,modifiedAt:ts});
    });
    await renderRoute('shopping');
  });
}

async function addQuickShoppingItem(catalogueId){
  const [catalogueItem,items]=await Promise.all([getRecord('catalogue',catalogueId),getAll('shoppingItems')]);
  if(!catalogueItem)return;
  const ts=now();
  await putRecord('shoppingItems',{id:id(),itemName:catalogueItem.name,icon:catalogueItem.icon||'',categoryId:catalogueItem.categoryId,quantity:'',note:'',requesterId:null,state:'pending',order:nextShoppingOrder(items),createdAt:ts,modifiedAt:ts});
  await renderRoute('shopping');
}

async function shoppingItemEditor(item){
  const [people,categories]=await Promise.all([getAll('people'),getAll('categories')]);
  const orderedCategories=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  present(`${pageHead('Edit Item','Tap Save when finished.','Shopping')}
    <form class="editor-card" id="shoppingEditForm">
      <label>Item name<input name="itemName" required maxlength="80" value="${esc(item.itemName)}"></label>
      <div class="field-grid two"><label>Quantity<input name="quantity" maxlength="30" value="${esc(item.quantity||'')}"></label><label>Requester<select name="requesterId"><option value="">None</option>${people.map(person=>`<option value="${esc(person.id)}" ${person.id===item.requesterId?'selected':''}>${esc(person.name)}</option>`).join('')}</select></label></div>
      <label>Category<select name="categoryId">${orderedCategories.map(category=>`<option value="${esc(category.id)}" ${category.id===item.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label>
      <label>Note <span class="hint">Optional</span><input name="note" maxlength="160" value="${esc(item.note||'')}"></label>
      <div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-shopping>Cancel</button><button class="btn warm" type="submit">Save</button></div>
    </form>
    <button class="btn danger full delete-below" data-delete-shop="${esc(item.id)}">Remove Item</button>`,{subscreen:true});
  screen.querySelector('#shoppingEditForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.itemName||'').trim();
    if(!nonBlank(name,80)){alert('Enter an item name.');return;}
    await putRecord('shoppingItems',{...item,itemName:name,quantity:String(data.quantity||'').trim(),requesterId:data.requesterId||null,categoryId:data.categoryId,note:String(data.note||'').trim(),modifiedAt:now()});
    await renderRoute('shopping');
  });
}

async function showRegularItems(){
  const [regulars,categories]=await Promise.all([getAll('regularItems'),getAll('categories')]);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const rows=[...regulars].sort((a,b)=>a.name.localeCompare(b.name));
  present(`${pageHead('Regular Items','Tap Add for the things you buy often.','Shopping')}
    <div class="regular-grid">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<div class="regular-card" data-tone="${categoryTone(category)}"><span class="catalogue-picture" aria-hidden="true">${esc(itemIcon(item.name,category,item.icon))}</span><div><strong>${esc(item.name)}</strong><small>${esc(category?.name||'Other')}</small></div><button class="mini" data-add-regular="${esc(item.id)}">Add</button></div>`;}).join(''):'<div class="card empty span-two">No Regular Items yet.</div>'}</div>
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
    if(imports.some(record=>record.id===data.sourceListId)){alert('This shared list has already been imported.');return;}

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
    alert(`Imported ${result.added} item${result.added===1?'':'s'}; skipped ${result.skipped} duplicate${result.skipped===1?'':'s'}.`);
    await renderRoute('shopping');
  }catch(error){
    console.error(error);
    alert('That file could not be imported safely. Your current list was not changed.');
  }
}

async function renderSettings(){
  const [people,categories,catalogue,regulars]=await Promise.all([getAll('people'),getAll('categories'),getAll('catalogue'),getAll('regularItems')]);
  present(`${pageHead('Settings','','Settings')}
    <section class="settings-section settings-current" data-tone="blue"><h2>Current Stay</h2>
      <div class="settings-summary"><strong>${esc(currentStay.flag)} ${esc(currentStay.country)} · ${esc(currentStay.city)}</strong><span>${esc(currentStay.startDate)} – ${esc(currentStay.endDate)} · ${esc(currentStay.currencyCode)}</span></div>
      <div class="button-row"><button class="btn secondary" data-edit-stay>Edit Stay</button><button class="btn primary" data-change-stay>Change Stay</button></div>
    </section>
    <section class="settings-section settings-shopping" data-tone="gold"><h2>Shopping Setup</h2>
      <button class="settings-row" data-tone="blue" data-manage-people><strong>People</strong><span>${people.length} requester${people.length===1?'':'s'}</span></button>
      <button class="settings-row" data-tone="gold" data-manage-categories><strong>Categories</strong><span>${categories.length}</span></button>
      <button class="settings-row" data-tone="teal" data-manage-regulars><strong>Regular Items</strong><span>${regulars.length}</span></button>
      <button class="settings-row" data-tone="purple" data-manage-custom><strong>Custom Items</strong><span>${catalogue.filter(item=>!item.builtIn).length}</span></button>
    </section>
    <section class="settings-section settings-advanced" data-tone="silver"><h2>More</h2>
      <button class="settings-row" data-tone="silver" data-advanced-settings><strong>Advanced</strong><span>List transfer, optional AUD conversion and reset</span></button>
    </section>
    <p class="app-version">Travel Buddy V1 · Build ${esc(BUILD_VERSION)} · Offline local PWA</p>`);
}

async function advancedSettings(){
  present(`${pageHead('Advanced','','Settings')}
    <div class="settings-list">
      <button class="settings-row" data-shopping-tools><strong>Shopping List Transfer</strong><span>Manual share/import only</span></button>
      <button class="settings-row" data-exchange-rate><strong>Optional AUD Conversion</strong><span>${stayRate(currentStay)?`1 AUD = ${esc(stayRate(currentStay))} ${esc(currentStay.currencyCode)}`:'Off'}</span></button>
      <button class="settings-row danger" data-reset><strong>Reset Travel Buddy</strong><span>Erase local Travel Buddy data</span></button>
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
  present(`${pageHead(title,subtitle,'Settings')}
    <form class="editor-card quick-stay" id="stayForm">
      <label>Country<input name="country" list="countryList" required maxlength="60" autocomplete="off" value="${esc(base?.country||'')}" ${countryLocked?'readonly':''}><datalist id="countryList">${options}</datalist></label>
      <div class="auto-country" id="countryAuto">${base?`${esc(base.flag)} ${esc(base.currencyCode)} · ${esc(base.currencyName)}`:'Flag and currency fill automatically.'}</div>
      ${countryLocked?'<p class="micro-note">Use Change Stay when you move to another country.</p>':''}
      <label>City / Destination<input name="city" required maxlength="80" autocomplete="address-level2" value="${esc(base?.city||'')}"></label>
      <div class="field-grid two"><label>Stay start<input name="startDate" type="date" required value="${esc(auDateToIso(base?.startDate||''))}"></label><label>Stay end<input name="endDate" type="date" required value="${esc(auDateToIso(base?.endDate||''))}"></label></div>
      <div class="editor-actions static-actions">${force?'':'<button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">Cancel</button>'}<button class="btn primary" type="submit">${mode==='setup'?'Start Travel Buddy':mode==='change'?'Change Stay':'Save'}</button></div>
    </form>`,{subscreen:true});

  const form=screen.querySelector('#stayForm');
  const countryInput=form.elements.country;
  const auto=screen.querySelector('#countryAuto');
  const updateCountry=()=>{
    const ref=findCountry(countryInput.value);
    auto.textContent=ref?`${ref.flag} ${ref.currencyCode} · ${ref.currencyName}`:'Choose a country from the suggestions.';
    auto.classList.toggle('is-ready',!!ref);
  };
  countryInput.addEventListener('input',updateCountry);countryInput.addEventListener('change',updateCountry);updateCountry();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    const countryRef=findCountry(data.country);
    const city=String(data.city||'').trim();
    const startDate=isoDateToAu(data.startDate);
    const endDate=isoDateToAu(data.endDate);
    if(!countryRef){alert('Choose a country from the list.');countryInput.focus();return;}
    if(!nonBlank(city,80)){alert('Enter the city or destination.');return;}
    if(!startDate||!endDate){alert('Choose both stay dates.');return;}
    if(auDateToSort(endDate)<auDateToSort(startDate)){alert('Stay end date cannot be before the start date.');return;}
    if(mode==='change'&&currentStay&&!confirm('Change to this new Current Stay? Old expenses stay unchanged.'))return;
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
  present(`${pageHead('Optional AUD Conversion','Only use this if you want an AUD figure saved too.','Settings')}
    <form class="editor-card" id="rateForm"><label>1 AUD = <span class="hint">${esc(currentStay.currencyCode)}</span><input id="rateInput" name="exchangeRate" type="number" min="0.000001" step="any" inputmode="decimal" placeholder="Leave blank to turn it off" value="${esc(stayRate(currentStay)||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true});
  screen.querySelector('#rateForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const raw=String(new FormData(event.currentTarget).get('exchangeRate')||'').trim();
    let rate=null;
    if(raw){rate=Number(raw);if(!Number.isFinite(rate)||rate<=0){alert('Enter a valid exchange rate or leave it blank.');return;}}
    currentStay={...currentStay,exchangeRate:rate,modifiedAt:now()};
    await putRecord('stays',currentStay);
    await renderRoute('settings');
  });
}

async function managePeople(){
  const people=await getAll('people');
  present(`${pageHead('People','Requester initials for Shopping.','Settings')}
    <div class="card">${people.length?people.map(person=>`<div class="manage-row"><div><strong>${esc(person.name)}</strong><div class="muted">${esc(person.initials)}</div></div><div class="mini-actions"><button class="mini" data-edit-person="${esc(person.id)}">Edit</button><button class="mini danger" data-delete-person="${esc(person.id)}">Delete</button></div></div>`).join(''):'<p class="muted">No people yet.</p>'}<button class="btn primary full add-inside-card" data-add-person>Add Person</button></div>
    <button class="btn secondary full" data-back-settings>Back</button>`,{subscreen:true});
}

async function personEditor(person=null){
  personEditorReturn='people';
  present(`${pageHead(person?'Edit Person':'Add Person','Name and initials.','Settings')}
    <form class="editor-card" id="personForm"><label>Name<input id="personName" name="name" required maxlength="60" value="${esc(person?.name||'')}"></label><label>Initials<input name="initials" maxlength="3" value="${esc(person?.initials||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-people>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:person?null:'#personName'});
  screen.querySelector('#personForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.name||'').trim();
    if(!nonBlank(name,60)){alert('Enter a name.');return;}
    const all=await getAll('people');
    if(all.some(other=>other.id!==person?.id&&other.name.trim().toLowerCase()===name.toLowerCase())){alert('That person already exists.');return;}
    const ts=now();
    await putRecord('people',{id:person?.id||id(),name,initials:normalizeInitials(name,data.initials),createdAt:person?.createdAt||ts,modifiedAt:ts});
    await managePeople();
  });
}

async function deletePerson(personId){
  if(!confirm('Delete this person? Shopping items stay, but the requester link will be cleared.'))return;
  const items=await getAll('shoppingItems');
  const changed=items.filter(item=>item.requesterId===personId).map(item=>({...item,requesterId:null,modifiedAt:now()}));
  await atomicWrite(['people','shoppingItems'],stores=>{for(const item of changed)stores.shoppingItems.put(item);stores.people.delete(personId);});
  await managePeople();
}

async function manageCategories(){
  const categories=await getAll('categories');
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  present(`${pageHead('Categories','Used when adding items.','Shopping Setup')}<div class="card">${ordered.map(category=>`<div class="manage-row" data-tone="${categoryTone(category)}"><div class="manage-category"><span>${esc(categoryIcon(category))}</span><strong>${esc(category.name)}</strong></div><div class="mini-actions"><button class="mini" data-rename-category="${esc(category.id)}">Rename</button>${category.builtIn?'':`<button class="mini danger" data-delete-category="${esc(category.id)}">Delete</button>`}</div></div>`).join('')}<button class="btn secondary full add-inside-card" data-add-category>Add Category</button></div><button class="btn secondary full" data-back-settings>Back</button>`,{subscreen:true});
}

async function categoryEditor(category=null){
  present(`${pageHead(category?'Rename Category':'Add Category','The active shopping list stays continuous.','Shopping Setup')}<form class="editor-card" id="categoryForm"><label>Category name<input id="categoryName" name="name" required maxlength="60" value="${esc(category?.name||'')}"></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-categories>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:category?null:'#categoryName'});
  screen.querySelector('#categoryForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const name=String(new FormData(event.currentTarget).get('name')||'').trim();
    if(!nonBlank(name,60)){alert('Enter a category name.');return;}
    const categories=await getAll('categories');
    if(categories.some(existing=>existing.id!==category?.id&&existing.name.toLowerCase()===name.toLowerCase())){alert('That category already exists.');return;}
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
  if(items.some(item=>item.categoryId===category.id)||catalogue.some(item=>item.categoryId===category.id)||regulars.some(item=>item.categoryId===category.id)){alert('This category is still in use. Move or remove its items first.');return;}
  if(confirm(`Delete category “${category.name}”?`))await deleteRecord('categories',category.id);
  await manageCategories();
}

async function manageCustom(){
  const [catalogue,categories]=await Promise.all([getAll('catalogue'),getAll('categories')]);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const rows=catalogue.filter(item=>!item.builtIn).sort((a,b)=>a.name.localeCompare(b.name));
  present(`${pageHead('Custom Items','Reusable items you have added.','Shopping Setup')}<div class="card">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<div class="manage-row" data-tone="${categoryTone(category)}"><div><strong>${esc(item.name)}</strong><div class="muted">${esc(category?.name||'Other')}</div></div><div class="mini-actions"><button class="mini" data-edit-custom="${esc(item.id)}">Edit</button><button class="mini danger" data-delete-custom="${esc(item.id)}">Delete</button></div></div>`;}).join(''):'<p class="muted">No custom items yet.</p>'}<button class="btn secondary full add-inside-card" data-add-custom>Add Custom Item</button></div><button class="btn secondary full" data-back-settings>Back</button>`,{subscreen:true});
}

async function customEditor(item=null){
  const categories=await getAll('categories');
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  present(`${pageHead(item?'Edit Custom Item':'Add Custom Item','Saved for future shops.','Shopping Setup')}<form class="editor-card" id="customForm"><label>Item name<input id="customItemName" name="name" required maxlength="80" value="${esc(item?.name||'')}"></label><label>Category<select name="categoryId">${ordered.map(category=>`<option value="${esc(category.id)}" ${category.id===item?.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-back-custom>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:item?null:'#customItemName'});
  screen.querySelector('#customForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.name||'').trim();
    if(!nonBlank(name,80)){alert('Enter an item name.');return;}
    const all=await getAll('catalogue');
    if(all.some(existing=>existing.id!==item?.id&&existing.categoryId===data.categoryId&&existing.name.toLowerCase()===name.toLowerCase())){alert('That item already exists in this category.');return;}
    const ts=now();
    await putRecord('catalogue',{id:item?.id||id(),name,categoryId:data.categoryId,builtIn:false,createdAt:item?.createdAt||ts,modifiedAt:ts});
    await manageCustom();
  });
}

async function manageRegulars(){
  const [regulars,categories]=await Promise.all([getAll('regularItems'),getAll('categories')]);
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const rows=[...regulars].sort((a,b)=>a.name.localeCompare(b.name));
  present(`${pageHead('Regular Items','Things you buy often.','Shopping Setup')}<div class="card">${rows.length?rows.map(item=>{const category=categoryMap.get(item.categoryId);return`<div class="manage-row" data-tone="${categoryTone(category)}"><div><strong>${esc(item.name)}</strong><div class="muted">${esc(category?.name||'Other')}</div></div><div class="mini-actions"><button class="mini" data-edit-regular="${esc(item.id)}">Edit</button><button class="mini danger" data-delete-regular="${esc(item.id)}">Delete</button></div></div>`;}).join(''):'<p class="muted">No Regular Items yet.</p>'}<button class="btn primary full add-inside-card" data-add-regular-setting>Add Regular Item</button></div><button class="btn secondary full" data-back-settings>Back</button>`,{subscreen:true});
}

async function regularEditor(item=null,returnTo='settings'){
  regularEditorReturn=returnTo;
  const [categories,regulars]=await Promise.all([getAll('categories'),getAll('regularItems')]);
  const ordered=[...categories].sort((a,b)=>(Number(a.sortOrder)||9999)-(Number(b.sortOrder)||9999)||a.name.localeCompare(b.name));
  present(`${pageHead(item?'Edit Regular Item':'Add Regular Item','Saved for quick reuse.','Shopping')}<form class="editor-card" id="regularForm"><label>Item name<input id="regularItemName" name="name" required maxlength="80" value="${esc(item?.name||'')}"></label><label>Category<select name="categoryId">${ordered.map(category=>`<option value="${esc(category.id)}" ${category.id===item?.categoryId?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label><div class="editor-actions static-actions"><button class="btn secondary" type="button" data-regular-cancel>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`,{subscreen:true,focusSelector:item?null:'#regularItemName'});
  screen.querySelector('#regularForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const name=String(data.name||'').trim();
    if(!nonBlank(name,80)){alert('Enter an item name.');return;}
    if(regulars.some(existing=>existing.id!==item?.id&&existing.categoryId===data.categoryId&&existing.name.toLowerCase()===name.toLowerCase())){alert('That Regular Item already exists.');return;}
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
  present(`${pageHead('Shopping List Transfer','Manual only. No sync.','Settings')}<div class="settings-list"><button class="settings-row" data-share-shopping><strong>Share Shopping List</strong><span>Send a versioned list file.</span></button><button class="settings-row" data-import-shopping><strong>Import Shopping List</strong><span>Merge safely without replacing this list.</span></button></div><button class="btn secondary full back-button" data-back-settings>Back</button>`,{subscreen:true});
}

async function resetTravelBuddy(){
  if(!confirm('Reset Travel Buddy? This removes all local user data.'))return;
  if(!confirm('Final confirmation: erase Travel Buddy local data and return to Current Stay setup?'))return;
  await resetDatabase();
  currentStay=null;
  setRoute('settings');
  setNavigationEnabled(false);
  await stayEditor('setup',true);
}

screen.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button)return;

  if(button.matches('[data-add-expense]'))return expenseEditor(null,{category:button.hasAttribute('data-groceries')?'Groceries':undefined,returnRoute:route});
  if(button.matches('[data-open-shopping]'))return renderRoute('shopping');
  if(button.matches('[data-open-expenses]'))return renderRoute('expenses');
  if(button.matches('[data-expense-filter]')){expenseFilter=button.dataset.expenseFilter;return renderExpenses();}
  if(button.matches('[data-edit-expense]'))return expenseEditor(await getRecord('expenses',button.dataset.editExpense),{returnRoute:button.dataset.returnRoute||route});
  if(button.matches('[data-toggle-transfer]')){const expense=await getRecord('expenses',button.dataset.toggleTransfer);if(expense)await putRecord('expenses',{...expense,transferred:!expense.transferred,modifiedAt:now()});return renderExpenses();}
  if(button.matches('[data-delete-expense]')){if(confirm('Delete this expense?'))await deleteRecord('expenses',button.dataset.deleteExpense);return renderRoute(expenseReturnRoute);}
  if(button.matches('[data-editor-cancel]'))return renderRoute(button.dataset.cancelRoute||'settings');

  if(button.matches('[data-add-shop]'))return showAddShopping();
  if(button.matches('[data-choose-category]'))return showAddShopping(await getRecord('categories',button.dataset.chooseCategory));
  if(button.matches('[data-back-category]'))return showAddShopping(await getRecord('categories',button.dataset.backCategory));
  if(button.matches('[data-custom-shop]'))return customShoppingItemEditor(await getRecord('categories',button.dataset.customShop));
  if(button.matches('[data-quick-shop-item]'))return addQuickShoppingItem(button.dataset.quickShopItem);
  if(button.matches('[data-back-shopping]'))return renderRoute('shopping');
  if(button.matches('[data-edit-shop]'))return shoppingItemEditor(await getRecord('shoppingItems',button.dataset.editShop));
  if(button.matches('[data-shop-state]')){const item=await getRecord('shoppingItems',button.dataset.shopId);if(!item)return;const next=item.state===button.dataset.shopState?'pending':button.dataset.shopState;await putRecord('shoppingItems',{...item,state:next,modifiedAt:now()});justFinishedShopping=false;return renderShopping();}
  if(button.matches('[data-delete-shop]')){if(confirm('Remove this shopping item?'))await deleteRecord('shoppingItems',button.dataset.deleteShop);return renderRoute('shopping');}
  if(button.matches('[data-finish-shopping]')){
    if(!confirm('Finish shopping?\n\nPurchased items will be cleared. Items you couldn’t get and untouched items will stay.'))return;
    const items=await getAll('shoppingItems');
    const next=finishShopping(items);
    const purchased=items.filter(item=>item.state==='got');
    await atomicWrite('shoppingItems',stores=>{for(const item of purchased)stores.shoppingItems.delete(item.id);for(const item of next)stores.shoppingItems.put(item);});
    justFinishedShopping=true;
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
  if(button.matches('[data-delete-custom]')){const item=await getRecord('catalogue',button.dataset.deleteCustom);if(item&&confirm(`Delete custom item “${item.name}”?`))await deleteRecord('catalogue',item.id);return manageCustom();}
  if(button.matches('[data-back-custom]'))return manageCustom();
  if(button.matches('[data-manage-regulars]'))return manageRegulars();
  if(button.matches('[data-add-regular-setting]'))return regularEditor(null,'settings');
  if(button.matches('[data-edit-regular]'))return regularEditor(await getRecord('regularItems',button.dataset.editRegular),'settings');
  if(button.matches('[data-delete-regular]')){const item=await getRecord('regularItems',button.dataset.deleteRegular);if(item&&confirm(`Delete Regular Item “${item.name}”?`))await deleteRecord('regularItems',item.id);return manageRegulars();}
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
