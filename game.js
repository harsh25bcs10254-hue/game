(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 1120, H = 650;
  const soundButton = document.getElementById('soundToggle');
  let soundOn = true, audioCtx = null;
  let state = 'menu', levelIndex = 0, selectedMenu = 0, tutorialPage = 0;
  let lastTime = 0, elapsed = 0, toast = '', toastTimer = 0, hintVisible = false, hintTimer = 0;
  let activeDrag = null, selectedObject = null, pointer = {x:0,y:0,down:false};
  let keys = Object.create(null), particles = [], stars = [], savedBest = 0, seenTutorial = false;
  try { savedBest = Number(localStorage.getItem('shadowArchitectBest') || 0); seenTutorial = localStorage.getItem('shadowArchitectNotes') === 'yes'; } catch (_) {}

  const levelDefs = [
    {
      name: 'THE GALLERY OF FIRST LIGHT', subtitle: 'A room remembers every light that touched it.',
      start: {x:78,y:478}, goalX: 1030, goalLabel: 'THE OPEN DOOR',
      platforms: [
        {x:0,y:520,w:300,h:130,type:'floor'}, {x:560,y:465,w:110,h:185,type:'stone'}, {x:750,y:520,w:370,h:130,type:'floor'}
      ],
      casters: [ {id:'monolith',x:340,y:240,w:66,h:50,rot:0,shape:'monolith',rotatable:false, movable:false, color:'#9a8b78'} ],
      lamps: [ {id:'galleryLamp',x:130,y:95,min:75,max:355,color:'#f3c77f',label:'FIRST LANTERN'} ],
      shadows: [ {caster:'monolith',lamp:'galleryLamp',y:420,kind:'bridge',target:{min:365,max:485}} ],
      clue: 'A faded mural shows a figure crossing where the floor is missing. The lantern has a long rail; the stone does not.',
      fieldNote: 'The dark shape is not painted on the floor. It is made by something standing between a light and a surface.',
      ready: s => s.length>0 && s[0].x > 355 && s[0].x < 460,
      landmark: 'The first shadow should touch the broken gallery floor.',
      secret: {x:890,y:420,text:'A charcoal sketch: “The dark is only the light, arriving late.”'}
    },
    {
      name: 'THE TWIN-LANTERN VAULT', subtitle: 'Two lights. Two silhouettes. One continuous crossing.',
      start: {x:65,y:478}, goalX: 1030, goalLabel: 'THE SEALED ARCH',
      platforms: [
        {x:0,y:520,w:170,h:130,type:'floor'}, {x:465,y:465,w:100,h:185,type:'stone'}, {x:950,y:520,w:170,h:130,type:'floor'}
      ],
      casters: [
        {id:'spireA',x:230,y:240,w:60,h:50,rot:0,shape:'spire',rotatable:false,movable:false,color:'#8493a2'},
        {id:'spireB',x:680,y:220,w:75,h:55,rot:0,shape:'spire',rotatable:false,movable:false,color:'#9d8a77'}
      ],
      lamps: [
        {id:'amberLamp',x:80,y:90,min:65,max:250,color:'#f0bd75',label:'AMBER LANTERN'},
        {id:'blueLamp',x:600,y:80,min:550,max:755,color:'#8db9ed',label:'BLUE LANTERN'}
      ],
      shadows: [
        {caster:'spireA',lamp:'amberLamp',y:430,kind:'bridge',target:{min:250,max:370}},
        {caster:'spireB',lamp:'blueLamp',y:410,kind:'bridge',target:{min:665,max:805}}
      ],
      clue: 'The two faded floor mosaics repeat the same broken pattern. Each lantern answers to a different stone silhouette.',
      fieldNote: 'A shadow belongs to the object that blocks the beam. Moving one lantern will not change the other silhouette.',
      ready: s => s.length===2 && s[0].center>290 && s[0].center<365 && s[1].center>710 && s[1].center<770,
      landmark: 'Both pools of darkness must find the broken places in the old mosaic.',
      secret: {x:840,y:380,text:'The vault ledger: “We lit two lamps so the night would have somewhere to stand.”'}
    },
    {
      name: 'THE OBSERVATORY OF SILENCE', subtitle: 'A shape can change more than a position.',
      start: {x:62,y:478}, goalX: 1030, goalLabel: 'THE LAST THRESHOLD',
      platforms: [
        {x:0,y:520,w:220,h:130,type:'floor'}, {x:450,y:470,w:90,h:180,type:'stone'}, {x:900,y:520,w:220,h:130,type:'floor'}
      ],
      casters: [
        {id:'smallIdol',x:250,y:235,w:50,h:55,rot:0,shape:'monolith',rotatable:false,movable:false,color:'#a9987e'},
        {id:'longIdol',x:620,y:170,w:40,h:90,rot:0,shape:'obelisk',rotatable:true,movable:false,color:'#7f9caa'}
      ],
      lamps: [
        {id:'lowLamp',x:80,y:85,min:55,max:270,color:'#f0bc77',label:'LOW LANTERN'},
        {id:'highLamp',x:420,y:70,min:390,max:650,color:'#a6c9ee',label:'HIGH LANTERN'}
      ],
      shadows: [
        {caster:'smallIdol',lamp:'lowLamp',y:430,kind:'bridge',target:{min:260,max:375}},
        {caster:'longIdol',lamp:'highLamp',y:390,kind:'bridge',target:{min:625,max:790}}
      ],
      clue: 'A carved figure is narrow in one view and broad in another. The final doorway bears the outline of a long, horizontal shadow.',
      fieldNote: 'The observatory was built for silhouettes, not statues. Try looking at the tall idol from another orientation.',
      ready: s => s.length===2 && s[0].center>290 && s[0].center<385 && s[1].center>690 && s[1].center<755 && s[1].w>126,
      landmark: 'The last seal listens for a broad shadow across the upper stone.',
      secret: {x:815,y:330,text:'A note in the astrolabe: “We feared the dark, until it held us up.”'}
    }
  ];

  let level = null, player = null, levelShadows = [], checkpoint = null, secretFound = false, levelDeaths = 0, levelStartedAt = 0;

  function beep(freq=440, duration=.08, type='sine', volume=.035) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type=type; o.frequency.setValueAtTime(freq,audioCtx.currentTime);
      g.gain.setValueAtTime(volume,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);
    } catch (_) {}
  }
  soundButton.addEventListener('click', () => { soundOn=!soundOn; soundButton.textContent=soundOn?'♪ SOUND ON':'♪ SOUND OFF'; if(soundOn) beep(660,.07); });

  function rounded(x,y,w,h,r,fill,stroke,line=1) {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
  }
  function text(str,x,y,size=16,color='#f0e8d9',align='left',font='Georgia') {
    ctx.fillStyle=color;ctx.font=`${size}px ${font}`;ctx.textAlign=align;ctx.fillText(str,x,y);
  }
  function wrapText(str,x,y,maxWidth,lineHeight,size=15,color='#c6c5c3',font='Georgia') {
    ctx.fillStyle=color;ctx.font=`${size}px ${font}`;ctx.textAlign='left';
    const words=str.split(' ');let line='',yy=y;
    for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,yy);line=word;yy+=lineHeight;}else line=test;}
    if(line)ctx.fillText(line,x,yy);return yy;
  }
  function addParticles(x,y,count,color) {
    for(let i=0;i<count;i++) particles.push({x,y,vx:(Math.random()-.5)*90,vy:(Math.random()-.8)*90,life:.45+Math.random()*.65,max:.9,size:1+Math.random()*3,color});
  }
  function loadLevel(index, showNote=true) {
    levelIndex=index; const d=levelDefs[index];
    level=JSON.parse(JSON.stringify(d)); level.ready=d.ready;
    // Functions are restored from the definitions after the JSON clone.
    level.ready=d.ready;
    player={x:d.start.x,y:d.start.y,w:26,h:42,vx:0,vy:0,onGround:false,face:1,anim:0};
    levelShadows=[]; checkpoint={x:d.start.x,y:d.start.y}; secretFound=false; levelDeaths=0; selectedObject=null; activeDrag=null;
    levelStartedAt=elapsed; hintVisible=false; toast=''; toastTimer=0;
    if(showNote){toast=d.subtitle;toastTimer=3.1;}
    state='playing'; beep(460,.12,'triangle',.025);
    computeShadows();
  }
  function resetLevel() {
    player.x=checkpoint.x;player.y=checkpoint.y;player.vx=0;player.vy=0;player.onGround=false;levelDeaths++;
    activeDrag=null;selectedObject=null;toast='The room settles. Try another arrangement.';toastTimer=2.2;
    beep(180,.18,'sawtooth',.025);
  }
  function computeShadows() {
    levelShadows=[];
    for(const spec of level.shadows){
      const caster=level.casters.find(o=>o.id===spec.caster), lamp=level.lamps.find(o=>o.id===spec.lamp);
      if(!caster||!lamp)continue;
      const bottom=caster.y+caster.h;
      if(lamp.y>=bottom-5)continue;
      const t=(spec.y-lamp.y)/(bottom-lamp.y);
      const rad=caster.rot||0;
      const effectiveW=Math.abs(Math.cos(rad))*caster.w+Math.abs(Math.sin(rad))*caster.h;
      const width=Math.max(24,effectiveW*t);
      const center=lamp.x+(caster.x+caster.w/2-lamp.x)*t;
      levelShadows.push({id:spec.caster+'-shadow',x:center-width/2,y:spec.y,w:width,h:16,center,kind:spec.kind,target:spec.target,source:spec.lamp,caster:spec.caster});
    }
  }
  function puzzleReady(){ computeShadows(); return !!level.ready(levelShadows); }
  function allPlatforms(){
    computeShadows();
    return [...level.platforms,...levelShadows.filter(s=>s.w>=36).map(s=>({x:s.x,y:s.y,w:s.w,h:s.h,type:'shadow',id:s.id}))];
  }
  function startGame(){
    if(!seenTutorial){state='tutorial';tutorialPage=0;}else loadLevel(Math.min(savedBest,2),true);
  }
  function finishTutorial(){
    seenTutorial=true;try{localStorage.setItem('shadowArchitectNotes','yes');}catch(_){}
    loadLevel(0,true);
  }
  function nextLevel(){
    if(levelIndex<2){
      savedBest=Math.max(savedBest,levelIndex+1);try{localStorage.setItem('shadowArchitectBest',String(savedBest));}catch(_){}
      loadLevel(levelIndex+1,true);
    } else {
      savedBest=3;try{localStorage.setItem('shadowArchitectBest','3');}catch(_){}
      state='ending';beep(740,.22,'sine',.04);addParticles(560,260,65,'#e9c88e');
    }
  }
  function drawBackground(seed=0){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#151d31');g.addColorStop(.52,'#202b40');g.addColorStop(1,'#111827');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // Distant vault arches.
    for(let i=0;i<7;i++){
      const x=-40+i*190;const h=235+(i%3)*32;
      ctx.strokeStyle=`rgba(130,153,178,${.07+(i%2)*.025})`;ctx.lineWidth=18;
      ctx.beginPath();ctx.moveTo(x,520);ctx.lineTo(x,220+h*.15);ctx.quadraticCurveTo(x+92,120-h*.1,x+184,220+h*.15);ctx.lineTo(x+184,520);ctx.stroke();
      ctx.strokeStyle='rgba(226,202,157,.055)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+18,500);ctx.lineTo(x+18,235);ctx.quadraticCurveTo(x+92,150,x+166,235);ctx.lineTo(x+166,500);ctx.stroke();
    }
    // Mottled stone and drifting dust.
    for(let i=0;i<140;i++){
      const x=(i*173+seed*43)%W,y=(i*97+seed*71)%540;
      ctx.fillStyle=`rgba(${i%3===0?'226,196,141':'134,161,190'},${.025+(i%5)*.009})`;
      ctx.fillRect(x,y,2+(i%3),1+(i%2));
    }
    for(const s of stars){ctx.globalAlpha=s.a*(.6+.4*Math.sin(elapsed*s.speed+s.phase));ctx.fillStyle=s.color;ctx.fillRect(s.x,s.y,s.size,s.size);}
    ctx.globalAlpha=1;
    const floorG=ctx.createLinearGradient(0,500,0,650);floorG.addColorStop(0,'#31384a');floorG.addColorStop(1,'#171e2d');ctx.fillStyle=floorG;ctx.fillRect(0,500,W,150);
    ctx.strokeStyle='rgba(222,202,163,.1)';ctx.lineWidth=1;
    for(let x=0;x<W;x+=56){ctx.beginPath();ctx.moveTo(x,500);ctx.lineTo(x-25,650);ctx.stroke();}
    for(let y=520;y<650;y+=27){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // Edge vignette.
    const vg=ctx.createRadialGradient(W/2,H/2,170,W/2,H/2,760);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(4,7,13,.48)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  }
  function drawPlatform(p){
    const isShadow=p.type==='shadow';
    if(isShadow){
      const grad=ctx.createLinearGradient(0,p.y,0,p.y+24);grad.addColorStop(0,'rgba(11,17,31,.94)');grad.addColorStop(1,'rgba(38,52,75,.82)');
      rounded(p.x,p.y,p.w,p.h,5,grad,'rgba(155,190,228,.65)',1.5);
      ctx.fillStyle='rgba(187,214,243,.7)';ctx.fillRect(p.x+6,p.y+2,Math.max(0,p.w-12),2);
      for(let x=p.x+10;x<p.x+p.w-8;x+=18){ctx.fillStyle='rgba(155,187,217,.2)';ctx.fillRect(x,p.y+8,5,2);}
      ctx.fillStyle='rgba(113,159,205,.14)';ctx.fillRect(p.x+2,p.y+p.h-3,p.w-4,3);
    }else{
      const grad=ctx.createLinearGradient(0,p.y,0,p.y+p.h);grad.addColorStop(0,'#777f89');grad.addColorStop(.12,'#515b6b');grad.addColorStop(1,'#242c3b');
      rounded(p.x,p.y,p.w,p.h,5,grad,'rgba(181,181,173,.28)',1);
      ctx.fillStyle='rgba(225,213,185,.28)';ctx.fillRect(p.x+4,p.y+4,p.w-8,3);
      for(let i=0;i<Math.floor(p.w/34);i++){
        const xx=p.x+14+i*34;ctx.fillStyle='rgba(20,28,42,.18)';ctx.fillRect(xx,p.y+18,2,Math.max(12,p.h-25));
        ctx.fillStyle='rgba(224,213,184,.12)';ctx.fillRect(xx+7,p.y+28,10,2);
      }
      ctx.strokeStyle='rgba(13,20,33,.35)';ctx.beginPath();ctx.moveTo(p.x,p.y+22);ctx.lineTo(p.x+p.w,p.y+22);ctx.stroke();
    }
  }
  function drawCaster(c){
    ctx.save();const cx=c.x+c.w/2,cy=c.y+c.h/2;ctx.translate(cx,cy);ctx.rotate(c.rot||0);
    const selected=selectedObject&&selectedObject.id===c.id;
    if(c.shape==='obelisk'){
      ctx.fillStyle='rgba(5,10,18,.45)';ctx.beginPath();ctx.ellipse(0,c.h*.58,c.w*.9,8,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(-c.w*.33,c.h/2);ctx.lineTo(-c.w*.27,-c.h*.35);ctx.lineTo(0,-c.h/2);ctx.lineTo(c.w*.27,-c.h*.35);ctx.lineTo(c.w*.33,c.h/2);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(224,220,195,.42)';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='rgba(16,30,48,.55)';ctx.fillRect(-4,-c.h*.22,8,c.h*.4);
    } else if(c.shape==='spire') {
      rounded(-c.w/2,-c.h/2,c.w,c.h,6,c.color,'rgba(221,217,197,.35)',1.5);
      ctx.fillStyle='rgba(20,31,48,.32)';ctx.fillRect(-c.w*.28,-c.h*.3,c.w*.56,c.h*.6);
      ctx.strokeStyle='rgba(225,220,194,.24)';ctx.beginPath();ctx.moveTo(-c.w/2+7,-c.h/2+12);ctx.lineTo(c.w/2-7,-c.h/2+12);ctx.stroke();
    } else {
      ctx.fillStyle=c.color;ctx.beginPath();ctx.moveTo(-c.w*.45,c.h*.5);ctx.lineTo(-c.w*.45,-c.h*.28);ctx.lineTo(0,-c.h*.5);ctx.lineTo(c.w*.45,-c.h*.28);ctx.lineTo(c.w*.45,c.h*.5);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(226,217,193,.42)';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='rgba(20,30,47,.36)';ctx.fillRect(-4,-c.h*.25,8,c.h*.5);
    }
    if(selected){ctx.strokeStyle='rgba(236,201,135,.85)';ctx.lineWidth=1.5;ctx.setLineDash([4,5]);ctx.strokeRect(-c.w/2-8,-c.h/2-8,c.w+16,c.h+16);ctx.setLineDash([]);}
    ctx.restore();
    if(c.rotatable){text('Q / E',cx, c.y-14,11,'#e9d09e','center','ui-monospace, monospace');}
  }
  function drawLamp(l){
    const r=19;ctx.save();
    const glow=ctx.createRadialGradient(l.x,l.y,2,l.x,l.y,90);glow.addColorStop(0,l.color+'66');glow.addColorStop(1,l.color+'00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(l.x,l.y,90,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(190,203,218,.24)';ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(l.min,l.y);ctx.lineTo(l.max,l.y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#313a4c';ctx.beginPath();ctx.moveTo(l.x-11,l.y+18);ctx.lineTo(l.x+11,l.y+18);ctx.lineTo(l.x+8,l.y+29);ctx.lineTo(l.x-8,l.y+29);ctx.closePath();ctx.fill();
    ctx.fillStyle=l.color;ctx.beginPath();ctx.arc(l.x,l.y,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,244,217,.85)';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.68)';ctx.beginPath();ctx.arc(l.x-5,l.y-6,4,0,Math.PI*2);ctx.fill();
    if(selectedObject&&selectedObject.id===l.id){ctx.strokeStyle='#f6d99f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(l.x,l.y,27,0,Math.PI*2);ctx.stroke();}
    text(l.label,l.x,l.y+45,9,'#c5cbd5','center','ui-monospace, monospace');
    ctx.restore();
  }
  function drawShadows(){
    computeShadows();
    for(const s of levelShadows){
      const c=level.casters.find(o=>o.id===s.caster),l=level.lamps.find(o=>o.id===s.source);
      if(!c||!l)continue;
      // The visible projection connects the blocker to its actual landing surface.
      const ray=ctx.createLinearGradient(l.x,l.y,s.center,s.y);ray.addColorStop(0,'rgba(8,13,25,0)');ray.addColorStop(.5,'rgba(8,13,25,.13)');ray.addColorStop(1,'rgba(5,9,19,.44)');
      ctx.fillStyle=ray;ctx.beginPath();ctx.moveTo(c.x,c.y+c.h*.2);ctx.lineTo(c.x+c.w,c.y+c.h*.2);ctx.lineTo(s.x+s.w,s.y+3);ctx.lineTo(s.x,s.y+3);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(155,184,218,.17)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(s.x,s.y);ctx.moveTo(l.x,l.y);ctx.lineTo(s.x+s.w,s.y);ctx.stroke();
      drawPlatform({x:s.x,y:s.y,w:s.w,h:s.h,type:'shadow'});
      ctx.strokeStyle='rgba(214,226,241,.22)';ctx.beginPath();ctx.moveTo(s.x+6,s.y+s.h+4);ctx.lineTo(s.x+s.w-6,s.y+s.h+4);ctx.stroke();
    }
  }
  function drawDoor(){
    const ready=puzzleReady(),x=level.goalX;
    ctx.save();
    ctx.fillStyle='rgba(6,10,20,.35)';ctx.beginPath();ctx.ellipse(x,520,50,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ready?'rgba(104,154,185,.14)':'rgba(24,31,46,.5)';ctx.beginPath();ctx.moveTo(x-28,520);ctx.lineTo(x-28,432);ctx.quadraticCurveTo(x,378,x+28,432);ctx.lineTo(x+28,520);ctx.closePath();ctx.fill();
    ctx.strokeStyle=ready?'#d4c18f':'#667387';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-33,520);ctx.lineTo(x-33,432);ctx.quadraticCurveTo(x,370,x+33,432);ctx.lineTo(x+33,520);ctx.stroke();
    ctx.strokeStyle=ready?'rgba(245,218,160,.9)':'rgba(141,155,173,.48)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-22,518);ctx.lineTo(x-22,438);ctx.quadraticCurveTo(x,397,x+22,438);ctx.lineTo(x+22,518);ctx.stroke();
    if(ready){const glow=ctx.createRadialGradient(x,465,4,x,465,75);glow.addColorStop(0,'rgba(237,210,154,.30)');glow.addColorStop(1,'rgba(237,210,154,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,465,75,0,Math.PI*2);ctx.fill();}
    text(ready?'OPEN':'SEALED',x,550,10,ready?'#e8d4a3':'#8793a7','center','ui-monospace, monospace');
    ctx.restore();
  }
  function drawPlayer(){
    const p=player;const bob=p.onGround?Math.sin(p.anim*10)*1.6:0;
    ctx.save();ctx.translate(p.x+p.w/2,p.y+bob);
    // Shadow under the architect.
    ctx.fillStyle='rgba(3,7,13,.45)';ctx.beginPath();ctx.ellipse(0,43,15,4,0,0,Math.PI*2);ctx.fill();
    // Coat and boots.
    ctx.fillStyle='#29374a';ctx.fillRect(-9,13,18,20);ctx.fillStyle='#8e6f54';ctx.fillRect(-8,31,7,9);ctx.fillRect(2,31,7,9);
    ctx.fillStyle='#c28c62';ctx.fillRect(-10,7,20,12);ctx.fillStyle='#e0b98b';ctx.fillRect(-8,-5,16,15);
    ctx.fillStyle='#172236';ctx.fillRect(-9,-7,18,6);ctx.fillRect(-8,-2,3,5);ctx.fillRect(5,-2,3,5);
    ctx.fillStyle='#d8c7aa';ctx.fillRect(p.face>0?2:-6,1,4,2);
    ctx.fillStyle='#637f96';ctx.fillRect(-13,14,4,18);ctx.fillRect(9,14,4,18);
    ctx.strokeStyle='rgba(240,212,165,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,14);ctx.lineTo(-17,27);ctx.stroke();
    if(!p.onGround){ctx.fillStyle='#e3c994';ctx.fillRect(-13,34,7,3);ctx.fillRect(6,34,7,3);}
    ctx.restore();
  }
  function drawClueArt(){
    // A faint environmental mural is suggestive, never a marked solution.
    ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle='#d1ba8a';ctx.lineWidth=2;
    const x=850,y=155;
    ctx.strokeRect(x,y,170,116);ctx.beginPath();ctx.arc(x+85,y+43,26,Math.PI,Math.PI*2);ctx.lineTo(x+111,y+94);ctx.lineTo(x+60,y+94);ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+15,y+99);ctx.lineTo(x+57,y+99);ctx.moveTo(x+114,y+99);ctx.lineTo(x+155,y+99);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+83,y+11);ctx.lineTo(x+83,y+35);ctx.lineTo(x+93,y+55);ctx.stroke();
    ctx.globalAlpha=.12;for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(x+30+i*28,y+21+(i%2)*12,4,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function drawEnvironmentDecor(){
    ctx.save();
    if(levelIndex===0){
      // Gallery: framed reliefs, a broken statue niche and tiny brass sconces.
      for(const [x,y,w,h] of [[78,185,116,126],[900,178,110,128]]){
        ctx.fillStyle='rgba(8,14,25,.22)';ctx.fillRect(x,y,w,h);
        ctx.strokeStyle='rgba(204,183,142,.18)';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);
        ctx.strokeStyle='rgba(204,183,142,.11)';ctx.lineWidth=1;ctx.strokeRect(x+8,y+8,w-16,h-16);
        ctx.beginPath();ctx.moveTo(x+22,y+h-22);ctx.lineTo(x+22,y+48);ctx.quadraticCurveTo(x+w/2,y+6,x+w-22,y+48);ctx.lineTo(x+w-22,y+h-22);ctx.stroke();
        ctx.beginPath();ctx.arc(x+w/2,y+53,10,0,Math.PI*2);ctx.stroke();
      }
      for(const x of [245,530,820]){
        ctx.fillStyle='rgba(186,147,91,.22)';ctx.fillRect(x,205,5,35);ctx.fillStyle='rgba(230,185,108,.4)';ctx.beginPath();ctx.arc(x+2,201,5,0,Math.PI*2);ctx.fill();
      }
    } else if(levelIndex===1){
      // Vault: great clockwork rings and suspended chains.
      for(const [x,y,r] of [[355,285,76],[850,255,105],[560,170,42]]){
        ctx.strokeStyle='rgba(170,188,202,.095)';ctx.lineWidth=9;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='rgba(220,190,139,.15)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r-12,0,Math.PI*2);ctx.stroke();
        for(let a=0;a<12;a++){
          const ang=a*Math.PI/6;ctx.beginPath();ctx.moveTo(x+Math.cos(ang)*(r-18),y+Math.sin(ang)*(r-18));ctx.lineTo(x+Math.cos(ang)*(r+4),y+Math.sin(ang)*(r+4));ctx.stroke();
        }
        ctx.fillStyle='rgba(213,190,150,.18)';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
      }
      for(let i=0;i<8;i++){
        const x=150+i*120;ctx.strokeStyle='rgba(178,190,203,.12)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,45+(i%3)*17);ctx.stroke();
        ctx.beginPath();ctx.arc(x,52+(i%3)*17,4,0,Math.PI*2);ctx.stroke();
      }
    } else {
      // Observatory: orbital paths, star chart markings and a faint astrolabe.
      for(const [x,y,r] of [[820,260,125],[370,230,82],[585,220,48]]){
        ctx.strokeStyle='rgba(170,192,218,.12)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,r,r*.48,.24,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='rgba(217,191,143,.1)';ctx.beginPath();ctx.arc(x,y,r*.7,0,Math.PI*2);ctx.stroke();
        for(let a=0;a<8;a++){
          const ang=a*Math.PI/4;ctx.fillStyle='rgba(220,205,174,.3)';ctx.fillRect(x+Math.cos(ang)*r*.82-2,y+Math.sin(ang)*r*.4-2,4,4);
        }
      }
      ctx.strokeStyle='rgba(220,195,153,.1)';ctx.beginPath();ctx.moveTo(100,160);ctx.lineTo(470,330);ctx.lineTo(760,135);ctx.lineTo(1020,310);ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(){
    drawBackground(levelIndex+1);drawEnvironmentDecor();drawClueArt();
    // Decorative wall inscriptions differ by chamber.
    ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#e1cda8';ctx.font='12px Georgia';ctx.textAlign='center';
    const inscription=levelIndex===0?'LUX UMBRA FORMAM DAT':levelIndex===1?'DUAE LUCES, UNA VIA':'FORMA MUTAT, UMBRA MANET';
    ctx.fillText(inscription,560,95);ctx.restore();
    drawDoor();
    for(const p of level.platforms)drawPlatform(p);
    drawShadows();
    for(const c of level.casters)drawCaster(c);
    for(const l of level.lamps)drawLamp(l);
    drawPlayer();
    // Optional memory fragment is hinted by a glimmer, not a waypoint.
    const sec=level.secret;
    if(!secretFound){const pulse=.5+.5*Math.sin(elapsed*2.2);ctx.globalAlpha=.45+pulse*.4;ctx.fillStyle='#e7d29c';ctx.beginPath();ctx.arc(sec.x,sec.y,3+pulse*2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(231,210,156,.45)';ctx.beginPath();ctx.arc(sec.x,sec.y,11+pulse*4,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;
  }
  function drawHUD(){
    rounded(22,18,410,65,8,'rgba(10,16,28,.72)','rgba(209,190,151,.2)');
    text(`CHAMBER 0${levelIndex+1}`,40,42,10,'#cfb985','left','ui-monospace, monospace');
    text(level.name,40,65,17,'#f0e7d7','left','Georgia');
    rounded(850,18,246,54,8,'rgba(10,16,28,.68)','rgba(209,190,151,.16)');
    text('SHADOWS FORMED',869,39,9,'#9eacc0','left','ui-monospace, monospace');
    const ready=puzzleReady();text(ready?'THE SEAL IS OPEN':'THE ROOM IS LISTENING',869,58,11,ready?'#e6c98d':'#a7b0bf','left','ui-monospace, monospace');
    if(selectedObject){
      const isLamp=level.lamps.some(l=>l.id===selectedObject.id);
      rounded(22,548,310,45,6,'rgba(9,14,25,.78)','rgba(223,195,143,.23)');
      text(isLamp?'LANTERN SELECTED · DRAG TO MOVE':'SCULPTURE SELECTED · Q / E ROTATE',38,575,10,'#e5cca0','left','ui-monospace, monospace');
    }
    if(hintVisible){
      rounded(342,535,755,70,8,'rgba(10,15,27,.88)','rgba(220,193,143,.36)');
      text('FIELD NOTE',362,558,10,'#e4c58d','left','ui-monospace, monospace');
      wrapText(level.clue,362,581,710,17,14,'#ddd6c8','Georgia');
    }
    if(toastTimer>0){
      const alpha=Math.min(1,toastTimer*2);ctx.globalAlpha=alpha;rounded(300,105,520,44,8,'rgba(9,14,25,.82)','rgba(216,197,161,.22)');text(toast,560,133,14,'#e5d8c1','center','Georgia');ctx.globalAlpha=1;
    }
    text('DRAG THE LIGHT · WATCH THE SHADOW',560,632,9,'rgba(189,200,213,.55)','center','ui-monospace, monospace');
  }
  function drawMenu(){
    drawBackground(4);
    // Large window/abstract shadow theatre.
    ctx.save();
    const grad=ctx.createRadialGradient(770,280,20,770,280,390);grad.addColorStop(0,'rgba(105,153,190,.22)');grad.addColorStop(1,'rgba(20,28,44,0)');ctx.fillStyle=grad;ctx.fillRect(350,0,770,600);
    ctx.strokeStyle='rgba(215,193,153,.18)';ctx.lineWidth=8;ctx.strokeRect(565,70,475,425);ctx.lineWidth=2;ctx.strokeRect(580,85,445,395);
    // Floating silhouettes in the window.
    ctx.fillStyle='rgba(5,9,18,.55)';ctx.beginPath();ctx.moveTo(650,470);ctx.lineTo(650,370);ctx.lineTo(710,310);ctx.lineTo(760,370);ctx.lineTo(760,470);ctx.fill();
    ctx.beginPath();ctx.moveTo(820,470);ctx.lineTo(820,330);ctx.lineTo(880,280);ctx.lineTo(940,330);ctx.lineTo(940,470);ctx.fill();
    ctx.strokeStyle='rgba(231,196,132,.4)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(610,450);ctx.lineTo(1000,450);ctx.stroke();
    ctx.restore();
    text('THE',82,106,15,'#d1b987','left','ui-monospace, monospace');
    text('SHADOW',78,178,62,'#f0e5d1','left','Georgia');
    text('ARCHITECT',78,240,62,'#f0e5d1','left','Georgia');
    ctx.fillStyle='#c9a46f';ctx.fillRect(82,258,336,2);
    wrapText('A room is only as solid as the light that shapes it.',84,292,370,25,20,'#c3c1bd','Georgia');
    text('A THREE-CHAMBER LIGHT & SHADOW PUZZLE',84,352,10,'#8998ad','left','ui-monospace, monospace');
    const opts=['BEGIN THE ARCHIVE','FIELD NOTES','CREDITS'];
    opts.forEach((o,i)=>{
      const y=408+i*55,sel=i===selectedMenu;
      rounded(82,y,300,40,5,sel?'rgba(205,165,103,.17)':'rgba(15,23,37,.32)',sel?'rgba(226,191,133,.72)':'rgba(210,197,170,.18)',sel?1.5:1);
      text(sel?'›':'·',103,y+26,22,sel?'#e9c991':'#728196');text(o,128,y+25,13,sel?'#f0d8ae':'#9eabbb','left','ui-monospace, monospace');
    });
    text(`BEST PROGRESS  ${Math.min(savedBest,3)} / 3`,84,603,10,'#79889d','left','ui-monospace, monospace');
    text('ENTER SELECT  ·  ↑↓ MOVE',1032,603,9,'#7f8ca0','right','ui-monospace, monospace');
  }
  function drawTutorial(){
    drawBackground(2);
    // Show a static example of a lamp/object/shadow, not a level solution.
    ctx.save();ctx.globalAlpha=.8;
    ctx.fillStyle='rgba(6,11,20,.55)';ctx.fillRect(540,140,510,355);
    ctx.strokeStyle='rgba(215,194,155,.23)';ctx.strokeRect(565,165,460,305);
    ctx.fillStyle='#f0c27c';ctx.beginPath();ctx.arc(650,250,18,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8998a8';ctx.fillRect(790,300,42,70);
    ctx.fillStyle='rgba(5,9,17,.72)';ctx.fillRect(820,405,155,16);
    ctx.strokeStyle='rgba(174,199,226,.35)';ctx.beginPath();ctx.moveTo(650,250);ctx.lineTo(790,300);ctx.lineTo(900,405);ctx.stroke();ctx.restore();
    rounded(68,75,960,500,12,'rgba(10,16,28,.9)','rgba(220,197,154,.36)',1.5);
    // A small observational vignette: a source, an occluder and the resulting shadow.
    rounded(690,175,295,245,8,'rgba(20,30,46,.62)','rgba(198,181,148,.18)',1);
    const vignetteGlow=ctx.createRadialGradient(752,255,3,752,255,100);vignetteGlow.addColorStop(0,'rgba(239,192,122,.28)');vignetteGlow.addColorStop(1,'rgba(239,192,122,0)');ctx.fillStyle=vignetteGlow;ctx.beginPath();ctx.arc(752,255,100,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#efc37e';ctx.beginPath();ctx.arc(752,255,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,239,204,.85)';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#8293a4';ctx.fillRect(820,282,43,65);ctx.strokeStyle='rgba(226,218,198,.4)';ctx.strokeRect(820,282,43,65);
    ctx.strokeStyle='rgba(231,202,153,.32)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(752,255);ctx.lineTo(820,282);ctx.lineTo(930,390);ctx.moveTo(752,255);ctx.lineTo(820,347);ctx.lineTo(930,390);ctx.stroke();
    rounded(886,386,78,13,3,'rgba(4,8,16,.88)','rgba(155,186,222,.55)',1);
    text('SOURCE',752,291,9,'#d7c7a7','center','ui-monospace, monospace');text('BLOCKER',841,367,9,'#9baabc','center','ui-monospace, monospace');text('SHADOW',925,414,9,'#b5c7dc','center','ui-monospace, monospace');
    text('FIELD NOTES · BEFORE YOU ENTER',108,123,11,'#d9bd8d','left','ui-monospace, monospace');
    const pages=[
      {title:'LIGHT LEAVES A SHAPE',body:'A lantern sends light in straight lines. When a solid object interrupts those lines, darkness stretches beyond it. In this place, a shadow can hold your weight.',foot:'OBSERVE: notice which object interrupts the beam.'},
      {title:'MOVE THE SOURCE',body:'Drag a glowing lantern to change where its shadow falls. The silhouette will move, stretch or shrink. The room will not draw a route for you.',foot:'EXPERIMENT: move a light a little, then watch what changes.'},
      {title:'TURN WHAT BLOCKS THE LIGHT',body:'Some sculptures are not fixed in meaning. Select a marked sculpture and use Q / E to rotate it. A narrow object can cast a very different shape when turned.',foot:'COMPARE: position and orientation are two different tools.'},
      {title:'TRUST THE ROOM, NOT THE MARKERS',body:'Walk with A / D or the arrow keys. Jump with Space. Reach the broken places by shaping shadows. If a path fails, return to the room and try another arrangement. R resets the chamber; H reveals a cryptic field note.',foot:'THREE CHAMBERS AWAIT. THEIR ANSWERS ARE NOT WRITTEN DOWN.'}
    ];
    const p=pages[tutorialPage];
    text(`0${tutorialPage+1} / 04`,988,123,11,'#b6a17d','right','ui-monospace, monospace');
    text(p.title,110,205,31,'#f1e7d7','left','Georgia');
    wrapText(p.body,110,256,520,32,19,'#c4c7ca','Georgia');
    ctx.strokeStyle='rgba(220,195,151,.2)';ctx.beginPath();ctx.moveTo(110,420);ctx.lineTo(985,420);ctx.stroke();
    text(p.foot,110,455,13,'#d5ba8e','left','Georgia');
    text('MOVE  A / D   ·   JUMP  SPACE   ·   DRAG  LIGHTS   ·   ROTATE  Q / E',110,513,10,'#8798ad','left','ui-monospace, monospace');
    rounded(790,530,195,32,5,'rgba(206,169,111,.16)','rgba(223,193,143,.5)');
    text(tutorialPage===3?'ENTER THE GALLERY':'CONTINUE  →',887,551,11,'#e9d0a5','center','ui-monospace, monospace');
    text('← PREVIOUS',110,551,10,tutorialPage===0?'#45536a':'#aeb9c8','left','ui-monospace, monospace');
  }
  function drawPause(){
    drawWorld();drawHUD();ctx.fillStyle='rgba(4,7,14,.72)';ctx.fillRect(0,0,W,H);
    rounded(360,180,400,290,12,'rgba(13,20,34,.96)','rgba(220,195,150,.38)',1.5);
    text('PAUSED',560,234,30,'#f0e5d2','center','Georgia');text(level.name,560,263,10,'#a8b1bf','center','ui-monospace, monospace');
    text('ENTER  RESUME',560,330,13,'#e6cc9f','center','ui-monospace, monospace');text('R  RETURN TO CHECKPOINT',560,369,12,'#a9b4c4','center','ui-monospace, monospace');text('H  FIELD NOTE',560,406,12,'#a9b4c4','center','ui-monospace, monospace');text('ESC  RETURN TO GAME',560,443,10,'#75839a','center','ui-monospace, monospace');
  }
  function drawComplete(){
    drawWorld();drawHUD();ctx.fillStyle='rgba(4,8,15,.72)';ctx.fillRect(0,0,W,H);
    rounded(315,180,490,285,12,'rgba(13,20,34,.96)','rgba(220,195,150,.4)',1.5);
    text('CHAMBER STABILIZED',560,238,27,'#f0e5d2','center','Georgia');
    text(levelIndex===0?'The first shadow holds.':levelIndex===1?'Two lights have found their rhythm.':'The observatory remembers its shape.',560,278,14,'#c7c6c0','center','Georgia');
    text('MEMORY TRACE',560,332,10,'#d9bc8b','center','ui-monospace, monospace');
    text(secretFound?'A hidden note was recovered.':'Some corners remain in darkness.',560,356,13,secretFound?'#e7d0a5':'#8e9aad','center','Georgia');
    rounded(430,390,260,42,5,'rgba(206,169,111,.16)','rgba(223,193,143,.55)');
    text(levelIndex===2?'REVEAL THE ARCHIVE ENDING':'ENTER THE NEXT CHAMBER',560,416,11,'#ebd2a7','center','ui-monospace, monospace');
  }
  function drawEnding(){
    drawBackground(8);
    const g=ctx.createRadialGradient(560,290,10,560,290,440);g.addColorStop(0,'rgba(205,174,128,.2)');g.addColorStop(1,'rgba(15,21,34,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // Final door-shaped void.
    ctx.fillStyle='rgba(4,8,16,.65)';ctx.beginPath();ctx.moveTo(420,525);ctx.lineTo(420,260);ctx.quadraticCurveTo(560,70,700,260);ctx.lineTo(700,525);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(223,194,144,.65)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(420,525);ctx.lineTo(420,260);ctx.quadraticCurveTo(560,70,700,260);ctx.lineTo(700,525);ctx.stroke();
    text('THE LIGHT WAS NEVER THE OPPOSITE OF DARKNESS',560,112,10,'#c9b38a','center','ui-monospace, monospace');
    text('THE ARCHIVE REMEMBERS',560,180,30,'#f0e6d5','center','Georgia');
    wrapText('You did not create the shadows. You gave them somewhere to belong. The old architects built this place so that every hidden shape could become a path for someone else.',560,555,640,22,15,'#c4c5c7','Georgia');
    text('THANK YOU FOR PLAYING',560,614,10,'#d8bb8d','center','ui-monospace, monospace');
    text('ENTER  RETURN TO THE TITLE',560,638,9,'#8492a7','center','ui-monospace, monospace');
  }

  function update(dt){
    elapsed+=dt;
    if(toastTimer>0)toastTimer-=dt;if(hintTimer>0){hintTimer-=dt;if(hintTimer<=0)hintVisible=false;}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=20*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
    if(state!=='playing')return;
    const left=keys.ArrowLeft||keys.KeyA,right=keys.ArrowRight||keys.KeyD;
    const dir=(right?1:0)-(left?1:0);player.vx=dir*220;if(dir)player.face=dir;player.x+=player.vx*dt;player.anim+=dt;
    player.x=Math.max(2,Math.min(W-player.w-2,player.x));
    const oldBottom=player.y+player.h;player.vy+=1320*dt;player.y+=player.vy*dt;player.onGround=false;
    const plats=allPlatforms();
    if(player.vy>=0){
      let landed=null;
      for(const p of plats){const newBottom=player.y+player.h;if(oldBottom<=p.y+7&&newBottom>=p.y&&player.x+player.w>p.x+3&&player.x<p.x+p.w-3){if(!landed||p.y<landed.y)landed=p;}}
      if(landed){player.y=landed.y-player.h;player.vy=0;player.onGround=true;if(landed.type==='shadow'&&Math.abs(oldBottom-landed.y)>38){addParticles(player.x+13,landed.y,8,'#b9cfe8');}}
    }
    if(player.y>720){resetLevel();}
    // Secret requires attention to a quiet corner, not a waypoint.
    const sec=level.secret;if(!secretFound&&Math.abs((player.x+player.w/2)-sec.x)<26&&Math.abs((player.y+player.h/2)-sec.y)<76){secretFound=true;toast='A memory fragment settles into your notebook.';toastTimer=3;addParticles(sec.x,sec.y,22,'#e9d39d');beep(740,.18,'sine',.03);}
    const ready=puzzleReady();
    if(player.x+player.w/2>level.goalX-16&&player.onGround){
      if(ready){state='complete';beep(620,.15,'triangle',.035);addParticles(level.goalX,450,24,'#e8d0a0');}
      else {player.x=level.goalX-65;toast='The threshold is still only an outline.';toastTimer=1.6;beep(220,.12,'sine',.025);}
    }
  }

  function handleKeyDown(e){
    const code=e.code;
    if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(code))e.preventDefault();
    if(state==='menu'){
      if(code==='ArrowUp'||code==='KeyW')selectedMenu=(selectedMenu+2)%3;
      if(code==='ArrowDown'||code==='KeyS')selectedMenu=(selectedMenu+1)%3;
      if(code==='Enter'||code==='Space'){
        if(selectedMenu===0)startGame();else if(selectedMenu===1){state='tutorial';tutorialPage=0;}else {state='credits';}
        beep(520,.08);
      }
      return;
    }
    if(state==='credits'){if(code==='Escape'||code==='Enter')state='menu';return;}
    if(state==='tutorial'){
      if(code==='ArrowRight'||code==='Enter'||code==='Space'){if(tutorialPage<3)tutorialPage++;else finishTutorial();beep(500,.06);}
      if(code==='ArrowLeft')tutorialPage=Math.max(0,tutorialPage-1);
      if(code==='Escape'){finishTutorial();}
      return;
    }
    if(state==='ending'){if(code==='Enter'||code==='Escape'){state='menu';selectedMenu=0;}return;}
    if(state==='complete'){if(code==='Enter'||code==='Space')nextLevel();return;}
    if(state==='pause'){
      if(code==='Escape'||code==='Enter')state='playing';
      else if(code==='KeyR')resetLevel();
      else if(code==='KeyH'){hintVisible=true;hintTimer=7;}
      return;
    }
    if(state==='playing'){
      if(code==='Escape'||code==='KeyP'){state='pause';return;}
      if(code==='KeyR'){resetLevel();return;}
      if(code==='KeyH'){hintVisible=!hintVisible;hintTimer=hintVisible?8:0;return;}
      if((code==='Space'||code==='ArrowUp'||code==='KeyW')&&player.onGround){player.vy=-550;player.onGround=false;beep(290,.07,'triangle',.02);}
      if((code==='KeyQ'||code==='KeyE')&&selectedObject&&level.casters.some(c=>c.id===selectedObject.id&&c.rotatable)){
        const c=level.casters.find(c=>c.id===selectedObject.id);c.rot+=(code==='KeyQ'?-1:1)*Math.PI/12;computeShadows();beep(360,.05,'triangle',.018);addParticles(c.x+c.w/2,c.y+c.h/2,3,'#d4c08e');
      }
      if(code==='KeyX'&&selectedObject){selectedObject=null;}
    }
    keys[code]=true;
  }
  function handleKeyUp(e){keys[e.code]=false;}
  window.addEventListener('keydown',handleKeyDown);window.addEventListener('keyup',handleKeyUp);
  function canvasPos(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  canvas.addEventListener('pointerdown',e=>{
    const p=canvasPos(e);pointer={...p,down:true};canvas.setPointerCapture(e.pointerId);
    if(state==='menu'){
      if(p.x>70&&p.x<410&&p.y>395&&p.y<565){selectedMenu=Math.max(0,Math.min(2,Math.floor((p.y-395)/55)));if(selectedMenu===0)startGame();else if(selectedMenu===1){state='tutorial';tutorialPage=0;}else state='credits';beep(500,.07);}return;
    }
    if(state==='tutorial'){
      if(p.x<250&&p.y>510){tutorialPage=Math.max(0,tutorialPage-1);}else if(p.y>500||p.x>760){if(tutorialPage<3)tutorialPage++;else finishTutorial();}return;
    }
    if(state==='complete'){if(p.y>380&&p.y<455)nextLevel();return;}
    if(state==='ending'){state='menu';return;}
    if(state!=='playing')return;
    // Grab only visible, tactile controls; the player must experiment to see the projection change.
    let closest=null,dist=Infinity;
    for(const o of [...level.lamps,...level.casters]){
      const cx=o.x+(o.w||0)/2,cy=o.y+(o.h||0)/2;const rr=o.id&&level.lamps.some(l=>l.id===o.id)?32:Math.max(o.w||30,o.h||30)*.72;
      const d=Math.hypot(p.x-cx,p.y-cy);if(d<rr&&d<dist){closest=o;dist=d;}
    }
    if(closest){selectedObject=closest;const lamp=level.lamps.some(l=>l.id===closest.id);if(lamp){activeDrag={obj:closest,type:'lamp'};beep(430,.045,'sine',.012);}else{activeDrag=null;beep(340,.045,'sine',.012);} }
  });
  canvas.addEventListener('pointermove',e=>{
    const p=canvasPos(e);pointer.x=p.x;pointer.y=p.y;
    if(activeDrag&&state==='playing'){
      const l=activeDrag.obj;l.x=Math.max(l.min,Math.min(l.max,p.x));computeShadows();
    }
  });
  function endPointer(){pointer.down=false;activeDrag=null;}
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);

  function drawCredits(){drawMenu();ctx.fillStyle='rgba(4,7,14,.72)';ctx.fillRect(0,0,W,H);rounded(260,170,600,300,12,'rgba(13,20,34,.97)','rgba(220,195,150,.38)',1.5);text('CREDITS',560,225,28,'#f0e5d2','center');text('DESIGN · CODE · ART · SOUND',560,278,11,'#d9bd8b','center','ui-monospace, monospace');text('Created as an original browser puzzle adventure.',560,318,15,'#c3c6ca','center');text('All visuals are drawn procedurally in Canvas 2D.',560,350,14,'#9daabc','center');text('No external asset packs or paid APIs.',560,380,14,'#9daabc','center');text('ENTER / ESC TO RETURN',560,425,10,'#e4c794','center','ui-monospace, monospace');}
  function frame(t){const dt=Math.min(.033,(t-lastTime)/1000||0);lastTime=t;update(dt);ctx.clearRect(0,0,W,H);
    if(state==='menu')drawMenu();else if(state==='tutorial')drawTutorial();else if(state==='playing'){drawWorld();drawHUD();}else if(state==='pause')drawPause();else if(state==='complete')drawComplete();else if(state==='ending')drawEnding();else if(state==='credits')drawCredits();
    requestAnimationFrame(frame);
  }
  for(let i=0;i<105;i++)stars.push({x:Math.random()*W,y:Math.random()*520,a:.08+Math.random()*.4,speed:.3+Math.random()*1.1,phase:Math.random()*6.28,size:Math.random()<.15?2:1,color:Math.random()<.5?'#d7c39f':'#8fb5d2'});
  requestAnimationFrame(frame);

  // Read-only test hooks are present only for automated local browser validation (?test=1).
  if(new URLSearchParams(location.search).has('test')){
    window.__SHADOW_TEST__={
      start:(idx=0)=>loadLevel(Math.max(0,Math.min(2,idx)),false),
      state:()=>({state,levelIndex,player:{...player},lamps:level?.lamps.map(l=>({...l})),casters:level?.casters.map(c=>({...c})),shadows:levelShadows.map(s=>({...s})),ready:level? puzzleReady():false,secretFound,levelDeaths}),
      moveLamp:(id,x)=>{const l=level?.lamps.find(l=>l.id===id);if(l){l.x=Math.max(l.min,Math.min(l.max,x));computeShadows();}},
      rotateCaster:(id,steps=6)=>{const c=level?.casters.find(c=>c.id===id);if(c&&c.rotatable){c.rot=steps*Math.PI/12;computeShadows();}},
      teleport:(x,y)=>{if(player){player.x=x;player.y=y;player.vx=player.vy=0;player.onGround=false;}},
      jump:()=>{if(player&&player.onGround){player.vy=-550;player.onGround=false;}},
      setState:s=>{state=s;},
      defs:levelDefs.map(d=>({name:d.name,goalX:d.goalX}))
    };
  }
})();
