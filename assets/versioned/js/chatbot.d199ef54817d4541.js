/* Cross-origin Coach Niko integration. */
(() => {
 'use strict';
 const ENABLED=true;
 if(!ENABLED||location.protocol!=='https:'||!['tournstack.com','www.tournstack.com'].includes(location.hostname))return;
 const origin='https://tournstack-public-chat.tournstack.workers.dev';
 const PANEL_KEY='tournstack-niko-panel-v1',ENGAGEMENT_KEY='tournstack-niko-engagement-v1',THRESHOLD=30000;
 const paths=new Set(['/','/index.html','/vision.html','/faq.html','/contact.html','/privacy.html','/author-mitja-mitrusevski.html']);
 const pathname=location.pathname==='/index.html'?'/':location.pathname;
 let open=false;
 try{open=sessionStorage.getItem(PANEL_KEY)==='true';}catch{}
 let progress={version:1,activeMs:0,pageChanged:false,lastPath:pathname};
 try{
  const saved=JSON.parse(sessionStorage.getItem(ENGAGEMENT_KEY));
  if(saved?.version===1&&Number.isFinite(saved.activeMs)&&saved.activeMs>=0&&saved.activeMs<=THRESHOLD&&typeof saved.pageChanged==='boolean'&&paths.has(saved.lastPath))progress={version:1,activeMs:saved.activeMs,pageChanged:saved.pageChanged||saved.lastPath!==pathname,lastPath:pathname};
 }catch{}
 const saveProgress=()=>{try{sessionStorage.setItem(ENGAGEMENT_KEY,JSON.stringify(progress));}catch{}};
 const savePanel=()=>{try{sessionStorage.setItem(PANEL_KEY,String(open));}catch{}};
 const button=document.createElement('button');button.id='niko-chat-launcher';button.type='button';button.title='Ask Coach Niko';button.setAttribute('aria-label','Ask Coach Niko, TournStack AI assistant');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-controls','niko-chat-frame');
 const icon=document.createElement('img');icon.src=document.currentScript?.dataset.nikoLauncher||'/assets/brand/TS_Niko_Launcher_Shield_RGB.svg';icon.alt='';icon.width=72;icon.height=76;icon.setAttribute('aria-hidden','true');
 const status=document.createElement('span');status.id='niko-launcher-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 button.append(icon,status);button.hidden=open;document.body.append(button);
 let frame=null,started=false,frameReady=false,pendingOpen=open,watchdog,warmTimer,connectionHint=false,failed=false;
 const post=type=>{if(frameReady)frame?.contentWindow?.postMessage({channel:'tournstack-niko-v1',type},origin);};
 function connect(){
  if(connectionHint)return;connectionHint=true;
  const link=document.createElement('link');link.rel='preconnect';link.href=origin;document.head.append(link);
 }
 function failLoading(){
  if(frameReady&&!pendingOpen)return;
  failed=true;pendingOpen=false;if(frame)frame.hidden=true;button.hidden=false;button.removeAttribute('aria-busy');status.textContent=open?'Niko could not open. Select to try again.':'';
 }
 function watch(){clearTimeout(watchdog);watchdog=setTimeout(failLoading,15000);}
 function loadFrame(){
  if(started)return;started=true;clearTimeout(warmTimer);connect();
  frame=document.createElement('iframe');frame.id='niko-chat-frame';frame.title='Coach Niko, TournStack AI assistant';frame.referrerPolicy='strict-origin';frame.setAttribute('allow','clipboard-write');frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads');frame.setAttribute('aria-label','Coach Niko chat');
  frame.classList.toggle('is-open',open);frame.hidden=!open;position();frame.src=origin+'/';document.body.append(frame);watch();
 }
 function requestOpen(){
  if(pendingOpen&&started)return;
  open=true;pendingOpen=true;savePanel();button.setAttribute('aria-expanded','true');button.setAttribute('aria-busy','true');status.textContent='Opening Niko...';
  if(!started)loadFrame();
  else if(frameReady){position();post('open');watch();}
  else{position();if(failed){failed=false;frame.src=origin+'/';}watch();}
 }
 button.addEventListener('click',requestOpen);
 for(const event of ['pointerenter','focus'])button.addEventListener(event,connect,{once:true});
 const names={open:'Chatbot Opened',start:'Chatbot Conversation Started',failure:'Chatbot Answer Failed',contact:'Chatbot Contact Clicked',link:'Chatbot Link Clicked',rating:'Chatbot Rating Submitted',feedback:'Chatbot Feedback Submitted',download:'Chatbot Downloaded'};
 window.addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==origin||event.data?.channel!=='tournstack-niko-v1')return;
  const data=event.data;
  if(data.type==='state'&&typeof data.open==='boolean'){
   frameReady=true;failed=false;
   if(pendingOpen&&!data.open){post('open');return;}
   pendingOpen=false;clearTimeout(watchdog);open=data.open;savePanel();frame.classList.toggle('is-open',open);frame.hidden=false;button.hidden=true;button.removeAttribute('aria-busy');button.setAttribute('aria-expanded',String(open));status.textContent='';position();return;
  }
  if(data.type!=='analytics'||!Object.hasOwn(names,data.kind))return;
  const props={},values=data.props||{};
  if(data.kind==='rating'){if(!Number.isInteger(values.stars)||values.stars<1||values.stars>5)return;props.stars=values.stars;}
  if(data.kind==='feedback'&&['rating','comment','rating_and_comment'].includes(values.kind))props.kind=values.kind;
  if(data.kind==='link'&&['website_page','website_section','external'].includes(values.destination))props.destination=values.destination;
  try{if(typeof window.plausible==='function')window.plausible(names[data.kind],{props,url:location.origin+location.pathname});}catch{}
 });
 function position(){
  const popup=document.getElementById('interest-prompt'),viewport=window.visualViewport;
  let bottom=16+(viewport?Math.max(0,innerHeight-viewport.offsetTop-viewport.height):0);
  if(popup&&!popup.hidden){const rect=popup.getBoundingClientRect();if(rect.height&&getComputedStyle(popup).display!=='none')bottom=Math.max(bottom,innerHeight-rect.top+12);}
  button.style.bottom=(bottom+4)+'px';
  if(frame){const top=viewport?.offsetTop||0;frame.style.bottom=bottom+'px';frame.style.height=open?Math.max(120,Math.min(680,innerHeight-bottom-top-12))+'px':'88px';}
 }
 // Count foreground time only; the parent never stores chat tokens or messages.
 let running=!document.hidden&&document.hasFocus(),lastTick=performance.now();
 function tick(){const now=performance.now();if(running)progress.activeMs=Math.min(THRESHOLD,progress.activeMs+Math.max(0,now-lastTick));lastTick=now;}
 function maybeWarm(){
  clearTimeout(warmTimer);
  if(started||!running)return;
  if(progress.activeMs>=THRESHOLD){
   saveProgress();
   if(progress.pageChanged){if(document.readyState==='complete')loadFrame();else window.addEventListener('load',()=>{if(!document.hidden&&document.hasFocus())loadFrame();},{once:true});}
  }else warmTimer=setTimeout(()=>{tick();maybeWarm();},THRESHOLD-progress.activeMs);
 }
 function foreground(){tick();running=!document.hidden&&document.hasFocus();saveProgress();maybeWarm();post(running?'resume':'away');}
 document.addEventListener('visibilitychange',foreground);window.addEventListener('blur',foreground);window.addEventListener('focus',foreground);
 window.addEventListener('pagehide',()=>{tick();running=false;clearTimeout(warmTimer);saveProgress();});
 window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;
  try{const latest=JSON.parse(sessionStorage.getItem(ENGAGEMENT_KEY));if(latest?.version===1&&Number.isFinite(latest.activeMs)&&latest.activeMs>=0&&latest.activeMs<=THRESHOLD&&typeof latest.pageChanged==='boolean'&&paths.has(latest.lastPath)){progress.activeMs=Math.max(progress.activeMs,latest.activeMs);progress.pageChanged=progress.pageChanged||latest.pageChanged||latest.lastPath!==pathname;}}catch{}
  foreground();
 });
 for(const type of ['pointerdown','wheel','touchmove'])document.addEventListener(type,event=>{if(event.target!==frame)post('away');},{passive:true,capture:true});
 window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
 const popup=document.getElementById('interest-prompt');if(popup){popup.addEventListener('animationend',position);popup.addEventListener('transitionend',position);new ResizeObserver(position).observe(popup);new MutationObserver(position).observe(popup,{attributes:true,attributeFilter:['hidden','class','style']});}
 saveProgress();position();if(open)loadFrame();else maybeWarm();
})();
