import { SCHEMA_VERSION, shoppingSortStable } from './logic.js';

const DB_NAME = 'travel-buddy';
const DB_VERSION = SCHEMA_VERSION;
export const STORES = ['settings','stays','expenses','people','shoppingItems','categories','catalogue','regularItems','imports'];
let dbPromise = null;

const CATEGORY_SEEDS = [
  ['cat-1','Fruit & Veg','🥦',10],
  ['cat-2','Meat','🥩',20],
  ['cat-3','Dairy','🥛',30],
  ['cat-4','Bakery','🥖',40],
  ['cat-5','Pantry','🥫',50],
  ['cat-frozen','Frozen','❄️',60],
  ['cat-6','Drinks','🥤',70],
  ['cat-7','Household','🧽',80],
  ['cat-8','Toiletries','🧴',90],
  ['cat-pharmacy','Pharmacy','💊',100],
  ['cat-9','Other','🛒',110]
];

const CATALOGUE_SEEDS = [
  ['Apples','Fruit & Veg','🍎'],['Bananas','Fruit & Veg','🍌'],['Oranges','Fruit & Veg','🍊'],['Grapes','Fruit & Veg','🍇'],['Strawberries','Fruit & Veg','🍓'],['Avocado','Fruit & Veg','🥑'],['Tomatoes','Fruit & Veg','🍅'],['Potatoes','Fruit & Veg','🥔'],['Carrots','Fruit & Veg','🥕'],['Broccoli','Fruit & Veg','🥦'],['Lettuce','Fruit & Veg','🥬'],['Onions','Fruit & Veg','🧅'],
  ['Chicken','Meat','🍗'],['Beef','Meat','🥩'],['Steak','Meat','🥩'],['Pork','Meat','🥩'],['Bacon','Meat','🥓'],['Sausages','Meat','🌭'],['Fish','Meat','🐟'],['Salmon','Meat','🐟'],
  ['Milk','Dairy','🥛'],['Cheese','Dairy','🧀'],['Yoghurt','Dairy','🥣'],['Butter','Dairy','🧈'],['Eggs','Dairy','🥚'],['Cream','Dairy','🥛'],
  ['Bread','Bakery','🍞'],['Bread rolls','Bakery','🥖'],['Croissants','Bakery','🥐'],['Wraps','Bakery','🫓'],['Muffins','Bakery','🧁'],
  ['Rice','Pantry','🍚'],['Pasta','Pantry','🍝'],['Cereal','Pantry','🥣'],['Coffee','Pantry','☕'],['Tea','Pantry','🍵'],['Sugar','Pantry','🧂'],['Flour','Pantry','🌾'],['Olive oil','Pantry','🫒'],['Tomato sauce','Pantry','🍅'],['Tinned tomatoes','Pantry','🥫'],['Beans','Pantry','🥫'],['Soup','Pantry','🥫'],['Salt','Pantry','🧂'],['Pepper','Pantry','🧂'],['Snacks','Pantry','🍿'],['Chocolate','Pantry','🍫'],
  ['Frozen vegetables','Frozen','🧊'],['Frozen chips','Frozen','🍟'],['Frozen pizza','Frozen','🍕'],['Ice cream','Frozen','🍨'],
  ['Water','Drinks','💧'],['Sparkling water','Drinks','🫧'],['Juice','Drinks','🧃'],['Soft drink','Drinks','🥤'],['Milk drink','Drinks','🥛'],
  ['Laundry detergent','Household','🧺'],['Dishwashing liquid','Household','🧽'],['Dishwasher tablets','Household','🧽'],['Paper towel','Household','🧻'],['Toilet paper','Household','🧻'],['Bin bags','Household','🗑️'],['Cleaning spray','Household','🧴'],['Sponges','Household','🧽'],
  ['Toothpaste','Toiletries','🪥'],['Toothbrush','Toiletries','🪥'],['Shampoo','Toiletries','🧴'],['Conditioner','Toiletries','🧴'],['Soap','Toiletries','🧼'],['Body wash','Toiletries','🧴'],['Deodorant','Toiletries','🧴'],['Tissues','Toiletries','🤧'],['Sunscreen','Toiletries','🧴'],
  ['Pain relief','Pharmacy','💊'],['Bandages','Pharmacy','🩹'],['Antiseptic','Pharmacy','🧴'],['Cold & flu','Pharmacy','💊'],
  ['Batteries','Other','🔋'],['Phone charger','Other','🔌'],['Umbrella','Other','☂️'],['Gift','Other','🎁']
];

function ensureStore(db,name,options){
  return db.objectStoreNames.contains(name) ? null : db.createObjectStore(name,options);
}

