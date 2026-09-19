const PRODUCT_TYPES = Object.freeze({
  'Apples':'apple','Bananas':'banana','Oranges':'orange','Grapes':'grapes','Strawberries':'strawberry','Avocado':'avocado','Tomatoes':'tomato','Potatoes':'potato','Carrots':'carrot','Broccoli':'broccoli','Lettuce':'lettuce','Onions':'onion',
  'Chicken':'chicken','Beef':'beef','Steak':'steak','Pork':'pork','Bacon':'bacon','Sausages':'sausages','Fish':'fish','Salmon':'salmon',
  'Milk':'milk','Cheese':'cheese','Yoghurt':'yoghurt','Butter':'butter','Eggs':'eggs','Cream':'cream',
  'Bread':'bread','Bread rolls':'rolls','Croissants':'croissant','Wraps':'wraps','Muffins':'muffins',
  'Rice':'rice','Pasta':'pasta','Cereal':'cereal','Coffee':'coffee','Tea':'tea','Sugar':'sugar','Flour':'flour','Olive oil':'olive-oil','Tomato sauce':'tomato-sauce','Tinned tomatoes':'tinned-tomatoes','Beans':'beans','Soup':'soup','Salt':'salt','Pepper':'pepper','Snacks':'snacks','Chocolate':'chocolate',
  'Frozen vegetables':'frozen-veg','Frozen chips':'frozen-chips','Frozen pizza':'frozen-pizza','Ice cream':'ice-cream',
  'Water':'water','Sparkling water':'sparkling-water','Juice':'juice','Soft drink':'soft-drink','Milk drink':'milk-drink',
  'Laundry detergent':'laundry','Dishwashing liquid':'dish-liquid','Dishwasher tablets':'dish-tabs','Paper towel':'paper-towel','Toilet paper':'toilet-paper','Bin bags':'bin-bags','Cleaning spray':'cleaning-spray','Sponges':'sponges',
  'Toothpaste':'toothpaste','Toothbrush':'toothbrush','Shampoo':'shampoo','Conditioner':'conditioner','Soap':'soap','Body wash':'body-wash','Deodorant':'deodorant','Tissues':'tissues','Sunscreen':'sunscreen',
  'Pain relief':'pain-relief','Bandages':'bandages','Antiseptic':'antiseptic','Cold & flu':'cold-flu',
  'Batteries':'batteries','Phone charger':'charger','Umbrella':'umbrella','Gift':'gift'
});

const CATEGORY_FALLBACKS = Object.freeze({
  'Fruit & Veg':'◌','Meat':'◇','Dairy':'▱','Bakery':'⌒','Pantry':'▣','Frozen':'✣','Drinks':'◍','Household':'⌂','Toiletries':'○','Pharmacy':'✚','Other':'＋'
});

