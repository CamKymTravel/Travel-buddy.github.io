import {ensureSeedData,getAll,getRecord,putRecord,putMany,deleteRecord,resetDatabase,atomicWrite} from './db.js';
import {BUILD_VERSION,EXPENSE_CATEGORIES,SHOPPING_STATES,MAX_IMPORT_BYTES,MAX_IMPORT_ITEMS,validateAuDate,auDateToSort,isoDateToAu,auDateToIso,todayAu,convertLocalToAud,formatAud,formatLocal,expenseSortNewest,shoppingSortStable,nextShoppingOrder,finishShopping,normalizeInitials,nonBlank,buildExpenseRecord,validateShoppingEnvelope,normalizeShoppingImportItem,mergeImportedShopping} from './logic.js';
import {COUNTRIES,findCountry} from './country-data.js';

const screen=document.querySelector('#screen');
const app=document.querySelector('#app');
const bottomNav=document.querySelector('#bottomNav');
const launch=document.querySelector('#launch');
const launchBrand=document.querySelector('#launchBrand');
const launchStay=document.querySelector('#launchStay');
const navButtons=[...document.querySelectorAll('.nav-item')];
const importInput=document.querySelector('#shoppingImportFile');
let route='home', currentStay=null;
let expenseFilter='current', expenseCategory='All', expenseReturnRoute='expenses';
const mealIdeas=['Pasta night','Tacos','Stir-fry','BBQ','Salad night','Breakfast for dinner'];

const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const id=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
const audTotal=rows=>{const values=rows.map(r=>r?.audAmount).filter(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))).map(Number);return values.length?values.reduce((a,b)=>a+b,0):null;};
const stayRate=stay=>{const n=Number(stay?.exchangeRate);return Number.isFinite(n)&&n>0?n:null;};
const pageHead=(title,subtitle,accent='Travel Buddy')=>`<div class="page-head"><div><p class="eyebrow">${esc(accent)}</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></div>`;