export function openDb(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded = ()=>{
      const db=req.result;
      ensureStore(db,'settings',{keyPath:'key'});
      ensureStore(db,'stays',{keyPath:'id'});
      const createdExpenses=ensureStore(db,'expenses',{keyPath:'id'});
      const expenseStore=createdExpenses || req.transaction.objectStore('expenses');
      if(!expenseStore.indexNames.contains('date')) expenseStore.createIndex('date','date');
      if(!expenseStore.indexNames.contains('transferred')) expenseStore.createIndex('transferred','transferred');
      if(!expenseStore.indexNames.contains('stayId')) expenseStore.createIndex('stayId','stayId');
      ensureStore(db,'people',{keyPath:'id'});
      ensureStore(db,'shoppingItems',{keyPath:'id'});
      ensureStore(db,'categories',{keyPath:'id'});
      ensureStore(db,'catalogue',{keyPath:'id'});
      ensureStore(db,'regularItems',{keyPath:'id'});
      ensureStore(db,'imports',{keyPath:'id'});
    };
    req.onblocked=()=>{dbPromise=null;reject(new Error('Travel Buddy database upgrade is blocked by another open tab.'));};
    req.onsuccess=()=>{
      const db=req.result;
      db.onversionchange=()=>{db.close();dbPromise=null;};
      db.onclose=()=>{dbPromise=null;};
      resolve(db);
    };
    req.onerror=()=>{dbPromise=null;reject(req.error);};
  });
  return dbPromise;
}

function requestPromise(req){
  return new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result??null);
    req.onerror=()=>reject(req.error);
  });
}

export async function readStore(storeName,reader){
  const db=await openDb();
  const tx=db.transaction(storeName,'readonly');
  return reader(tx.objectStore(storeName),requestPromise);
}

export async function atomicWrite(storeNames,writer){
  const db=await openDb();
  const names=[...new Set(Array.isArray(storeNames)?storeNames:[storeNames])];
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,'readwrite');
    const stores=Object.fromEntries(names.map(name=>[name,tx.objectStore(name)]));
    let result;
    try{ result=writer(stores); }
    catch(err){ try{tx.abort();}catch{} reject(err); return; }
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
    tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
  });
}

export const getRecord=(store,key)=>readStore(store,(st,rq)=>rq(st.get(key)));
export const getAll=store=>readStore(store,(st,rq)=>rq(st.getAll())).then(rows=>rows||[]);
export const putRecord=(store,value)=>atomicWrite(store,st=>st[store].put(value)).then(()=>value);
export const deleteRecord=(store,key)=>atomicWrite(store,st=>st[store].delete(key));
export const clearStore=store=>atomicWrite(store,st=>st[store].clear());
export const putMany=(store,values)=>atomicWrite(store,st=>{for(const value of values)st[store].put(value);return values;});

function defaultSeedRecords(ts=new Date().toISOString()){
  const people=[
    {id:'person-cameron',name:'Cameron',initials:'C',createdAt:ts,modifiedAt:ts},
    {id:'person-kym',name:'Kym',initials:'K',createdAt:ts,modifiedAt:ts}
  ];
  const categories=CATEGORY_SEEDS.map(([id,name,icon,sortOrder])=>({id,name,icon,sortOrder,builtIn:true,createdAt:ts,modifiedAt:ts}));
  const categoryIdByName=new Map(categories.map(c=>[c.name,c.id]));
  const catalogue=CATALOGUE_SEEDS.map(([name,categoryName,icon],index)=>({
    id:`builtin-${index+1}`,
    name,
    icon,
    categoryId:categoryIdByName.get(categoryName),
    builtIn:true,
    createdAt:ts,
    modifiedAt:ts
  }));
  return {people,categories,catalogue};
}

export async function resetDatabase(){
  const ts=new Date().toISOString();
  const seeds=defaultSeedRecords(ts);
  await atomicWrite(STORES,st=>{
    for(const name of STORES) st[name].clear();
    for(const p of seeds.people) st.people.put(p);
    for(const c of seeds.categories) st.categories.put(c);
    for(const item of seeds.catalogue) st.catalogue.put(item);
    st.settings.put({key:'app',value:{schemaVersion:SCHEMA_VERSION,initialSeedComplete:true,resetAt:ts}});
  });
}