const icon = (body,name='') => `<svg class="product-svg" viewBox="0 0 64 64" role="img" aria-label="${String(name).replace(/[&<>\"]/g,'')} illustration" data-product="${String(name).replace(/[&<>\"]/g,'')}"><g class="product-fill">${body}</g></svg>`;
const stroke = path => `<path d="${path}"/>`;
const circle = (cx,cy,r,cls='') => `<circle${cls?` class="${cls}"`:''} cx="${cx}" cy="${cy}" r="${r}"/>`;
const rect = (x,y,w,h,rx=4,cls='') => `<rect${cls?` class="${cls}"`:''} x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

function draw(type,name){
  switch(type){
    case 'apple': return icon(`${circle(31,35,16,'accent-fill')}${stroke('M31 18c0-7 4-10 9-12M31 18c-5-5-11-4-14-1')}${stroke('M21 34c3 8 7 12 10 12')}`,name);
    case 'banana': return icon(`${stroke('M14 22c7 22 25 30 39 17-15 5-25-6-28-24-4 1-8 3-11 7Z')}${stroke('M20 18l5-3M50 38l4 3')}`,name);
    case 'orange': return icon(`${circle(31,34,17,'accent-fill')}${stroke('M31 17c2-6 7-8 13-6-3 5-7 7-13 6Z')}${stroke('M21 27c7-5 16-5 23 0')}`,name);
    case 'grapes': return icon(`${circle(26,25,6,'accent-fill')}${circle(36,25,6,'accent-fill')}${circle(21,34,6,'accent-fill')}${circle(31,35,6,'accent-fill')}${circle(41,35,6,'accent-fill')}${circle(27,44,6,'accent-fill')}${circle(37,44,6,'accent-fill')}${stroke('M31 17c1-7 6-10 12-11')}`,name);
    case 'strawberry': return icon(`${stroke('M18 22c2 23 10 31 14 31s12-8 14-31c-9-6-19-6-28 0Z')}${stroke('M22 20c5 1 8-2 10-7 2 5 5 8 10 7')}${circle(27,31,1.4,'accent-fill')}${circle(36,34,1.4,'accent-fill')}${circle(31,42,1.4,'accent-fill')}`,name);
    case 'avocado': return icon(`${stroke('M32 11c-8 8-17 22-17 32 0 9 7 14 17 14s17-5 17-14c0-10-9-24-17-32Z')}${circle(32,42,8,'accent-fill')}`,name);
    case 'tomato': return icon(`${circle(32,36,17,'accent-fill')}${stroke('M32 19l4-7M32 19c-4-5-10-4-14-1M32 19c4-5 10-4 14-1M32 19l-7 3M32 19l7 3')}`,name);
    case 'potato': return icon(`${stroke('M16 34c0-12 8-20 21-19 10 1 15 8 13 18-2 11-9 17-21 16-9-1-13-7-13-15Z')}${circle(27,27,1.4,'accent-fill')}${circle(38,34,1.4,'accent-fill')}${circle(26,42,1.4,'accent-fill')}`,name);
    case 'carrot': return icon(`${stroke('M23 23 47 14 34 51Z')}${stroke('M23 23c-6-6-8-11-6-16M24 22c1-8 4-13 9-17M24 22c7-5 13-6 18-4')}`,name);
    case 'broccoli': return icon(`${circle(24,23,8,'accent-fill')}${circle(34,20,9,'accent-fill')}${circle(43,25,8,'accent-fill')}${circle(29,31,8,'accent-fill')}${circle(39,32,8,'accent-fill')}${stroke('M34 31v20M28 50h13')}`,name);
    case 'lettuce': return icon(`${stroke('M12 37c6-20 33-27 43-10-2 19-17 29-34 23-7-2-10-7-9-13Z')}${stroke('M20 42c8-9 17-14 28-15M24 32c5 1 8 4 10 8M37 24c1 5 0 10-3 16')}`,name);
    case 'onion': return icon(`${stroke('M31 13c2 5 9 8 12 14 6 12-1 25-12 25S13 39 19 27c3-6 10-9 12-14Z')}${stroke('M31 14V7M25 9h12M26 29c-4 8-2 15 5 21')}`,name);

    case 'chicken': return icon(`${stroke('M18 31c0-11 10-19 21-15 8 3 11 12 6 19-5 7-16 10-23 5-3-2-4-5-4-9Z')}${stroke('M43 36l8 8M51 44l5-2M51 44l2 5')}`,name);
    case 'beef': return icon(`${stroke('M14 37c1-13 12-22 25-20 12 2 17 12 11 22-7 11-25 14-33 6-3-2-4-5-3-8Z')}${circle(38,33,6,'accent-fill')}`,name);
    case 'steak': return icon(`${stroke('M13 36c4-17 23-25 36-14 11 10 2 27-15 28-13 1-24-5-21-14Z')}${stroke('M23 33c6-8 16-9 24-4')}${circle(28,39,3,'accent-fill')}`,name);
    case 'pork': return icon(`${stroke('M17 20c13-5 28 0 32 12 4 13-7 23-21 20-13-3-19-18-11-32Z')}${circle(36,34,5,'accent-fill')}${stroke('M22 19c-1-5 1-8 5-10')}`,name);
    case 'bacon': return icon(`${stroke('M13 20c8-5 10 5 18 0s10 5 18 0v24c-8 5-10-5-18 0s-10-5-18 0V20Z')}${stroke('M20 20v24M42 20v24')}`,name);
    case 'sausages': return icon(`${stroke('M13 37c2-9 7-17 14-22 4-3 10-2 12 2 3 5 0 10-4 13-7 6-11 12-13 20')}${stroke('M37 33c5-1 9 0 11 4 2 5-1 10-6 12-5 3-10 3-15 1')}`,name);
    case 'fish': return icon(`${stroke('M13 33c9-13 24-17 36-7l8-7v27l-8-7c-12 10-27 6-36-6Z')}${circle(42,29,1.8,'accent-fill')}${stroke('M22 33h12')}`,name);
    case 'salmon': return icon(`${stroke('M10 35c8-15 25-21 39-12l7-6v24l-7-6c-14 9-31 3-39 0Z')}${stroke('M21 27c8 2 15 6 21 12M18 36c8-1 15 1 21 5')}${circle(43,28,1.8,'accent-fill')}`,name);

    case 'milk': return icon(`${stroke('M24 12h17l4 9v31H20V21l4-9Z')}${stroke('M20 23h25M27 12v10M28 32h9')}`,name);
    case 'cheese': return icon(`${stroke('M12 27 43 15l10 10v26H12V27Z')}${circle(25,35,3,'accent-fill')}${circle(40,30,2.5,'accent-fill')}${circle(35,45,3,'accent-fill')}`,name);
    case 'yoghurt': return icon(`${stroke('M18 22h28l-3 30H21l-3-30Z')}${stroke('M16 18h32v7H16z')}${stroke('M25 37c6-5 10-5 16 0')}`,name);
    case 'butter': return icon(`${rect(13,28,38,18,4,'accent-fill')}${stroke('M18 25h33v21M13 31l10-9h31v19l-8 5')}`,name);
    case 'eggs': return icon(`${stroke('M12 37h40l-4 12H16l-4-12Z')}${circle(20,31,6,'accent-fill')}${circle(32,29,7,'accent-fill')}${circle(44,31,6,'accent-fill')}`,name);
    case 'cream': return icon(`${stroke('M24 15h17l5 9v28H19V24l5-9Z')}${stroke('M19 26h27M28 15v11')}${stroke('M27 39c4-5 10-5 14 0')}`,name);

    case 'bread': return icon(`${stroke('M14 31c0-10 8-17 18-17s18 7 18 17v17H14V31Z')}${stroke('M23 19c1 5 4 8 9 10M34 17c1 5 4 8 9 10')}`,name);
    case 'rolls': return icon(`${stroke('M8 39c0-9 7-15 15-15s15 6 15 15v10H8V39Z')}${stroke('M29 36c0-9 6-15 14-15s13 6 13 15v13H29')}${stroke('M16 30c4 2 7 2 11 0M38 28c4 2 7 2 10 0')}`,name);
    case 'croissant': return icon(`${stroke('M11 37c4-15 13-23 21-23s17 8 21 23c-5 10-12 15-21 15S16 47 11 37Z')}${stroke('M20 24c2 12 2 20 0 25M44 24c-2 12-2 20 0 25M25 19c5 10 9 10 14 0')}`,name);
    case 'wraps': return icon(`${stroke('M13 25h38l-5 27H18l-5-27Z')}${stroke('M13 25c8 4 15 4 23 0s10-4 15 0')}${stroke('M24 32l15 13')}`,name);
    case 'muffins': return icon(`${stroke('M19 28h27l-4 24H23l-4-24Z')}${stroke('M17 28c0-9 7-16 15-16 6 0 10 3 12 8 5 0 8 4 8 8H17Z')}${stroke('M27 34h11')}`,name);

    case 'rice': return icon(`${stroke('M13 31h38c-2 14-8 21-19 21s-17-7-19-21Z')}${stroke('M18 30c4-8 10-12 15-12s12 4 14 12')}${circle(25,25,1.2,'accent-fill')}${circle(34,23,1.2,'accent-fill')}${circle(42,27,1.2,'accent-fill')}`,name);
    case 'pasta': return icon(`${stroke('M14 31h36v18H14z')}${stroke('M19 25c5-7 8 7 13 0s8 7 13 0')}${stroke('M20 36c6 6 8-6 14 0s8-6 12 0')}`,name);
    case 'cereal': return icon(`${rect(17,12,30,40,3,'accent-fill')}${stroke('M17 24h30M23 31h18M23 38h18')}`,name);
    case 'coffee': return icon(`${stroke('M14 23h31v22c0 5-4 8-9 8H23c-5 0-9-3-9-8V23Z')}${stroke('M45 29h5c6 0 7 12 0 14h-5')}${stroke('M23 17c-3-4 2-6 0-10M33 17c-3-4 2-6 0-10')}`,name);
    case 'tea': return icon(`${stroke('M14 25h30v20c0 5-4 8-9 8H23c-5 0-9-3-9-8V25Z')}${stroke('M44 31h5c5 0 6 10 0 12h-5M29 13v20M29 13h10v9')}`,name);
    case 'sugar': return icon(`${rect(18,14,28,38,4,'accent-fill')}${stroke('M18 25h28M25 35h14M25 42h14')}`,name);
    case 'flour': return icon(`${stroke('M20 11h24l4 11-3 30H19l-3-30 4-11Z')}${stroke('M16 22h32M25 33c5-5 9-5 14 0M32 28v16')}`,name);
    case 'olive-oil': return icon(`${stroke('M27 10h10v9l5 7v26H22V26l5-7v-9Z')}${stroke('M27 17h10M27 34h10')}${stroke('M31 30c4-5 8-6 11-3-2 5-5 7-11 3Z')}`,name);
    case 'tomato-sauce': return icon(`${stroke('M24 11h16v8l5 8v25H19V27l5-8v-8Z')}${stroke('M19 31h26')}${circle(32,40,6,'accent-fill')}`,name);
    case 'tinned-tomatoes': return icon(`${rect(19,11,26,42,5,'accent-fill')}${stroke('M19 20h26M19 44h26')}${circle(32,32,6)}`,name);
    case 'beans': return icon(`${rect(19,11,26,42,5,'accent-fill')}${stroke('M19 20h26M19 44h26')}${stroke('M25 33c2-7 10-7 12-1 1 6-5 9-9 7')}`,name);
    case 'soup': return icon(`${rect(19,11,26,42,5,'accent-fill')}${stroke('M19 20h26M19 44h26M25 31h14M25 37h10')}`,name);
    case 'salt': return icon(`${stroke('M23 18h18l4 34H19l4-34Z')}${stroke('M25 12h14l2 6H23l2-6Z')}${circle(29,15,1) }${circle(35,15,1)}${circle(32,22,1,'accent-fill')}`,name);
    case 'pepper': return icon(`${stroke('M23 18h18l4 34H19l4-34Z')}${stroke('M25 12h14l2 6H23l2-6Z')}${circle(28,15,1,'accent-fill')}${circle(32,15,1,'accent-fill')}${circle(36,15,1,'accent-fill')}${stroke('M27 33h10')}`,name);
    case 'snacks': return icon(`${stroke('M18 13h28l4 39H14l4-39Z')}${stroke('M18 22h28M22 35c6-5 14-5 20 0')}`,name);
    case 'chocolate': return icon(`${rect(15,14,34,38,3,'accent-fill')}${stroke('M15 27h34M15 40h34M26 14v38M38 14v38')}`,name);

    case 'frozen-veg': return icon(`${stroke('M32 7v50M10 20l44 24M10 44l44-24')}${circle(24,33,5,'accent-fill')}${circle(37,27,5,'accent-fill')}${circle(39,40,4,'accent-fill')}`,name);
    case 'frozen-chips': return icon(`${stroke('M20 13l5 28M29 11l3 30M39 14l-2 27M46 16l-4 25')}${stroke('M17 36h31l-4 17H21l-4-17Z')}`,name);
    case 'frozen-pizza': return icon(`${circle(32,32,21,'accent-fill')}${stroke('M12 32h40M32 11v42M17 18l30 28M47 18 17 46')}${circle(24,25,2.5)}${circle(40,35,2.5)}${circle(27,42,2.5)}`,name);
    case 'ice-cream': return icon(`${stroke('M22 35h20L32 55 22 35Z')}${circle(25,29,9,'accent-fill')}${circle(36,26,10,'accent-fill')}${circle(43,32,7,'accent-fill')}`,name);

    case 'water': return icon(`${stroke('M26 10h12v8l5 8v27H21V26l5-8v-8Z')}${stroke('M24 35c6 3 10 3 16 0')}`,name);
    case 'sparkling-water': return icon(`${stroke('M26 10h12v8l5 8v27H21V26l5-8v-8Z')}${circle(29,33,1.6,'accent-fill')}${circle(36,39,1.6,'accent-fill')}${circle(32,45,1.4,'accent-fill')}`,name);
    case 'juice': return icon(`${rect(20,15,25,37,3,'accent-fill')}${stroke('M20 24h25M36 15l6-7M28 34c5-6 9-6 14 0')}`,name);
    case 'soft-drink': return icon(`${stroke('M23 13h18l4 39H19l4-39Z')}${stroke('M22 21h20M27 31h10')}`,name);
    case 'milk-drink': return icon(`${stroke('M23 12h18l5 10v30H18V22l5-10Z')}${stroke('M18 25h28M26 12v13')}${circle(33,38,5,'accent-fill')}`,name);

    case 'laundry': return icon(`${stroke('M19 10h26l5 42H14l5-42Z')}${stroke('M19 20h26M25 32h14')}${circle(32,42,4,'accent-fill')}`,name);
    case 'dish-liquid': return icon(`${stroke('M25 14h14v6l5 7v25H20V27l5-7v-6Z')}${stroke('M31 14V9h14M44 9v6')}${stroke('M25 36h14')}`,name);
    case 'dish-tabs': return icon(`${rect(14,18,36,34,4,'accent-fill')}${rect(20,25,10,10,3)}${rect(34,25,10,10,3)}${rect(20,39,10,8,3)}${rect(34,39,10,8,3)}`,name);
    case 'paper-towel': return icon(`${stroke('M22 12h20v40H22z')}${stroke('M22 22h20M22 34h20M22 46h20')}${circle(32,18,3,'accent-fill')}`,name);
    case 'toilet-paper': return icon(`${circle(27,31,17,'accent-fill')}${circle(27,31,6)}${stroke('M44 31h8v20H32')}`,name);
    case 'bin-bags': return icon(`${stroke('M22 14h20l-3 8 7 31H18l7-31-3-8Z')}${stroke('M25 22h14M26 14c0-4 12-4 12 0')}`,name);
    case 'cleaning-spray': return icon(`${stroke('M25 20h18l4 9v23H20V29l5-9Z')}${stroke('M29 20v-7h12l5 4M34 13h14')}${stroke('M26 35h15')}`,name);
    case 'sponges': return icon(`${rect(13,24,38,25,7,'accent-fill')}${stroke('M17 34c8-6 22-6 30 0M17 41c8-6 22-6 30 0')}`,name);

    case 'toothpaste': return icon(`${stroke('M18 24h30l-5 28H23l-5-28Z')}${stroke('M21 17h24v7H21zM27 34h12')}`,name);
    case 'toothbrush': return icon(`${stroke('M12 41 44 14M16 45l32-27')}${rect(43,9,10,13,2,'accent-fill')}${stroke('M45 10v8M49 10v8M53 10v8')}`,name);
    case 'shampoo': return icon(`${stroke('M22 17h22v35H18V27l4-10Z')}${stroke('M28 17v-7h13M41 10v6')}${stroke('M24 34h14')}`,name);
    case 'conditioner': return icon(`${stroke('M21 18h23v34H18V28l3-10Z')}${stroke('M27 18v-6h12v6')}${stroke('M24 34c5-5 10-5 15 0')}`,name);
    case 'soap': return icon(`${rect(13,27,38,22,9,'accent-fill')}${stroke('M20 34c7 5 17 5 24 0')}`,name);
    case 'body-wash': return icon(`${stroke('M21 18h23v34H18V28l3-10Z')}${stroke('M27 18v-7h13v7M25 35h12')}${circle(31,42,3,'accent-fill')}`,name);
    case 'deodorant': return icon(`${stroke('M23 14h18l4 38H19l4-38Z')}${stroke('M21 14h22v8H21zM25 33h14')}`,name);
    case 'tissues': return icon(`${rect(12,29,40,23,5,'accent-fill')}${stroke('M20 29c2-13 20-13 24 0M24 21c5 3 11 3 16 0')}`,name);
    case 'sunscreen': return icon(`${stroke('M18 23h30l-5 29H23l-5-29Z')}${stroke('M21 16h24v7H21z')}${circle(33,36,6,'accent-fill')}${stroke('M33 27v3M33 42v3M24 36h3M39 36h3')}`,name);

    case 'pain-relief': return icon(`${rect(13,18,38,34,4,'accent-fill')}${stroke('M32 25v20M22 35h20')}${circle(20,12,4)}${circle(44,12,4)}`,name);
    case 'bandages': return icon(`${stroke('M15 40 40 15l9 9-25 25-9-9Z')}${circle(29,31,2,'accent-fill')}${circle(35,25,2,'accent-fill')}${circle(23,37,2,'accent-fill')}`,name);
    case 'antiseptic': return icon(`${stroke('M25 12h14v8l5 8v24H20V28l5-8v-8Z')}${stroke('M20 31h24M32 35v12M26 41h12')}`,name);
    case 'cold-flu': return icon(`${rect(12,19,40,33,4,'accent-fill')}${stroke('M19 28h26M20 38c7-5 17-5 24 0')}${circle(20,12,4)}${circle(44,12,4)}`,name);

    case 'batteries': return icon(`${rect(14,19,15,35,3,'accent-fill')}${rect(35,19,15,35,3,'accent-fill')}${rect(18,14,7,5,1)}${rect(39,14,7,5,1)}${stroke('M19 32h5M21.5 29.5v5M40 32h5')}`,name);
    case 'charger': return icon(`${stroke('M19 13h17v14H19zM23 13V8M32 13V8M27 27v11c0 7 5 11 12 11h7')}${circle(49,49,3,'accent-fill')}`,name);
    case 'umbrella': return icon(`${stroke('M10 32c4-13 13-20 22-20s18 7 22 20H10Z')}${stroke('M32 12v35c0 8 10 8 10 0')}${stroke('M12 32c6-6 12-6 20 0 8-6 14-6 20 0')}`,name);
    case 'gift': return icon(`${rect(13,26,38,28,3,'accent-fill')}${stroke('M10 20h44v10H10zM32 20v34M24 20c-7 0-8-9-1-10 5-1 8 4 9 10M40 20c7 0 8-9 1-10-5-1-8 4-9 10')}`,name);
    default: return '';
  }
}

export const BUILT_IN_PRODUCT_NAMES = Object.freeze(Object.keys(PRODUCT_TYPES));
export const hasBuiltInProductArt = name => Object.prototype.hasOwnProperty.call(PRODUCT_TYPES,String(name||''));

export function productArt(name, categoryName='Other'){
  const clean=String(name||'').trim();
  const type=PRODUCT_TYPES[clean];
  if(type) return draw(type,clean);
  const glyph=CATEGORY_FALLBACKS[String(categoryName||'Other')]||CATEGORY_FALLBACKS.Other;
  return `<span class="product-fallback" aria-hidden="true">${glyph}</span>`;
}

const CATEGORY_HERO_NAMES = Object.freeze({
  'Fruit & Veg':['Tomatoes','Broccoli'],
  'Meat':['Steak','Chicken'],
  'Dairy':['Milk','Cheese'],
  'Bakery':['Croissants','Bread'],
  'Pantry':['Coffee','Pasta'],
  'Frozen':['Frozen vegetables','Ice cream'],
  'Drinks':['Water','Juice'],
  'Household':['Cleaning spray','Sponges'],
  'Toiletries':['Shampoo','Toothpaste'],
  'Pharmacy':['Bandages','Pain relief'],
  'Other':['Phone charger','Umbrella']
});

export function categoryHeroArt(categoryName){
  const name=String(categoryName||'Other');
  const products=CATEGORY_HERO_NAMES[name]||CATEGORY_HERO_NAMES.Other;
  return `<span class="category-hero-products" aria-hidden="true"><span>${productArt(products[0],name)}</span><span>${productArt(products[1],name)}</span></span>`;
}