function resetView(){
  window.scrollTo({top:0,left:0,behavior:'auto'});
  requestAnimationFrame(()=>{try{screen.focus({preventScroll:true});}catch{screen.focus();}});
}
function present(html){screen.innerHTML=html;resetView();}
function setNavigationEnabled(enabled){bottomNav.hidden=!enabled;app.classList.toggle('setup-mode',!enabled);}
function setRoute(next){
  route=next;
  navButtons.forEach(b=>{
    const active=b.dataset.route===route;
    b.classList.toggle('is-active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
}
async function loadCurrentStay(){
  const setting=await getRecord('settings','currentStayId');currentStay=setting?.value?await getRecord('stays',setting.value):null;
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
  setNavigationEnabled(true);setRoute(next);
  if(route==='home')await renderHome();
  else if(route==='expenses')await renderExpenses();
  else if(route==='shopping')await renderShopping();
  else await renderSettings();
}

function stayHero(stay=currentStay){
  if(!stay)return'';
  const rate=stayRate(stay);return `<section class="hero"><div class="hero-top"><div class="flag">${esc(stay.flag||'◉')}</div><div><p class="eyebrow">Travel Buddy · Current Stay</p><h2>${esc(stay.country)}</h2><p>${esc(stay.city)}</p></div></div><div class="hero-meta"><span class="pill">${esc(stay.startDate)} – ${esc(stay.endDate)}</span><span class="pill">${esc(stay.currencyCode)}</span>${rate?`<span class="pill">1 AUD = ${esc(rate)} ${esc(stay.currencyCode)}</span>`:''}</div></section>`;
}
function stayStrip(){return currentStay?`<div class="screen-title-strip"><div class="flag">${esc(currentStay.flag||'◉')}</div><div><strong>${esc(currentStay.country)} · ${esc(currentStay.city)}</strong><small>${esc(currentStay.startDate)} – ${esc(currentStay.endDate)} · ${esc(currentStay.currencyCode)}</small></div></div>`:'';}
function emptyCard(text,button,label){return `<div class="card empty">${esc(text)}${button?`<button class="btn primary full" ${button}>${esc(label)}</button>`:''}</div>`;}
function categoryMark(category){return `<span class="category-dot cat-${slug(category)}" aria-hidden="true"></span>`;}
function pendingSummary(expenses){
  const pending=expenses.filter(e=>!e.transferred), pendingCurrent=pending.filter(e=>e.stayId===currentStay?.id);
  return {pending,pendingCurrent,count:pending.length,aud:audTotal(pending),local:sum(pendingCurrent,'localAmount')};
}

async function renderHome(){
  const [expenses,shopping]=await Promise.all([getAll('expenses'),getAll('shoppingItems')]);
  const today=todayAu(),currentExpenses=expenses.filter(e=>e.stayId===currentStay.id),todays=currentExpenses.filter(e=>e.date===today),pending=pendingSummary(expenses),couldnt=shopping.filter(i=>i.state==='couldnt'),recent=[...expenses].sort(expenseSortNewest).slice(0,4);
  present(`${stayHero()}<section class="card action-card expense-accent"><div><p class="eyebrow">Quick Expense</p><h3>Add an expense</h3><p>Capture it now. Transfer it later.</p></div><button class="btn primary" data-add-expense>Add Expense</button></section>
  <div class="grid"><section class="card metric"><div class="label">Today’s Spending</div><div class="value">${formatLocal(sum(todays,'localAmount'),currentStay.currencyCode)}</div><div class="sub">${formatAud(audTotal(todays))}</div></section><section class="card metric"><div class="label">Not Yet Transferred</div><div class="value">${pending.count}</div><div class="sub">${formatAud(pending.aud)} total · Current stay ${formatLocal(pending.local,currentStay.currencyCode)}</div></section></div>
  <button class="settings-row shopping-accent" data-open-shopping><strong>Shopping List</strong><span>${shopping.length} active · ${couldnt.length} couldn’t get</span></button>
  <h3 class="section-title">Recent Expenses</h3><div class="list">${recent.length?recent.map(e=>expenseRow(e,'home')).join(''):emptyCard('No expenses yet','data-add-expense','Add Expense')}</div>`);
}

function expenseRow(e,origin=route){
  return `<div class="list-row expense-row"><button class="expense-open" type="button" data-edit-expense="${esc(e.id)}" data-return-route="${esc(origin)}" aria-label="Edit ${esc(e.note||e.category)} expense"><span class="expense-copy"><strong>${categoryMark(e.category)}${esc(e.note||e.category)}</strong><small>${esc(e.date)} · ${esc(e.category)} · ${esc(e.city)}</small></span><span class="amount"><strong>${formatLocal(e.localAmount,e.currencyCode)}</strong><small>${formatAud(e.audAmount)}</small></span></button><button class="mini ${e.transferred?'':'transfer-wait'}" data-toggle-transfer="${esc(e.id)}" aria-pressed="${e.transferred?'true':'false'}">${e.transferred?'Transferred':'Not Transferred'}</button></div>`;
}

async function renderExpenses(){
  const expenses=await getAll('expenses');let rows=[...expenses];
  if(expenseFilter==='current')rows=rows.filter(e=>e.stayId===currentStay.id);
  else if(expenseFilter==='pending')rows=rows.filter(e=>!e.transferred);
  else if(expenseFilter==='transferred')rows=rows.filter(e=>e.transferred);
  if(expenseCategory!=='All')rows=rows.filter(e=>e.category===expenseCategory);
  rows.sort(expenseSortNewest);
  const currentRows=expenses.filter(e=>e.stayId===currentStay.id),pending=pendingSummary(expenses);
  present(`${pageHead('Expenses','Local currency first, AUD underneath.')}${stayStrip()}<button class="btn primary full" data-add-expense>Add Expense</button>
  <div class="grid" style="margin-top:12px"><section class="card metric"><div class="label">Current Stay Total</div><div class="value">${formatLocal(sum(currentRows,'localAmount'),currentStay.currencyCode)}</div><div class="sub">${formatAud(audTotal(currentRows))}</div></section><section class="card metric"><div class="label">Untransferred</div><div class="value">${pending.count}</div><div class="sub">${formatAud(pending.aud)} total · Current stay ${formatLocal(pending.local,currentStay.currencyCode)}</div></section></div>
  <div class="filters" aria-label="Expense status filters">${[['current','Current Stay'],['all','All Expenses'],['pending','Not Transferred'],['transferred','Transferred']].map(([v,l])=>`<button class="filter ${expenseFilter===v?'is-active':''}" aria-pressed="${expenseFilter===v?'true':'false'}" data-expense-filter="${v}">${l}</button>`).join('')}</div>
  <div class="filters" aria-label="Expense category filters">${['All',...EXPENSE_CATEGORIES].map(v=>`<button class="filter ${expenseCategory===v?'is-active':''}" aria-pressed="${expenseCategory===v?'true':'false'}" data-category-filter="${esc(v)}">${esc(v)}</button>`).join('')}</div>
  <div class="list">${rows.length?rows.map(e=>expenseRow(e,'expenses')).join(''):emptyCard('No expenses yet','data-add-expense','Add Expense')}</div>`);
}

function expenseEditor(existing=null,defaults={}){
  const stay=existing?.staySnapshot||currentStay;
  if(!stay)return stayEditor('setup',true);
  expenseReturnRoute=defaults.returnRoute||route||'expenses';
  const defaultDate=existing?.date||defaults.date||todayAu(),category=existing?.category||defaults.category||'Groceries',rate=stayRate(stay);
  present(`${pageHead(existing?'Edit Expense':'Add Expense','Quick capture — Save when finished.')}<form class="editor-card" id="expenseForm">
  <label>Date<input name="date" type="date" value="${esc(auDateToIso(defaultDate))}" required></label>
  <label>Category<select name="category">${EXPENSE_CATEGORIES.map(c=>`<option ${c===category?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
  <label>Amount <span class="hint">${esc(stay.currencyCode)}</span><input name="localAmount" type="number" min="0" step="any" inputmode="decimal" value="${existing?esc(existing.localAmount):''}" required></label>
  <div class="formula-box">${rate?`1 AUD = ${esc(rate)} ${esc(stay.currencyCode)}<div class="preview" id="expensePreview">AUD —</div>`:`AUD conversion is optional. No exchange rate is set for this stay.<div class="preview">AUD —</div>`}</div>
  <label>Note <span class="hint">Optional</span><textarea name="note" maxlength="180" placeholder="Supermarket, lunch, taxi…">${esc(existing?.note||'')}</textarea></label>
  ${existing?`<div class="notice">Editing this saved expense will return it to <strong>Not Transferred</strong> when Save is tapped.</div>`:''}
  <div class="editor-actions"><button class="btn secondary" type="button" data-editor-cancel data-cancel-route="${esc(expenseReturnRoute)}">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>${existing?`<button class="btn danger full" style="margin-top:10px" data-delete-expense="${esc(existing.id)}">Delete Expense</button>`:''}`);
  const form=screen.querySelector('#expenseForm'),amount=form.elements.localAmount,preview=screen.querySelector('#expensePreview');
  if(rate&&preview){const update=()=>{const a=convertLocalToAud(amount.value,rate);preview.textContent=a===null?'AUD —':formatAud(a);};amount.addEventListener('input',update);update();}
  form.addEventListener('submit',async e=>{
    e.preventDefault();const data=Object.fromEntries(new FormData(form)),dateAu=isoDateToAu(data.date);
    if(!dateAu){alert('Choose a valid expense date.');return;}
    const amountValue=Number(data.localAmount);if(!Number.isFinite(amountValue)||amountValue<0){alert('Enter a valid local-currency amount.');return;}
    data.date=dateAu;const rec=buildExpenseRecord({existing,form:data,stay});await putRecord('expenses',rec);await renderRoute(expenseReturnRoute);
  });
}

async function renderShopping(){
  const [itemsRaw,people]=await Promise.all([getAll('shoppingItems'),getAll('people')]);const items=[...itemsRaw].sort(shoppingSortStable),personMap=new Map(people.map(p=>[p.id,p])),couldnt=items.filter(i=>i.state==='couldnt').length;
  present(`${pageHead('Shopping','One continuous list.','Travel Buddy')}${stayStrip()}<div class="shop-toolbar"><button class="btn warm" data-add-shop>Add Item</button><button class="btn secondary" data-regular-items>Regular Items</button><button class="btn warm" data-finish-shopping ${items.length?'':'disabled'}>Finish Shopping</button></div>${couldnt?`<div class="notice">${couldnt} item${couldnt===1?'':'s'} marked Couldn’t Get will carry forward after Finish Shopping.</div>`:''}
  <div>${items.length?items.map(i=>shoppingRow(i,personMap)).join(''):emptyCard('Shopping list is empty','data-add-shop','Add Item')}</div>
  <button class="settings-row shopping-accent" style="margin-top:12px" data-shopping-menu><strong>Shopping Options</strong><span>Share or import a list manually.</span></button><button class="btn primary full" style="margin-top:10px" data-shop-expense>Add Expense</button>`);
}
function shoppingRow(i,personMap){const p=personMap.get(i.requesterId);return `<div class="shop-row" data-state="${esc(i.state)}"><div class="shop-row-top"><div><div class="shop-name">${esc(i.itemName)}</div><div class="shop-meta">${i.quantity?`Qty ${esc(i.quantity)}`:''}${i.quantity&&i.note?' · ':''}${esc(i.note||'')}</div>${i.state!=='pending'?`<div class="shop-state ${i.state}">${i.state==='got'?'Got It':'Couldn’t Get'}</div>`:''}</div>${p?`<div class="initials" title="${esc(p.name)}">${esc(p.initials)}</div>`:''}</div><div class="shop-actions"><button class="btn ${i.state==='got'?'secondary':'success'}" data-shop-state="got" data-shop-id="${esc(i.id)}" aria-pressed="${i.state==='got'?'true':'false'}">${i.state==='got'?'Undo Got It':'Got It'}</button><button class="btn ${i.state==='couldnt'?'secondary':'warm'}" data-shop-state="couldnt" data-shop-id="${esc(i.id)}" aria-pressed="${i.state==='couldnt'?'true':'false'}">${i.state==='couldnt'?'Undo':'Couldn’t Get'}</button></div><div class="mini-actions" style="margin-top:8px"><button class="mini" data-edit-shop="${esc(i.id)}">Edit</button><button class="mini danger" data-delete-shop="${esc(i.id)}">Remove</button></div></div>`;}

async function showAddShopping(category=null){
  const [categories,catalogue,people,activeItems]=await Promise.all([getAll('categories'),getAll('catalogue'),getAll('people'),getAll('shoppingItems')]);
  if(!category){
    present(`${pageHead('Add Item','Choose a category first.','Shopping')}<div class="category-grid">${categories.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<button class="category-box" data-choose-category="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div><h3 class="section-title">Meal Ideas</h3><div class="card"><p class="muted" style="margin:0">${mealIdeas.map(esc).join(' · ')}</p></div><button class="btn secondary full" data-back-shopping>Cancel</button>`);return;
  }
  const matches=catalogue.filter(x=>x.categoryId===category.id).sort((a,b)=>a.name.localeCompare(b.name));
  present(`${pageHead(category.name,'Tap a saved item or add a custom one.','Shopping')}<div class="catalogue-list">${matches.map(x=>`<div class="catalogue-item"><strong>${esc(x.name)}</strong><button class="mini" data-quick-shop-item="${esc(x.id)}">Add</button></div>`).join('')||'<div class="card empty">No saved items in this category yet.</div>'}</div><h3 class="section-title">Custom Item</h3><form class="editor-card" id="shoppingItemForm"><label>Item name<input name="itemName" required maxlength="80"></label><div class="field-grid two"><label>Quantity<input name="quantity" maxlength="30"></label><label>Requester<select name="requesterId"><option value="">None</option>${people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label></div><label>Note <span class="hint">Optional</span><textarea name="note" maxlength="160"></textarea></label><div class="editor-actions"><button type="button" class="btn secondary" data-back-shopping>Cancel</button><button class="btn warm" type="submit">Add Item</button></div></form>`);
  screen.querySelector('#shoppingItemForm').addEventListener('submit',async e=>{
    e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget)),name=f.itemName.trim();if(!nonBlank(name,80)){alert('Enter an item name.');return;}
    const quantity=f.quantity.trim(),note=f.note.trim();if(quantity.length>30||note.length>160)return;
    const ts=now(),item={id:id(),itemName:name,categoryId:category.id,quantity,note,requesterId:f.requesterId||null,state:'pending',order:nextShoppingOrder(activeItems),createdAt:ts,modifiedAt:ts};
    const exists=catalogue.some(x=>x.categoryId===category.id&&x.name.toLowerCase()===name.toLowerCase());
    await atomicWrite(['shoppingItems','catalogue'],st=>{st.shoppingItems.put(item);if(!exists)st.catalogue.put({id:id(),name,categoryId:category.id,builtIn:false,createdAt:ts,modifiedAt:ts});});
    await renderRoute('shopping');
  });
}
async function addQuickShoppingItem(catalogueId){const [c,items]=await Promise.all([getRecord('catalogue',catalogueId),getAll('shoppingItems')]);if(!c)return;const ts=now();await putRecord('shoppingItems',{id:id(),itemName:c.name,categoryId:c.categoryId,quantity:'',note:'',requesterId:null,state:'pending',order:nextShoppingOrder(items),createdAt:ts,modifiedAt:ts});await renderRoute('shopping');}

async function shoppingItemEditor(item){
  const [people,categories]=await Promise.all([getAll('people'),getAll('categories')]);
  present(`${pageHead('Edit Shopping Item','Changes save only when Save is tapped.','Shopping')}<form class="editor-card" id="shoppingEditForm"><label>Item name<input name="itemName" required maxlength="80" value="${esc(item.itemName)}"></label><div class="field-grid two"><label>Quantity<input name="quantity" maxlength="30" value="${esc(item.quantity||'')}"></label><label>Requester<select name="requesterId"><option value="">None</option>${people.map(p=>`<option value="${esc(p.id)}" ${p.id===item.requesterId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div><label>Category<select name="categoryId">${categories.map(c=>`<option value="${esc(c.id)}" ${c.id===item.categoryId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Note <span class="hint">Optional</span><textarea name="note" maxlength="160">${esc(item.note||'')}</textarea></label><div class="editor-actions"><button class="btn secondary" type="button" data-back-shopping>Cancel</button><button class="btn warm" type="submit">Save</button></div></form>`);
  screen.querySelector('#shoppingEditForm').addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget)),name=d.itemName.trim();if(!nonBlank(name,80)){alert('Enter an item name.');return;}await putRecord('shoppingItems',{...item,itemName:name,quantity:d.quantity.trim(),requesterId:d.requesterId||null,categoryId:d.categoryId,note:d.note.trim(),modifiedAt:now()});await renderRoute('shopping');});
}

async function showRegularItems(){
  const [regs,cats]=await Promise.all([getAll('regularItems'),getAll('categories')]),catMap=new Map(cats.map(c=>[c.id,c.name]));
  present(`${pageHead('Regular Items','Quickly add commonly purchased items.','Shopping')}<div class="list">${regs.length?regs.sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`<div class="list-row"><div><strong>${esc(r.name)}</strong><small>${esc(catMap.get(r.categoryId)||'Other')}</small></div><button class="mini" data-add-regular="${esc(r.id)}">Add</button></div>`).join(''):emptyCard('No Regular Items yet')}</div><button class="btn secondary full" style="margin-top:12px" data-back-shopping>Back</button>`);
}
async function shoppingMenu(){present(`${pageHead('Shopping Options','Manual tools only. No cloud sync.','Shopping')}<button class="settings-row" data-share-shopping><strong>Share Shopping List</strong><span>Export the active list as a versioned file or share sheet item.</span></button><button class="settings-row" data-import-shopping><strong>Import Shopping List</strong><span>Merge safely without replacing the current list.</span></button><button class="btn secondary full" style="margin-top:12px" data-back-shopping>Back</button>`);}
async function shareShopping(){
  const [items,people,categories]=await Promise.all([getAll('shoppingItems'),getAll('people'),getAll('categories')]),personMap=new Map(people.map(p=>[p.id,p])),catMap=new Map(categories.map(c=>[c.id,c.name]));
  const payload={kind:'travel-buddy-shopping-list',version:2,sourceListId:`tb-${crypto.randomUUID()}`,createdAt:now(),items:[...items].sort(shoppingSortStable).map(i=>{const p=personMap.get(i.requesterId);return{sourceItemId:i.sourceItemId||i.id,itemName:i.itemName,quantity:i.quantity||'',note:i.note||'',state:i.state,categoryName:catMap.get(i.categoryId)||'Other',requesterName:p?.name||'',requesterInitials:p?.initials||''};})};
  const text=JSON.stringify(payload,null,2),file=new File([text],`Travel_Buddy_Shopping_${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:'Travel Buddy Shopping List',files:[file]});return;}catch(e){if(e?.name==='AbortError')return;}}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function importShoppingFile(file){
  try{
    if(file.size>MAX_IMPORT_BYTES)throw new Error('Import file too large');
    const data=JSON.parse(await file.text());if(!validateShoppingEnvelope(data)||data.items.length>MAX_IMPORT_ITEMS)throw new Error('Invalid shopping list file');
    const [existing,imports,categories,people]=await Promise.all([getAll('shoppingItems'),getAll('imports'),getAll('categories'),getAll('people')]);
    if(imports.some(x=>x.id===data.sourceListId)){alert('This shared list has already been imported.');return;}
    const catByName=new Map(categories.map(c=>[c.name.toLowerCase(),c.id])),otherId=catByName.get('other')||categories[0]?.id||null,personById=new Map(people.map(p=>[p.id,p])),personByName=new Map(people.map(p=>[p.name.toLowerCase(),p]));
    const incoming=data.items.map(raw=>{const n=normalizeShoppingImportItem(raw),matchedPerson=(n.requesterId&&personById.get(n.requesterId))||personByName.get(n.requesterName.toLowerCase());return{...n,categoryId:catByName.get(n.categoryName.toLowerCase())||otherId,requesterId:matchedPerson?.id||null};});
    const known=new Set(existing.map(x=>x.sourceItemId).filter(Boolean)),result=mergeImportedShopping(existing,incoming,known),added=result.items.slice(existing.length),importedAt=now();
    await atomicWrite(['shoppingItems','imports'],st=>{for(const x of added)st.shoppingItems.put(x);st.imports.put({id:data.sourceListId,version:data.version,importedAt,added:result.added,skipped:result.skipped});});
    alert(`Imported ${result.added} item${result.added===1?'':'s'}; skipped ${result.skipped} duplicate${result.skipped===1?'':'s'}.`);await renderRoute('shopping');
  }catch(e){console.error(e);alert('That file could not be imported safely. Your current list was not changed.');}
}

async function renderSettings(){
  const [people,categories,catalogue,regulars]=await Promise.all([getAll('people'),getAll('categories'),getAll('catalogue'),getAll('regularItems')]);
  present(`${pageHead('Settings','Only the controls Travel Buddy needs.')}
  <section class="settings-section"><h2>Current Stay</h2><button class="settings-row" data-edit-stay><strong>Edit Current Stay</strong><span>${currentStay?`${esc(currentStay.flag)} ${esc(currentStay.country)} · ${esc(currentStay.city)} · ${esc(currentStay.currencyCode)}`:'Not configured'}</span></button><button class="settings-row" data-change-stay><strong>Change Current Stay</strong><span>Country, city and dates only.</span></button><button class="settings-row" data-exchange-rate><strong>Exchange Rate <span class="optional-tag">Optional</span></strong><span>${stayRate(currentStay)?`1 AUD = ${esc(stayRate(currentStay))} ${esc(currentStay.currencyCode)}`:'Not set — expenses can still be saved without AUD conversion.'}</span></button></section>
  <section class="settings-section"><h2>People</h2><div class="card">${people.length?people.map(p=>`<div class="manage-row"><div><strong>${esc(p.name)}</strong><div class="muted">Initials: ${esc(p.initials)}</div></div><div class="mini-actions"><button class="mini" data-edit-person="${esc(p.id)}">Edit</button><button class="mini danger" data-delete-person="${esc(p.id)}">Delete</button></div></div>`).join(''):'<p class="muted">No people configured.</p>'}<button class="btn secondary full" style="margin-top:12px" data-add-person>Add Person</button></div></section>
  <section class="settings-section"><h2>Shopping Setup</h2><button class="settings-row" data-manage-categories><strong>Categories</strong><span>${categories.length} categories</span></button><button class="settings-row" data-manage-custom><strong>Custom Items</strong><span>${catalogue.filter(x=>!x.builtIn).length} custom items</span></button><button class="settings-row" data-manage-regulars><strong>Regular Items</strong><span>${regulars.length} regular items</span></button></section>
  <section class="settings-section"><h2>Data</h2><button class="settings-row danger" data-reset><strong>Reset Travel Buddy</strong><span>Remove local user data and return to Current Stay setup.</span></button></section>
  <section class="settings-section"><h2>App Information</h2><div class="card"><strong>Travel Buddy V1</strong><p class="muted">Build ${BUILD_VERSION} · Local offline PWA · Backup/Restore intentionally excluded from V1.</p></div></section>`);
}

async function stayEditor(mode='edit',force=false){
  const base=mode==='edit'?currentStay:null,title=mode==='setup'?'Current Stay Setup':mode==='change'?'Change Current Stay':base?'Edit Current Stay':'Current Stay Setup';
  const subtitle=mode==='setup'?'Four quick details and you’re in. Flag and currency are automatic.':mode==='change'?'Set the next place. Old expenses stay unchanged.':'Change the place or dates. Flag and currency are automatic.';
  if(force)setNavigationEnabled(false);
  const options=COUNTRIES.map(c=>`<option value="${esc(c.name)}"></option>`).join('');
  present(`${pageHead(title,subtitle)}<form class="editor-card quick-stay" id="stayForm"><label>Country<input name="country" list="countryList" required maxlength="60" autocomplete="off" placeholder="Start typing, e.g. Germany" value="${esc(base?.country||'')}"><datalist id="countryList">${options}</datalist></label><div class="auto-country" id="countryAuto">${base?`${esc(base.flag)} ${esc(base.currencyCode)} · ${esc(base.currencyName)}`:'Flag and currency will fill automatically.'}</div><label>City / Destination<input name="city" required maxlength="80" autocomplete="address-level2" placeholder="e.g. Munich" value="${esc(base?.city||'')}"></label><div class="field-grid two"><label>Stay start<input name="startDate" type="date" required value="${esc(auDateToIso(base?.startDate||''))}"></label><label>Stay end<input name="endDate" type="date" required value="${esc(auDateToIso(base?.endDate||''))}"></label></div><div class="editor-actions">${force?'':'<button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">Cancel</button>'}<button class="btn primary" type="submit">Save & Continue</button></div></form>`);
  const form=screen.querySelector('#stayForm'),countryInput=form.elements.country,auto=screen.querySelector('#countryAuto');
  const updateCountry=()=>{const ref=findCountry(countryInput.value);auto.textContent=ref?`${ref.flag} ${ref.currencyCode} · ${ref.currencyName}`:'Choose a country from the suggestions.';auto.classList.toggle('is-ready',!!ref);};
  countryInput.addEventListener('input',updateCountry);countryInput.addEventListener('change',updateCountry);updateCountry();
  form.addEventListener('submit',async e=>{
    e.preventDefault();const d=Object.fromEntries(new FormData(form)),countryRef=findCountry(d.country),city=String(d.city||'').trim(),startDate=isoDateToAu(d.startDate),endDate=isoDateToAu(d.endDate);
    if(!countryRef){alert('Choose a country from the list so Travel Buddy can set the flag and currency automatically.');countryInput.focus();return;}
    if(!nonBlank(city,80)){alert('Enter the city or destination.');return;}
    if(!startDate||!endDate){alert('Choose both stay dates.');return;}
    if(auDateToSort(endDate)<auDateToSort(startDate)){alert('Stay end date cannot be before the start date.');return;}
    if(mode==='edit'&&base){
      const saved=await getAll('expenses'),hasExpenses=saved.some(x=>x.stayId===base.id);
      if(hasExpenses&&countryRef.currencyCode!==base.currencyCode){alert('This stay already has saved expenses. Use Change Current Stay to move to a country with a different currency.');return;}
      if(hasExpenses&&(countryRef.name!==base.country||city!==base.city)&&!confirm('Correct the Current Stay country/city? Existing expense snapshots will remain unchanged.'))return;
    }
    if(mode==='change'&&currentStay&&!confirm('Change to this new Current Stay? Old expenses will remain unchanged.'))return;
    const ts=now(),sameCurrency=base&&base.currencyCode===countryRef.currencyCode,rec={id:mode==='edit'&&base?base.id:id(),country:countryRef.name,city,flag:countryRef.flag,startDate,endDate,currencyName:countryRef.currencyName,currencyCode:countryRef.currencyCode,currencySymbol:countryRef.currencySymbol,exchangeRate:sameCurrency?(stayRate(base)||null):null,createdAt:mode==='edit'&&base?base.createdAt:ts,modifiedAt:ts};
    await atomicWrite(['stays','settings'],st=>{st.stays.put(rec);st.settings.put({key:'currentStayId',value:rec.id});});currentStay=rec;setNavigationEnabled(true);await renderRoute(force?'home':'settings');
  });
}

async function exchangeRateEditor(){
  if(!currentStay)return stayEditor('setup',true);
  present(`${pageHead('Exchange Rate','Optional — only needed if you want AUD shown under local expenses.')}<form class="editor-card" id="rateForm"><div class="notice">${esc(currentStay.flag)} ${esc(currentStay.country)} · ${esc(currentStay.currencyCode)}<br>Expenses can be saved without an exchange rate.</div><label>1 AUD = <span class="hint">${esc(currentStay.currencyCode)}</span><input name="exchangeRate" type="number" min="0.000001" step="any" inputmode="decimal" placeholder="Leave blank to turn AUD conversion off" value="${esc(stayRate(currentStay)||'')}"></label><div class="editor-actions"><button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
  screen.querySelector('#rateForm').addEventListener('submit',async e=>{e.preventDefault();const raw=String(new FormData(e.currentTarget).get('exchangeRate')||'').trim();let rate=null;if(raw){rate=Number(raw);if(!Number.isFinite(rate)||rate<=0){alert('Enter a valid exchange rate or leave it blank.');return;}}currentStay={...currentStay,exchangeRate:rate,modifiedAt:now()};await putRecord('stays',currentStay);await renderRoute('settings');});
}

async function personEditor(person=null){
  present(`${pageHead(person?'Edit Person':'Add Person','People are editable local records.')}<form class="editor-card" id="personForm"><label>Name<input name="name" required maxlength="60" value="${esc(person?.name||'')}"></label><label>Initials<input name="initials" maxlength="3" value="${esc(person?.initials||'')}"></label><div class="editor-actions"><button class="btn secondary" type="button" data-editor-cancel data-cancel-route="settings">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
  screen.querySelector('#personForm').addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget)),name=d.name.trim();if(!nonBlank(name,60)){alert('Enter a name.');return;}const ts=now();await putRecord('people',{id:person?.id||id(),name,initials:normalizeInitials(name,d.initials),createdAt:person?.createdAt||ts,modifiedAt:ts});await renderRoute('settings');});
}
async function deletePerson(personId){
  if(!confirm('Delete this person? Shopping items will remain but the requester link will be cleared.'))return;
  const items=await getAll('shoppingItems'),changed=items.filter(i=>i.requesterId===personId).map(i=>({...i,requesterId:null,modifiedAt:now()}));
  await atomicWrite(['people','shoppingItems'],st=>{for(const x of changed)st.shoppingItems.put(x);st.people.delete(personId);});await renderRoute('settings');
}

async function manageCategories(){const cats=await getAll('categories');present(`${pageHead('Categories','Used to add/manage items; the active list remains continuous.')}<div class="card">${cats.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<div class="manage-row"><strong>${esc(c.name)}</strong><div class="mini-actions"><button class="mini" data-rename-category="${esc(c.id)}">Rename</button>${c.builtIn?'':`<button class="mini danger" data-delete-category="${esc(c.id)}">Delete</button>`}</div></div>`).join('')}<button class="btn secondary full" style="margin-top:12px" data-add-category>Add Category</button></div><button class="btn secondary full" data-back-settings>Back</button>`);}
async function categoryEditor(cat=null){
  present(`${pageHead(cat?'Rename Category':'Add Category','Categories organise item selection; the active list stays continuous.','Shopping Setup')}<form class="editor-card" id="categoryForm"><label>Category name<input name="name" required maxlength="60" value="${esc(cat?.name||'')}"></label><div class="editor-actions"><button class="btn secondary" type="button" data-back-categories>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
  screen.querySelector('#categoryForm').addEventListener('submit',async e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('name')||'').trim();if(!nonBlank(name,60)){alert('Enter a category name.');return;}const cats=await getAll('categories');if(cats.some(c=>c.id!==cat?.id&&c.name.toLowerCase()===name.toLowerCase())){alert('That category already exists.');return;}const ts=now();await putRecord('categories',{id:cat?.id||id(),name,builtIn:cat?.builtIn||false,createdAt:cat?.createdAt||ts,modifiedAt:ts});await manageCategories();});
}
async function deleteCategory(catId){const cat=await getRecord('categories',catId);if(!cat||cat.builtIn)return;const [items,catalogue,regulars]=await Promise.all([getAll('shoppingItems'),getAll('catalogue'),getAll('regularItems')]);if(items.some(x=>x.categoryId===cat.id)||catalogue.some(x=>x.categoryId===cat.id)||regulars.some(x=>x.categoryId===cat.id)){alert('This category is still in use. Move or remove its items first.');return;}if(confirm(`Delete category “${cat.name}”?`))await deleteRecord('categories',cat.id);await manageCategories();}

async function manageCustom(){const [custom,cats]=await Promise.all([getAll('catalogue'),getAll('categories')]),catMap=new Map(cats.map(c=>[c.id,c.name])),rows=custom.filter(x=>!x.builtIn).sort((a,b)=>a.name.localeCompare(b.name));present(`${pageHead('Custom Items','Items you have added remain available for future shops.')}<div class="card">${rows.length?rows.map(x=>`<div class="manage-row"><div><strong>${esc(x.name)}</strong><div class="muted">${esc(catMap.get(x.categoryId)||'Other')}</div></div><div class="mini-actions"><button class="mini" data-edit-custom="${esc(x.id)}">Edit</button><button class="mini danger" data-delete-custom="${esc(x.id)}">Delete</button></div></div>`).join(''):'<p class="muted">No custom items yet.</p>'}<button class="btn secondary full" style="margin-top:12px" data-add-custom>Add Custom Item</button></div><button class="btn secondary full" data-back-settings>Back</button>`);}
async function customEditor(item=null){
  const cats=await getAll('categories');present(`${pageHead(item?'Edit Custom Item':'Add Custom Item','Update the reusable catalogue item.')}<form class="editor-card" id="customForm"><label>Item name<input name="name" required maxlength="80" value="${esc(item?.name||'')}"></label><label>Category<select name="categoryId">${cats.map(c=>`<option value="${esc(c.id)}" ${c.id===item?.categoryId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><div class="editor-actions"><button class="btn secondary" type="button" data-back-custom>Cancel</button><button class="btn primary">Save</button></div></form>`);
  screen.querySelector('#customForm').addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget)),name=d.name.trim();if(!nonBlank(name,80)){alert('Enter an item name.');return;}const all=await getAll('catalogue');if(all.some(x=>x.id!==item?.id&&x.categoryId===d.categoryId&&x.name.toLowerCase()===name.toLowerCase())){alert('That item already exists in this category.');return;}const ts=now();await putRecord('catalogue',{id:item?.id||id(),name,categoryId:d.categoryId,builtIn:false,createdAt:item?.createdAt||ts,modifiedAt:ts});await manageCustom();});
}

async function manageRegulars(){const [regs,cats]=await Promise.all([getAll('regularItems'),getAll('categories')]),catMap=new Map(cats.map(c=>[c.id,c.name]));regs.sort((a,b)=>a.name.localeCompare(b.name));present(`${pageHead('Regular Items','Persistent quick-add shopping items.')}<div class="card">${regs.length?regs.map(r=>`<div class="manage-row"><div><strong>${esc(r.name)}</strong><div class="muted">${esc(catMap.get(r.categoryId)||'Other')}</div></div><div class="mini-actions"><button class="mini" data-edit-regular="${esc(r.id)}">Edit</button><button class="mini danger" data-delete-regular="${esc(r.id)}">Delete</button></div></div>`).join(''):'<p class="muted">No Regular Items yet.</p>'}<button class="btn secondary full" style="margin-top:12px" data-add-regular-setting>Add Regular Item</button></div><button class="btn secondary full" data-back-settings>Back</button>`);}
async function regularEditor(reg=null){const cats=await getAll('categories');present(`${pageHead(reg?'Edit Regular Item':'Add Regular Item','Saved for quick reuse.')}<form class="editor-card" id="regularForm"><label>Item name<input name="name" required maxlength="80" value="${esc(reg?.name||'')}"></label><label>Category<select name="categoryId">${cats.map(c=>`<option value="${esc(c.id)}" ${c.id===reg?.categoryId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><div class="editor-actions"><button class="btn secondary" type="button" data-back-regulars>Cancel</button><button class="btn primary">Save</button></div></form>`);screen.querySelector('#regularForm').addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget)),name=d.name.trim();if(!nonBlank(name,80)){alert('Enter an item name.');return;}const ts=now();await putRecord('regularItems',{id:reg?.id||id(),name,categoryId:d.categoryId,createdAt:reg?.createdAt||ts,modifiedAt:ts});await manageRegulars();});}
async function addRegularToList(regId){const [r,items]=await Promise.all([getRecord('regularItems',regId),getAll('shoppingItems')]);if(!r)return;const ts=now();await putRecord('shoppingItems',{id:id(),itemName:r.name,categoryId:r.categoryId,quantity:'',note:'',requesterId:null,state:'pending',order:nextShoppingOrder(items),createdAt:ts,modifiedAt:ts});await showRegularItems();}

async function resetTravelBuddy(){if(!confirm('Reset Travel Buddy? This removes all local user data.'))return;if(!confirm('Final confirmation: erase Travel Buddy local data and return to Current Stay setup?'))return;await resetDatabase();currentStay=null;setRoute('settings');setNavigationEnabled(false);await stayEditor('setup',true);}

screen.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.matches('[data-add-expense]'))return expenseEditor(null,{category:t.hasAttribute('data-groceries')?'Groceries':undefined,returnRoute:route});
  if(t.matches('[data-open-shopping]'))return renderRoute('shopping');
  if(t.matches('[data-expense-filter]')){expenseFilter=t.dataset.expenseFilter;return renderExpenses();}
  if(t.matches('[data-category-filter]')){expenseCategory=t.dataset.categoryFilter;return renderExpenses();}
  if(t.matches('[data-edit-expense]'))return expenseEditor(await getRecord('expenses',t.dataset.editExpense),{returnRoute:t.dataset.returnRoute||route});
  if(t.matches('[data-toggle-transfer]')){const x=await getRecord('expenses',t.dataset.toggleTransfer);if(x)await putRecord('expenses',{...x,transferred:!x.transferred,modifiedAt:now()});return renderRoute(route);}
  if(t.matches('[data-delete-expense]')){if(confirm('Delete this expense?'))await deleteRecord('expenses',t.dataset.deleteExpense);return renderRoute(expenseReturnRoute);}
  if(t.matches('[data-editor-cancel]'))return renderRoute(t.dataset.cancelRoute||'settings');
  if(t.matches('[data-add-shop]'))return showAddShopping();
  if(t.matches('[data-choose-category]'))return showAddShopping(await getRecord('categories',t.dataset.chooseCategory));
  if(t.matches('[data-quick-shop-item]'))return addQuickShoppingItem(t.dataset.quickShopItem);
  if(t.matches('[data-back-shopping]'))return renderRoute('shopping');
  if(t.matches('[data-edit-shop]'))return shoppingItemEditor(await getRecord('shoppingItems',t.dataset.editShop));
  if(t.matches('[data-shop-state]')){const x=await getRecord('shoppingItems',t.dataset.shopId);if(!x)return;const next=x.state===t.dataset.shopState?'pending':t.dataset.shopState;await putRecord('shoppingItems',{...x,state:next,modifiedAt:now()});return renderShopping();}
  if(t.matches('[data-delete-shop]')){if(confirm('Remove this shopping item?'))await deleteRecord('shoppingItems',t.dataset.deleteShop);return renderShopping();}
  if(t.matches('[data-finish-shopping]')){if(!confirm('Finish shopping?\n\nPurchased items will be cleared. Items you couldn’t get will stay on the list.'))return;const items=await getAll('shoppingItems'),next=finishShopping(items),got=items.filter(i=>i.state==='got');await atomicWrite('shoppingItems',st=>{for(const x of got)st.shoppingItems.delete(x.id);for(const x of next)st.shoppingItems.put(x);});return renderShopping();}
  if(t.matches('[data-shop-expense]'))return expenseEditor(null,{category:'Groceries',returnRoute:'shopping'});
  if(t.matches('[data-regular-items]'))return showRegularItems();
  if(t.matches('[data-add-regular]'))return addRegularToList(t.dataset.addRegular);
  if(t.matches('[data-shopping-menu]'))return shoppingMenu();
  if(t.matches('[data-share-shopping]'))return shareShopping();
  if(t.matches('[data-import-shopping]'))return importInput.click();
  if(t.matches('[data-edit-stay]'))return stayEditor('edit');
  if(t.matches('[data-change-stay]'))return stayEditor('change');
  if(t.matches('[data-exchange-rate]'))return exchangeRateEditor();
  if(t.matches('[data-add-person]'))return personEditor();
  if(t.matches('[data-edit-person]'))return personEditor(await getRecord('people',t.dataset.editPerson));
  if(t.matches('[data-delete-person]'))return deletePerson(t.dataset.deletePerson);
  if(t.matches('[data-manage-categories]'))return manageCategories();
  if(t.matches('[data-add-category]'))return categoryEditor();
  if(t.matches('[data-rename-category]'))return categoryEditor(await getRecord('categories',t.dataset.renameCategory));
  if(t.matches('[data-back-categories]'))return manageCategories();
  if(t.matches('[data-delete-category]'))return deleteCategory(t.dataset.deleteCategory);
  if(t.matches('[data-manage-custom]'))return manageCustom();
  if(t.matches('[data-add-custom]'))return customEditor();
  if(t.matches('[data-edit-custom]'))return customEditor(await getRecord('catalogue',t.dataset.editCustom));
  if(t.matches('[data-delete-custom]')){const x=await getRecord('catalogue',t.dataset.deleteCustom);if(x&&confirm(`Delete custom item “${x.name}”?`))await deleteRecord('catalogue',x.id);return manageCustom();}
  if(t.matches('[data-back-custom]'))return manageCustom();
  if(t.matches('[data-manage-regulars]'))return manageRegulars();
  if(t.matches('[data-add-regular-setting]'))return regularEditor();
  if(t.matches('[data-edit-regular]'))return regularEditor(await getRecord('regularItems',t.dataset.editRegular));
  if(t.matches('[data-delete-regular]')){const x=await getRecord('regularItems',t.dataset.deleteRegular);if(x&&confirm(`Delete Regular Item “${x.name}”?`))await deleteRecord('regularItems',x.id);return manageRegulars();}
  if(t.matches('[data-back-regulars]'))return manageRegulars();
  if(t.matches('[data-back-settings]'))return renderRoute('settings');
  if(t.matches('[data-reset]'))return resetTravelBuddy();
});

importInput.addEventListener('change',async()=>{const f=importInput.files?.[0];importInput.value='';if(f)await importShoppingFile(f);});
navButtons.forEach(btn=>btn.addEventListener('click',()=>{if(currentStay)renderRoute(btn.dataset.route);}));
document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select')){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;setTimeout(()=>e.target.scrollIntoView({block:'center',behavior:reduced?'auto':'smooth'}),250);}});

autoLaunch();
async function autoLaunch(){
  try{
    await ensureSeedData();await loadCurrentStay();await new Promise(r=>setTimeout(r,240));
    if(currentStay){launchStay.innerHTML=`<div class="launch-stay-flag">${esc(currentStay.flag||'◉')}</div><div class="launch-stay-country">${esc(currentStay.country)}</div><div class="launch-stay-city">${esc(currentStay.city)}</div><div class="launch-stay-dates">${esc(currentStay.startDate)} – ${esc(currentStay.endDate)}</div>`;launchBrand.classList.remove('is-visible');launchStay.classList.add('is-visible');await new Promise(r=>setTimeout(r,320));}
    launch.remove();app.hidden=false;
    if(!currentStay){setRoute('settings');setNavigationEnabled(false);await stayEditor('setup',true);}else{setNavigationEnabled(true);await renderRoute('home');}
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
  }catch(err){console.error(err);document.body.innerHTML='<main style="padding:24px;color:white;background:#071018;min-height:100vh">Travel Buddy could not start safely. Close any other Travel Buddy tab and reopen the app.</main>';}
}
