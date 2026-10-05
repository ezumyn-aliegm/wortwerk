import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('village upgrades reuse whole atlas art and distinguish earned from historical upgrades',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  try {
    const {default:VillageBuilding,villageStage}=await server.ssrLoadModule('/src/VillageBuilding.jsx');
    for(const [index,id] of ['cabin','lookout','greenhouse','library','portal'].entries()) {
      for(let level=0;level<=5;level++) {
        const html=renderToStaticMarkup(React.createElement(VillageBuilding,{id,currentLevel:level,historicalLevel:5}));
        assert.match(html,/outpost-buildings\.png/);
        assert.match(html,new RegExp(`x="${index===0 ? 0 : -index*120}"`));
        assert.match(html,/width="600" height="200"/);
        assert.equal((html.match(/class="village-upgrade-earned"/g)||[]).length,level);
        assert.equal((html.match(/class="village-upgrade-previous"/g)||[]).length,5-level);
        assert.ok(!html.includes('clipPath'));
        if(level===0) assert.match(html,/opacity:0\.12/);
        if(level===5) assert.match(html,/opacity:1;filter:saturate\(1\)/);
        assert.ok(villageStage(id,level));
      }
    }
  } finally { await server.close(); }
});
