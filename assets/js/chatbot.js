/* Cross-origin Coach Niko integration. Enable only after the production release gates pass. */
(() => {
 'use strict';
 const ENABLED=true;
 if(!ENABLED||location.protocol!=='https:'||!['tournstack.com','www.tournstack.com'].includes(location.hostname))return;
 const origin='https://tournstack-public-chat.tournstack.workers.dev';
 const frame=document.createElement('iframe');frame.id='niko-chat-frame';frame.title='Coach Niko, TournStack AI assistant';frame.src=origin+'/';frame.referrerPolicy='strict-origin';frame.setAttribute('allow','clipboard-write');frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads');frame.setAttribute('aria-label','Coach Niko chat');document.body.append(frame);
 let open=false;
 const post=type=>frame.contentWindow?.postMessage({channel:'tournstack-niko-v1',type},origin);
 const names={open:'Chatbot Opened',start:'Chatbot Conversation Started',failure:'Chatbot Answer Failed',contact:'Chatbot Contact Clicked',link:'Chatbot Link Clicked',rating:'Chatbot Rating Submitted',feedback:'Chatbot Feedback Submitted',download:'Chatbot Downloaded'};
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==origin||event.data?.channel!=='tournstack-niko-v1')return;
  const data=event.data;
  if(data.type==='state'&&typeof data.open==='boolean'){open=data.open;frame.classList.toggle('is-open',open);position();return;}
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
  const top=viewport?.offsetTop||0;frame.style.bottom=bottom+'px';frame.style.height=open?Math.max(120,Math.min(680,innerHeight-bottom-top-12))+'px':'88px';
 }
 for(const type of ['pointerdown','wheel','touchmove'])document.addEventListener(type,event=>{if(event.target!==frame)post('away');},{passive:true,capture:true});
 document.addEventListener('visibilitychange',()=>post(document.hidden?'away':'resume'));window.addEventListener('blur',()=>post('away'));window.addEventListener('focus',()=>post('resume'));
 window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
 const popup=document.getElementById('interest-prompt');if(popup){popup.addEventListener('animationend',position);popup.addEventListener('transitionend',position);new ResizeObserver(position).observe(popup);new MutationObserver(position).observe(popup,{attributes:true,attributeFilter:['hidden','class','style']});}position();
})();
