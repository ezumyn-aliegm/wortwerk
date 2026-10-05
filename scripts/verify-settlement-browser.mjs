const assert = {
  equal(actual,expected,message='Values differ') { if(actual!==expected) throw new Error(`${message}: ${actual} !== ${expected}`); },
  deepEqual(actual,expected,message='Values differ') { this.equal(JSON.stringify(actual),JSON.stringify(expected),message); },
};

export async function verifySettlement(page) {
  const origin='http://127.0.0.1:4197';
  const output='output/playwright/settlement';
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${origin}/settlement-preview.html?percent=100`);
  await page.getByRole('heading',{name:'A place that grows with you.'}).waitFor();
  const before=await page.evaluate(()=>JSON.stringify(window.__fixtureLibrary));
  await page.getByLabel('Future world preview').selectOption('10');
  assert.equal(await page.locator('.settlement-site').count(),12);
  assert.equal(await page.locator('.settlement-site .landmark-sprite').count(),9);
  await page.locator('.settlement-scene').screenshot({path:`${output}/connected-complete-future.png`});
  await page.getByRole('button',{name:'Harvest farm. Planning preview, no lesson'}).click();
  assert.equal(await page.locator('.settlement-inspector button').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__fixtureLibrary)),before);
  await page.getByText('Preview real bakery construction', {exact:false}).click();
  const results=[];
  for(const [percent,level] of [[0,0],[4,1],[20,1],[40,2],[60,3],[80,4],[100,5]]) {
    await page.locator('.construction-demo input').press('Home');
    for(let i=0;i<percent/4;i++) await page.locator('.construction-demo input').press('ArrowRight');
    await page.locator(`.construction-demo [data-construction-stage="${level}"]`).waitFor();
    assert.equal(await page.locator('.construction-demo [data-construction-stage]').getAttribute('data-construction-stage'),String(level));
    await page.locator('.construction-demo').screenshot({path:`${output}/bakery-${percent}.png`});
    results.push({percent,level});
  }
  await page.locator('.construction-stage-strip').screenshot({path:`${output}/bakery-stages.png`});
  await page.goto(`${origin}/settlement-preview.html?percent=100&high=100&repair`);
  await page.getByRole('heading',{name:'A place that grows with you.'}).waitFor();
  assert.equal(await page.locator('.settlement-repair').count(),1);
  assert.equal(await page.locator('.settlement-site.owned .settlement-old-building').count(),10);
  const repaired=await page.locator('.settlement-site.owned .village-building').evaluateAll(els=>els.map(el=>({current:Number(el.dataset.level),earned:Number(el.dataset.historicalLevel),opacity:el.querySelector('.village-upgrade-art').style.opacity})));
  assert.deepEqual(repaired.map(b=>b.earned),[5,5,5,5,5]);
  assert.deepEqual(repaired.map(b=>b.opacity),['1','1','1','1','1']);
  assert.equal(repaired[4].current,4);
  await page.locator('.settlement').screenshot({path:`${output}/historical-repair.png`});
  for(const width of [1280,1024,390]) {
    await page.setViewportSize({width,height:900});
    await page.getByLabel('Future world preview').selectOption('10');
    const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.equal(bounds.scroll,bounds.width,`No page overflow at ${width}`);
    await page.screenshot({path:`${output}/responsive-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${origin}/settlement-preview.html?app&correction`);
  await page.getByRole('button',{name:'Waves',exact:true}).waitFor();
  await page.getByLabel('Autumn village study close-up').waitFor();
  await page.locator('.district-focus').screenshot({path:`${output}/study-closeup-correction.png`});
  const saved=await page.evaluate(()=>structuredClone(window.__fixtureLibrary));
  const waveId=saved.selectedWaveId;
  const snapshot=JSON.stringify(saved.waves.find(w=>w.id===waveId).progress);
  const oldSnapshot=JSON.stringify(saved.waves[0].progress);
  await page.getByRole('button',{name:'Waves',exact:true}).click();
  await page.getByRole('button',{name:'Original village. Legacy rewards'}).click();
  await page.locator('.settlement-inspector').getByRole('button',{name:'Resume exact saved session'}).click();
  await page.getByRole('button',{name:'Waves',exact:true}).click();
  await page.getByRole('button',{name:/Autumn village\./}).click();
  await page.locator('.settlement-inspector').getByRole('button',{name:'Resume exact saved session'}).click();
  const resumed=await page.evaluate(id=>window.__fixtureLibrary.waves.find(w=>w.id===id).progress,waveId);
  assert.equal(JSON.stringify(resumed),snapshot,'Exact progress survives old-wave map navigation');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__fixtureLibrary.waves[0].progress)),oldSnapshot,'Older unfinished lesson also stays exact');
  assert.equal(await page.locator('#wave-correction').inputValue(),'exact unfinished correction');
  await page.screenshot({path:`${output}/exact-correction-resume.png`});
  for(const percent of [0,4,20,40,60,80,100]) {
    await page.goto(`${origin}/settlement-preview.html?percent=${percent}`);
    await page.getByRole('heading',{name:'A place that grows with you.'}).waitFor();
    const expected=percent===0 ? [0,0,0,0,0] : percent===4 ? [1,0,0,0,0] : Array(5).fill(percent/20);
    const rendered=await page.locator('.settlement-site.owned .village-building').evaluateAll(els=>els.map(el=>Number(el.dataset.level)));
    assert.deepEqual(rendered,expected);
    await page.locator('.settlement-scene').screenshot({path:`${output}/connected-current-${percent}.png`});
  }
  for(const percent of [0,4,20,40,60,80,100]) {
    await page.goto(`${origin}/settlement-preview.html?app&session&percent=${percent}`);
    if(percent===100) await page.locator('.settlement-inspector').getByRole('button',{name:'Open this lesson'}).click();
    await page.getByLabel('Autumn village study close-up').waitFor();
    const expected=percent===0 ? [0,0,0,0,0] : percent===4 ? [1,0,0,0,0] : Array(5).fill(percent/20);
    assert.deepEqual(await page.locator('.district-focus-ground .village-building').evaluateAll(els=>els.map(el=>Number(el.dataset.level))),expected,'Study district matches world');
    const focus=page.locator('.district-focus-building');
    assert.equal(await focus.locator('.village-building').getAttribute('data-level'),String(percent===100 ? 5 : Math.floor(percent/20)));
    if(percent<100) assert.equal(await focus.getByText(`Next milestone · ${percent+4}% mastery`,{exact:true}).count(),1);
    await page.locator('.district-focus').screenshot({path:`${output}/study-closeup-${percent}.png`});
  }
  for(const width of [1280,1024,390]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`${origin}/settlement-preview.html?app&correction&percent=40`);
    await page.getByLabel('Autumn village study close-up').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth===document.documentElement.clientWidth),true,`Study fits ${width}`);
    assert.equal(await page.locator('#wave-correction').inputValue(),'exact unfinished correction');
    await page.screenshot({path:`${output}/study-layout-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  for(const compact of [false,true]) {
    for(const percent of [0,4,20,40,60,80,100]) {
      await page.goto(`${origin}/village-preview.html?percent=${percent}${compact ? '&compact' : ''}`);
      await page.locator('.village-world').waitFor();
      const expected=percent===0 ? [0,0,0,0,0] : percent===4 ? [1,0,0,0,0] : Array(5).fill(percent/20);
      const rendered=await page.locator('.village-world .village-building').evaluateAll(els=>els.map(el=>Number(el.dataset.level)));
      assert.deepEqual(rendered,expected);
      await page.locator('.village-world').screenshot({path:`${output}/current-${compact ? 'compact' : 'full'}-${percent}.png`});
    }
  }
  assert.deepEqual(errors,[]);
  return {studyCloseupStages:[0,4,20,40,60,80,100],studyCloseupViewports:[1280,1024,390],stages:results,viewports:[1440,1280,1024,390],futurePreviewReadOnly:true,historicalArchitecturePreserved:true,exactCorrectionResume:true,olderUnfinishedLessonUnchanged:true,connectedCurrentStages:[0,4,20,40,60,80,100],historicalLevels:[5,5,5,5,5],historicalSpriteOpacity:[1,1,1,1,1],currentFullAndCompactStages:[0,4,20,40,60,80,100],surface:'isolated Chrome synthetic LibraryApp and preview fixtures',liveDataAccess:false,pageErrors:errors};
}