async function ensureBuiltInShoppingData(){
  const ts=new Date().toISOString();
  const [categories,catalogue]=await Promise.all([getAll('categories'),getAll('catalogue')]);
  const categoriesById=new Map(categories.map(c=>[c.id,c]));
  const categoriesByName=new Map(categories.map(c=>[String(c.name).trim().toLowerCase(),c]));
  const actualCategoryIdBySeedName=new Map();
  const categoryPuts=[];

  for(const [seedId,name,icon,sortOrder] of CATEGORY_SEEDS){
    const existing=categoriesById.get(seedId)||categoriesByName.get(name.toLowerCase());
    if(existing){
      actualCategoryIdBySeedName.set(name,existing.id);
      if(existing.icon!==icon||existing.sortOrder!==sortOrder||existing.builtIn!==true){
        categoryPuts.push({...existing,icon,sortOrder,builtIn:true,modifiedAt:ts});
      }
    }else{
      const created={id:seedId,name,icon,sortOrder,builtIn:true,createdAt:ts,modifiedAt:ts};
      categoryPuts.push(created);
      actualCategoryIdBySeedName.set(name,seedId);
    }
  }

  const catalogueByKey=new Map(catalogue.map(item=>[`${String(item.categoryId)}|${String(item.name).trim().toLowerCase()}`,item]));
  const cataloguePuts=[];
  for(let index=0;index<CATALOGUE_SEEDS.length;index++){
    const [name,categoryName,icon]=CATALOGUE_SEEDS[index];
    const categoryId=actualCategoryIdBySeedName.get(categoryName);
    if(!categoryId) continue;
    const key=`${categoryId}|${name.toLowerCase()}`;
    const existing=catalogueByKey.get(key);
    if(existing){
      if(existing.icon!==icon||existing.builtIn!==true){cataloguePuts.push({...existing,icon,builtIn:true,modifiedAt:ts});}
    }else{
      cataloguePuts.push({id:`builtin-${index+1}`,name,icon,categoryId,builtIn:true,createdAt:ts,modifiedAt:ts});
    }
  }

  if(categoryPuts.length||cataloguePuts.length){
    await atomicWrite(['categories','catalogue'],st=>{
      for(const c of categoryPuts) st.categories.put(c);
      for(const item of cataloguePuts) st.catalogue.put(item);
    });
  }
}

async function migrateReferences(){
  const [categories,catalogue,regularItems,shoppingItems]=await Promise.all([
    getAll('categories'),getAll('catalogue'),getAll('regularItems'),getAll('shoppingItems')
  ]);
  const byName=new Map(categories.map(c=>[String(c.name).trim().toLowerCase(),c.id]));
  const otherId=byName.get('other')||categories[0]?.id||null;
  const catalogueUpdates=catalogue.filter(x=>!x.categoryId).map(x=>({...x,categoryId:byName.get(String(x.category||'').toLowerCase())||otherId,modifiedAt:x.modifiedAt||new Date().toISOString()}));
  const regularUpdates=regularItems.filter(x=>!x.categoryId).map(x=>({...x,categoryId:byName.get(String(x.category||'').toLowerCase())||otherId,modifiedAt:x.modifiedAt||new Date().toISOString()}));
  const ordered=[...shoppingItems].sort(shoppingSortStable);
  let sequence=1;
  const shoppingUpdates=[];
  for(const x of ordered){
    const next={...x};
    let changed=false;
    if(!next.categoryId){next.categoryId=byName.get(String(next.category||'').toLowerCase())||otherId;changed=true;}
    if(!Number.isFinite(Number(next.order))){next.order=sequence;changed=true;}
    sequence=Math.max(sequence+1,(Number(next.order)||0)+1);
    if(changed){next.modifiedAt=next.modifiedAt||new Date().toISOString();shoppingUpdates.push(next);}
  }
  if(catalogueUpdates.length||regularUpdates.length||shoppingUpdates.length){
    await atomicWrite(['catalogue','regularItems','shoppingItems'],st=>{
      for(const x of catalogueUpdates) st.catalogue.put(x);
      for(const x of regularUpdates) st.regularItems.put(x);
      for(const x of shoppingUpdates) st.shoppingItems.put(x);
    });
  }
}

export async function ensureSeedData(){
  const app=await getRecord('settings','app');
  if(!app?.value?.initialSeedComplete){
    const ts=new Date().toISOString();
    const seeds=defaultSeedRecords(ts);
    const [people,categories,catalogue]=await Promise.all([getAll('people'),getAll('categories'),getAll('catalogue')]);
    await atomicWrite(['settings','people','categories','catalogue'],st=>{
      if(!people.length) for(const p of seeds.people) st.people.put(p);
      if(!categories.length) for(const c of seeds.categories) st.categories.put(c);
      if(!catalogue.length) for(const item of seeds.catalogue) st.catalogue.put(item);
      st.settings.put({key:'app',value:{...(app?.value||{}),schemaVersion:SCHEMA_VERSION,initialSeedComplete:true,initializedAt:app?.value?.initializedAt||ts}});
    });
  }else if(app.value.schemaVersion!==SCHEMA_VERSION){
    await putRecord('settings',{key:'app',value:{...app.value,schemaVersion:SCHEMA_VERSION}});
  }
  await ensureBuiltInShoppingData();
  await migrateReferences();
}
