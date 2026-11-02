import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(import.meta.dirname,'..');
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(!['/sajid-maulana-workout.html','/sajid-maulana.html','/index.html','/assets/workouts/tutorial-atlas.part1.txt','/assets/workouts/tutorial-atlas.part2.txt'].includes(pathname)){res.writeHead(404);res.end();return;}
 res.setHeader('content-type','text/html; charset=utf-8');res.end(readFileSync(resolve(root,pathname.slice(1))));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const names=['Full-body Foundations','Walk & mobility','Strength & Balance','Rest & recovery','Full-body Progression','Easy walking','Full rest day'];
const counts=[5,2,5,0,5,2,0];
const kinds=['strength','recovery','strength','rest','strength','recovery','rest'];
try{
 for(const width of [1440,820,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/sajid-maulana-workout.html?day=3');
  await page.locator('#dayTabs a').first().waitFor();
  assert.equal(await page.locator('#dayTabs a').count(),7);
  await page.waitForFunction(()=>tutorialArtReady,{timeout:15000});
  const validAtlas=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--tutorial-sprite').includes('data:image/webp;base64,'));
  assert.ok(validAtlas,'Generated atlas must load and decode');
  assert.equal(await page.evaluate(()=>Object.keys(TUTORIALS).length),10,'10 exercises with tutorials');

  const structure=await page.evaluate(()=>WEEK.map(key=>({id:key,name:WORKOUTS[key].en,kind:WORKOUTS[key].kind,items:WORKOUTS[key].items})));
  assert.deepEqual(structure.map(s=>s.name),names);
  assert.deepEqual(structure.map(s=>s.kind),kinds);
  assert.deepEqual(structure.map(s=>s.items.length),counts);
  assert.ok(!structure.some(s=>s.id==='A'||s.id==='B'),'Sample workouts must not be copied');
  assert.deepEqual(structure[0].items.map(x=>x.en),['Bodyweight squats','Incline push-ups','Single-arm backpack rows','Glute bridges','Forearm plank']);
  assert.deepEqual(structure[2].items.map(x=>x.en),['Reverse lunges','Backpack hip hinge','Water-bottle shoulder press','Resistance-band rows','Dead bug']);
  assert.deepEqual(structure[4].items.map(x=>x.en),['Low step-ups (stable step)','Incline or regular push-ups','Single-arm backpack rows','Hip thrust (bodyweight)','Side plank']);
  structure.flatMap(s=>s.items).forEach(x=>{
   assert.ok(x.id&&x.en&&x.hi);
   assert.ok(x.duration||(x.sets&&x.reps&&x.rest),'Missing sets/reps/rest for '+x.en);
  });
  for(let i=0;i<7;i++){
   await page.locator('#dayTabs a').nth(i).click();
   assert.equal(new URL(page.url()).searchParams.get('day'),String(i+1));
   assert.equal(await page.locator('#backToDiet').getAttribute('href'),'./sajid-maulana.html?day='+(i+1));
   assert.equal(await page.locator('#movementList .movement').count(),counts[i]||1);
   assert.equal(await page.locator('#movementList input[type=checkbox]').count(),counts[i]);
   assert.equal(await page.locator('#prepStrip').isVisible(),kinds[i]==='strength');
   // The images are displayed as three independent, text-free pose panels per illustrated exercise.
   const illustrated=structure[i].items.filter(x=>['bodyweightSquat','inclinePushup','backpackRow','gluteBridge','forearmPlank','reverseLunge','backpackHipHinge','bottleShoulderPress','bandRow','deadBug'].includes(x.id)).length;
   assert.equal(await page.locator('#movementList details.tutorial').count(),illustrated);
   if(illustrated){
    const first=page.locator('#movementList details.tutorial').first();
    await first.locator('summary').click();
    assert.equal(await first.locator('.tutorial-step').count(),3);
    assert.equal(await first.locator('.pose[role="img"]').count(),3);
    assert.equal(await first.locator('.step-description p').count(),3);
    const backgrounds=await first.locator('.pose').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundImage));
    assert.ok(backgrounds.every(bg=>bg.includes('data:image/webp;base64,')),'Separate poses must use the generated artwork');
    await first.locator('summary').click();
   }
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=1,'Horizontal overflow '+width+'px, Day '+(i+1)+': '+overflow);
  }
  await page.locator('#dayTabs a').nth(2).click();
  await page.locator('#movementList input').first().check();
  assert.equal(await page.locator('#progressCount').textContent(),'1/5');
  await page.locator('#dayTabs a').first().click();
  assert.equal(await page.locator('#progressCount').textContent(),'0/5');
  await page.locator('#dayTabs a').nth(2).click();
  assert.equal(await page.locator('#progressCount').textContent(),'1/5');
  await page.locator('#dayTabs a').first().click();
  await page.locator('#movementList details.tutorial').first().locator('summary').click();
  assert.ok((await page.locator('#movementList .step-description p').first().textContent()).includes('rakhein'));
  await page.locator('#langEnglish').click();
  await page.locator('#movementList details.tutorial').first().locator('summary').click();
  assert.ok((await page.locator('#movementList .step-description p').first().textContent()).includes('Stand'));
  await page.locator('#dayTabs a').nth(2).click();

  assert.equal(await page.locator('#langEnglish').getAttribute('aria-pressed'),'true');
  await page.reload();
  assert.equal(await page.locator('#progressCount').textContent(),'1/5');
  assert.equal(await page.locator('#langEnglish').getAttribute('aria-pressed'),'true');
  await page.locator('#resetProgress').click();
  assert.equal(await page.locator('#progressCount').textContent(),'0/5');
  await page.locator('#langHinglish').click();
  await page.locator('#backToDiet').click();
  await page.waitForURL('**/sajid-maulana.html?day=3');
  assert.match(await page.locator('#dayEyebrow').textContent(),/03 OF 07/);
  assert.equal(await page.locator('#exerciseToggle').getAttribute('href'),'./sajid-maulana-workout.html?day=3');
  await page.locator('#exerciseToggle').click();
  await page.waitForURL('**/sajid-maulana-workout.html?day=3');
  assert.equal(await page.locator('#langHinglish').getAttribute('aria-pressed'),'true');
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.sidebar').evaluate(n=>getComputedStyle(n).display),'none');
  assert.deepEqual(errors,[]);
  console.log('PASS Workout Chromium '+width+'px: seven days, personalized exercises, links, progress, language, layouts');
  await page.close();
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
