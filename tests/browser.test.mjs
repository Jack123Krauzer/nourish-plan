import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root=resolve(import.meta.dirname,'..');
const server=createServer((req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(!['/sajid-maulana.html','/index.html'].includes(route)){res.writeHead(404);res.end();return}
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end(readFileSync(resolve(root,route.slice(1))));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port+'/sajid-maulana.html';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const rowCounts=[20,19,18,20,19,19,21];
try{
 for(const width of [1440,820,390]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.locator('#dayTabs button').first().waitFor();
  assert.equal(await page.locator('#dayTabs button').count(),7);
  assert.equal(await page.locator('.meal-card').count(),6);
  assert.ok((await page.locator('.hero h1').textContent()).includes('Eat better'));
  for(let i=0;i<7;i++){
   await page.locator('#dayTabs button').nth(i).click();
   assert.equal(await page.locator('.meal-card').count(),6,'Day '+(i+1)+' meal cards');
   assert.equal(await page.locator('.food-table tbody tr').count(),rowCounts[i],'Day '+(i+1)+' food rows');
   assert.equal(await page.locator('.food-table tbody .food-emoji svg').count(),rowCounts[i],'Day '+(i+1)+' SVG icons');
   assert.equal(await page.locator('.food-table tfoot tr').count(),6,'Day '+(i+1)+' total rows');
   const totals=await page.locator('.food-table').evaluateAll(tables=>tables.map(table=>{
    const rows=[...table.querySelectorAll('tbody tr')],total=table.querySelector('tfoot tr');
    return{cal:rows.reduce((n,r)=>n+Number(r.cells[3].textContent),0),pro:rows.reduce((n,r)=>n+Number.parseFloat(r.cells[4].textContent),0),totalCal:Number(total.cells[1].textContent),totalPro:Number.parseFloat(total.cells[2].textContent),span:total.cells[0].colSpan};
   }));
   totals.forEach((v,j)=>{assert.equal(v.cal,v.totalCal,'Day '+(i+1)+' meal '+(j+1)+' calories');assert.equal(v.pro,v.totalPro,'Day '+(i+1)+' meal '+(j+1)+' protein');assert.equal(v.span,3)});
   if(width===1440){
    const bounds=await page.locator('.food-table').first().evaluate(table=>{
     const h=table.querySelectorAll('thead th'),f=table.querySelectorAll('tfoot td');
     return{h4:h[3].getBoundingClientRect().right,f4:f[1].getBoundingClientRect().right,h5:h[4].getBoundingClientRect().right,f5:f[2].getBoundingClientRect().right};
    });
    assert.ok(Math.abs(bounds.h4-bounds.f4)<3,'Kcal footer alignment');
    assert.ok(Math.abs(bounds.h5-bounds.f5)<3,'Protein footer alignment');
   }
  }
  await page.locator('#dayTabs button').nth(1).click();
  const egg=page.locator('.food-table tbody tr').filter({hasText:'Boiled eggs'}).first();
  assert.equal(await egg.count(),1);
  assert.doesNotMatch(await egg.textContent(),/for cooking/i);
  assert.equal(await page.evaluate(()=>foodCategory('Boiled eggs')),'egg');
  await page.locator('.meal-check input').first().check();
  assert.equal(await page.locator('#ringCount').textContent(),'1/6');
  await page.locator('#dayTabs button').first().click();
  await page.locator('#dayTabs button').nth(1).click();
  assert.equal(await page.locator('#ringCount').textContent(),'1/6');
  page.once('dialog',d=>d.accept());
  await page.locator('#resetDay').click();
  assert.equal(await page.locator('#ringCount').textContent(),'0/6');
  const recipe=page.locator('details.recipe').first();
  await recipe.locator('summary').click();
  assert.equal(await recipe.getAttribute('open'),'');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,'Page overflow at '+width+'px: '+overflow);

  // Default Hinglish uses familiar names rather than literal Hindi translation.
  await page.locator('#dayTabs button').first().click();
  assert.equal(await page.locator('#langHinglish').getAttribute('aria-pressed'),'true');
  assert.ok((await page.locator('#mealList').textContent()).includes('Dahi'));
  assert.ok((await page.locator('#mealList').textContent()).includes('Eggs'));
  assert.ok((await page.locator('#mealList').textContent()).includes('Milk'));
  assert.doesNotMatch(await page.locator('#mealList').textContent(),/Anda/i);
  await page.locator('#langEnglish').click();
  assert.equal(await page.locator('#langEnglish').getAttribute('aria-pressed'),'true');
  assert.ok((await page.locator('#mealList').textContent()).includes('Plain curd'));
  await page.locator('#langHinglish').click();
  assert.ok((await page.locator('#mealList').textContent()).includes('Plain Dahi'));
  // A bread swap changes exactly one food row and updates the meal and daily totals.
  const originalCalories=Number((await page.locator('#plannedKcal').textContent()).replace(/[^0-9]/g,''));
  const breakfast=page.locator('.meal-card').first();
  const alternatives=breakfast.locator('details.bread-alternatives');
  assert.equal(await alternatives.count(),1);
  await alternatives.locator('summary').click();
  assert.equal(await alternatives.locator('.alt-item').count(),5);
  await alternatives.locator('.alt-item').nth(1).click();
  assert.ok((await breakfast.locator('.food-table').textContent()).includes('Roti'));
  assert.equal(Number((await page.locator('#plannedKcal').textContent()).replace(/[^0-9]/g,'')),originalCalories+3);
  await page.reload();
  assert.equal(await page.locator('#langHinglish').getAttribute('aria-pressed'),'true');
  assert.ok((await page.locator('.meal-card').first().locator('.food-table').textContent()).includes('Roti'));
  const again=page.locator('.meal-card').first().locator('details.bread-alternatives');
  await again.locator('summary').click();
  await again.locator('.alt-item').first().click();
  assert.equal(Number((await page.locator('#plannedKcal').textContent()).replace(/[^0-9]/g,'')),originalCalories);
  // Every whole-wheat bread and toast row has alternatives.
  for(let i=0;i<7;i++){
    await page.locator('#dayTabs button').nth(i).click();
    const breadRows=await page.locator('.food-table tbody tr').filter({hasText:/Whole-wheat (bread|toast)/i}).count();
    assert.equal(await page.locator('.bread-alternatives').count(),breadRows,'Day '+(i+1)+' bread alternative coverage');
  }
  // Grocery list is bilingual, includes all major weekly ingredients, and saves checkmarks.
  const grocery=page.locator('#grocerySection');
  assert.equal(await grocery.locator('.grocery-card').count(),4);
  assert.equal(await grocery.locator('.grocery-row').count(),30);
  assert.ok((await grocery.textContent()).includes('Dahi'));
  assert.ok((await grocery.textContent()).includes('Milk'));
  const firstShop=grocery.locator('.grocery-row input').first();
  await firstShop.check();
  assert.equal(await page.locator('#groceryProgress').textContent(),'1 / 30');
  await page.reload();
  assert.equal(await page.locator('#groceryProgress').textContent(),'1 / 30');
  assert.equal(await page.locator('#grocerySection .grocery-row input').first().isChecked(),true);
  await page.locator('#resetGroceries').click();
  assert.equal(await page.locator('#groceryProgress').textContent(),'0 / 30');
  await page.locator('#langEnglish').click();
  assert.ok((await grocery.textContent()).includes('Plain curd'));
  await page.reload();
  assert.equal(await page.locator('#langEnglish').getAttribute('aria-pressed'),'true');
  await page.locator('#langHinglish').click();
  // Ingredient counts and checkmarks persist independently of the language preference.
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.sidebar').evaluate(e=>getComputedStyle(e).display),'none');
  assert.deepEqual(errors,[]);
  console.log('PASS Chromium width='+width+' (7 days, icons, totals, nav, recipes, progress, print)');
  await page.close();
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
