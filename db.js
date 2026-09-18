import { SCHEMA_VERSION, shoppingSortStable } from './logic.js';
const DB_NAME = 'travel-buddy';
const DB_VERSION = SCHEMA_VERSION;
export const STORES = ['settings','stays','expenses','people','shoppingItems','categories','catalogue','regularItems','imports'];
let dbPromise=null;

function ensureStore(db,name,options){return db.objectStoreNames.contains(name)?null:db.createObjectStore(name,options);}

export function openDb() {
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      ensureStore(db,'settings',{keyPath:'key'});
      ensureStore(db,'stays',{keyPath:'id'});
      const expenses=ensureStore(db,'expenses',{keyPath:'id'});
      const expenseStore=expenses || req.transaction.objectStore('expenses');
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

function requestPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);});}

export async function readStore(storeName, reader){
  const db=await openDb();
  const tx=db.transaction(storeName,'readonly');
  const result=await reader(tx.objectStore(storeName),requestPromise);
  return result;
}

export async function atomicWrite(storeNames, writer){
  const db=await openDb();
  const names=[...new Set(Array.isArray(storeNames)?storeNames:[storeNames])];
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,'readwrite');
    const stores=Object.fromEntries(names.map(n=>[n,tx.objectStore(n)]));
    let result;
    try{result=writer(stores);}catch(err){try{tx.abort();}catch{} reject(err);return;}
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
    tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
  });
}

export const getRecord=(s,k)=>readStore(s,(st,rq)=>rq(st.get(k)));
export const getAll=s=>readStore(s,(st,rq)=>rq(st.getAll())).then(x=>x||[]);
export const putRecord=(s,v)=>atomicWrite(s,st=>st[s].put(v)).then(()=>v);
export const deleteRecord=(s,k)=>atomicWrite(s,st=>st[s].delete(k));
export const clearStore=s=>atomicWrite(s,st=>st[s].clear());
export const putMany=(s,values)=>atomicWrite(s,st=>{for(const v of values)st[s].put(v);return values;});

function defaultSeedRecords(ts=new Date().toISOString()){
  const people=[
    {id:'person-cameron',name:'Cameron',initials:'C',createdAt:ts,modifiedAt:ts},
    {id:'person-kym',name:'Kym',initials:'K',createdAt:ts,modifiedAt:ts}
  ];
  const names=['Fruit & Veg','Meat','Dairy','Bakery','Pantry','Drinks','Household','Toiletries','Other'];
  const categories=names.map((name,i)=>({id:`cat-${i+1}`,name,builtIn:true,createdAt:ts,modifiedAt:ts}));
  const byName=new Map(categories.map(c=>[c.name,c.id]));
  const catalogueSeed=[['Apples','Fruit & Veg'],['Bananas','Fruit & Veg'],['Tomatoes','Fruit & Veg'],['Chicken','Meat'],['Milk','Dairy'],['Cheese','Dairy'],['Bread','Bakery'],['Rice','Pantry'],['Coffee','Pantry'],['Water','Drinks'],['Laundry detergent','Household'],['Toothpaste','Toiletries']];
  const catalogue=catalogueSeed.map(([name,categoryName],i)=>({id:`seed-${i+1}`,name,categoryId:byName.get(categoryName),builtIn:true,createdAt:ts,modifiedAt:ts}));
  return {people,categories,catalogue};
}

export async function resetDatabase(){
  const ts=new Date().toISOString(); const seeds=defaultSeedRecords(ts);
  await atomicWrite(STORES,st=>{
    for(const name of STORES) st[name].clear();
    for(const p of seeds.people) st.people.put(p);
    for(const c of seeds.categories) st.categories.put(c);
    for(const x of seeds.catalogue) st.catalogue.put(x);
    st.settings.put({key:'app',value:{schemaVersion:SCHEMA_VERSION,initialSeedComplete:true,resetAt:ts}});
  });
}

async function migrateReferences(){
  const [categories,catalogue,regularItems,shoppingItems]=await Promise.all([getAll('categories'),getAll('catalogue'),getAll('regularItems'),getAll('shoppingItems')]);
  const byName=new Map(categories.map(c=>[String(c.name).toLowerCase(),c.id]));
  const otherId=byName.get('other')||categories[0]?.id||null;
  const catalogueUpdates=catalogue.filter(x=>!x.categoryId).map(x=>({...x,categoryId:byName.get(String(x.category||'').toLowerCase())||otherId,modifiedAt:x.modifiedAt||new Date().toISOString()}));
  const regularUpdates=regularItems.filter(x=>!x.categoryId).map(x=>({...x,categoryId:byName.get(String(x.category||'').toLowerCase())||otherId,modifiedAt:x.modifiedAt||new Date().toISOString()}));
  const ordered=[...shoppingItems].sort(shoppingSortStable); let sequence=1;
  const shoppingUpdates=[];
  for(const x of ordered){
    const next={...x}; let changed=false;
    if(!next.categoryId){next.categoryId=byName.get(String(next.category||'').toLowerCase())||otherId;changed=true;}
    if(!Number.isFinite(Number(next.order))){next.order=sequence;changed=true;}
    sequence=Math.max(sequence+1,(Number(next.order)||0)+1);
    if(changed){next.modifiedAt=next.modifiedAt||new Date().toISOString();shoppingUpdates.push(next);}
  }
  if(catalogueUpdates.length||regularUpdates.length||shoppingUpdates.length){
    await atomicWrite(['catalogue','regularItems','shoppingItems'],st=>{
      for(const x of catalogueUpdates)st.catalogue.put(x);
      for(const x of regularUpdates)st.regularItems.put(x);
      for(const x of shoppingUpdates)st.shoppingItems.put(x);
    });
  }
}

export async function ensureSeedData(){
  const app=await getRecord('settings','app');
  if(!app?.value?.initialSeedComplete){
    const ts=new Date().toISOString(); const seeds=defaultSeedRecords(ts);
    const [people,categories,catalogue]=await Promise.all([getAll('people'),getAll('categories'),getAll('catalogue')]);
    await atomicWrite(['settings','people','categories','catalogue'],st=>{
      if(!people.length) for(const p of seeds.people) st.people.put(p);
      if(!categories.length) for(const c of seeds.categories) st.categories.put(c);
      if(!catalogue.length) for(const x of seeds.catalogue) st.catalogue.put(x);
      st.settings.put({key:'app',value:{...(app?.value||{}),schemaVersion:SCHEMA_VERSION,initialSeedComplete:true,initializedAt:app?.value?.initializedAt||ts}});
    });
  }else if(app.value.schemaVersion!==SCHEMA_VERSION){
    await putRecord('settings',{key:'app',value:{...app.value,schemaVersion:SCHEMA_VERSION}});
  }
  await migrateReferences();
}
