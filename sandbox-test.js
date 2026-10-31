// Deterministic headless sandbox test: runs the complete Canvas game loop in a mocked Canvas2D host.
// This validates game logic, input paths, puzzle states and rendering calls without requiring external services.
const fs = require('node:fs');
const vm = require('node:vm');
const gameCode = fs.readFileSync(__dirname + '/game.js', 'utf8');
const rafQueue = [], windowEvents = {}, canvasEvents = {};
let drawCalls = 0;
const gradient = { addColorStop(){} };
const ctx = new Proxy({
  createLinearGradient(){drawCalls++;return Object.create(gradient);}, createRadialGradient(){drawCalls++;return Object.create(gradient);},
  measureText(s){return {width:String(s).length*7};}, roundRect(){drawCalls++;}, beginPath(){drawCalls++;}, closePath(){}, fill(){}, stroke(){},
  fillRect(){drawCalls++;}, strokeRect(){drawCalls++;}, moveTo(){}, lineTo(){}, quadraticCurveTo(){}, arc(){}, ellipse(){}, save(){}, restore(){},
  translate(){}, rotate(){}, setLineDash(){}, fillText(){drawCalls++;}, clearRect(){}, rect(){}, clip(){}, bezierCurveTo(){},
}, {get(t,p){if(p in t)return t[p];return ()=>{};},set(t,p,v){t[p]=v;return true;}});
const canvas={width:1120,height:650,getContext:()=>ctx,addEventListener:(n,fn)=>canvasEvents[n]=fn,getBoundingClientRect:()=>({left:0,top:0,width:1120,height:650}),setPointerCapture(){}};
const sound={addEventListener(){},textContent:''}, local={};
const sandbox={
  console,Math,JSON,Number,String,Object,Array,URLSearchParams,
  document:{getElementById:id=>id==='game'?canvas:sound},
  window:{addEventListener:(n,fn)=>windowEvents[n]=fn,AudioContext:null,webkitAudioContext:null},
  location:{search:'?test=1'},
  localStorage:{getItem:k=>local[k]??null,setItem:(k,v)=>{local[k]=String(v);}},
  requestAnimationFrame:cb=>{rafQueue.push(cb);return rafQueue.length;},setTimeout,clearTimeout
};
vm.createContext(sandbox);vm.runInContext(gameCode,sandbox,{filename:'game.js'});
const game=sandbox.window.__SHADOW_TEST__;
function assert(ok,msg){if(!ok)throw new Error('FAIL: '+msg);console.log('PASS:',msg);}
function key(code,type='keydown'){windowEvents[type]({code,preventDefault(){}});}
let clock=1000; function tick(count=1){for(let i=0;i<count;i++){const cb=rafQueue.shift();if(cb)cb(clock+=17);}}
function drag(x1,y1,x2,y2){canvasEvents.pointerdown({clientX:x1,clientY:y1,pointerId:1});canvasEvents.pointermove({clientX:x2,clientY:y2,pointerId:1});canvasEvents.pointerup({pointerId:1});}
function current(){return game.state();}

// Initial title and tutorial navigation.
tick(1);assert(drawCalls>20,'Title screen renders through Canvas2D');
key('Enter');assert(current().state==='tutorial','Starting a new game opens the field-notes tutorial');
for(let i=0;i<4;i++)key('Enter');
assert(current().state==='playing'&&current().levelIndex===0,'Tutorial leads into the first playable chamber');
tick(2);assert(drawCalls>100,'The first chamber and its lighting render without runtime exceptions');

// The first puzzle can be solved using the actual pointer-drag input route.
let s=current();const firstLamp=s.lamps[0];drag(firstLamp.x,firstLamp.y,300,firstLamp.y);s=current();
assert(Math.abs(s.lamps[0].x-300)<2,'Dragging the lantern changes its world position');
assert(s.ready,'The Gallery shadow aligns only after the lantern is repositioned');
// Exit remains inaccessible until solved, then a grounded player can complete it.
game.start(0);game.teleport(1010,478);tick(1);
assert(current().state==='playing','The sealed exit rejects an unsolved chamber');
game.moveLamp('galleryLamp',300);game.teleport(1010,478);tick(1);
assert(current().state==='complete','The Gallery exit opens after the shadow puzzle is solved');

// The vault needs both separate lights: one adjustment alone is insufficient.
game.start(1);s=current();assert(!s.ready,'The Twin-Lantern Vault begins unsolved');
const lampA=s.lamps[0];drag(lampA.x,lampA.y,200,lampA.y);assert(!current().ready,'One correctly moved lantern does not solve the two-light puzzle');
const lampB=current().lamps[1];drag(lampB.x,lampB.y,685,lampB.y);assert(current().ready,'Both independent shadows must be aligned');
// Verify the player can finish the second chamber.
game.teleport(1010,478);tick(1);assert(current().state==='complete','The Vault exit is reachable after both shadows align');

// The Observatory combines two positions with an orientation change.
game.start(2);assert(!current().ready,'The Observatory begins with its seal unsolved');
game.moveLamp('lowLamp',220);assert(!current().ready,'The first Observatory shadow can be aligned independently');
game.moveLamp('highLamp',550);assert(!current().ready,'A narrow shadow cannot satisfy the final seal');
// Actual select + Q/E key input rotates the long sculpture.
canvasEvents.pointerdown({clientX:640,clientY:215,pointerId:2});canvasEvents.pointerup({pointerId:2});
for(let i=0;i<6;i++)key('KeyE');
assert(current().ready,'Selecting and rotating the tall idol broadens the shadow and opens the final seal');
game.teleport(1010,478);tick(1);assert(current().state==='complete','The final chamber exit is reachable after the combined puzzle');
key('Enter');assert(current().state==='ending','Completing all three chambers reaches the ending');
tick(2);assert(drawCalls>250,'The ending screen also renders without runtime exceptions');
console.log('\nALL SANDBOX CHECKS PASSED. Canvas draw calls:',drawCalls);

// Physical traversal smoke test: move and jump across every chamber using only the normal keyboard inputs.
function hold(code,frames){key(code,'keydown');tick(frames);key(code,'keyup');}
function jumpRight(frames){key('KeyD','keydown');key('Space','keydown');key('Space','keyup');tick(frames);key('KeyD','keyup');}
game.start(0);game.moveLamp('galleryLamp',300);tick(2);
hold('KeyD',46);s=current();console.log('Route L1 edge',s.player);
jumpRight(35);s=current();console.log('Route L1 shadow landing',s.player);
assert(s.player.onGround && Math.abs(s.player.y+42-420)<3,'Player can physically land on the Gallery shadow');
hold('KeyD',15);jumpRight(50);tick(7);s=current();console.log('Route L1 stone landing',s.player);
assert(s.player.onGround,'Player can jump from the Gallery shadow to the stone step');
hold('KeyD',5);jumpRight(55);tick(3);s=current();console.log('Route L1 far platform landing',s.player);
assert(s.player.onGround,'Player can jump from the stone step to the far floor');
hold('KeyD',50);s=current();assert(s.state==='complete','Normal movement reaches the Gallery exit');
console.log('Physical traversal test completed (level 1).');

// Physical traversal of the two more complex levels (normal movement and jumps, not teleports).
game.start(1);game.moveLamp('amberLamp',200);game.moveLamp('blueLamp',685);tick(2);
hold('KeyD',17);jumpRight(38);s=current();console.log('Route L2 first shadow',s.player);assert(s.player.onGround&&Math.abs(s.player.y+42-430)<3,'Vault first shadow is physically reachable');
hold('KeyD',17);jumpRight(55);tick(2);s=current();console.log('Route L2 stone',s.player);assert(s.player.onGround&&s.player.y+42===465,'Vault middle stone is physically reachable');
hold('KeyD',2);jumpRight(43);tick(1);s=current();console.log('Route L2 second shadow',s.player);assert(s.player.onGround&&Math.abs(s.player.y+42-410)<3,'Vault second shadow is physically reachable');
hold('KeyD',19);jumpRight(60);tick(2);s=current();console.log('Route L2 exit floor',s.player);assert(s.player.onGround,'Vault final floor is physically reachable');
hold('KeyD',12);assert(current().state==='complete','Normal movement reaches the Twin-Lantern Vault exit');

game.start(2);game.moveLamp('lowLamp',220);game.moveLamp('highLamp',550);game.rotateCaster('longIdol',6);tick(2);
hold('KeyD',20);jumpRight(38);s=current();console.log('Route L3 first shadow',s.player);assert(s.player.onGround&&Math.abs(s.player.y+42-430)<3,'Observatory first shadow is physically reachable');
hold('KeyD',13);jumpRight(55);tick(2);s=current();console.log('Route L3 stone',s.player);assert(s.player.onGround&&s.player.y+42===470,'Observatory stone is physically reachable');
jumpRight(40);tick(2);s=current();console.log('Route L3 broad shadow',s.player);assert(s.player.onGround&&Math.abs(s.player.y+42-390)<3,'Rotated broad shadow is physically reachable');
hold('KeyD',20);jumpRight(61);tick(2);s=current();console.log('Route L3 last floor',s.player);assert(s.player.onGround,'Observatory final floor is physically reachable');
hold('KeyD',15);assert(current().state==='complete','Normal movement reaches the Observatory exit');
console.log('All three chamber platforming routes passed.');
