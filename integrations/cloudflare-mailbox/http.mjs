const json=(status,value={})=>Response.json({ok:status>=200 && status<300,...value},{status,headers:{'Cache-Control':'no-store'}});
export async function handleRequest(request,env) {
  const token=env.MAIL_RELAY_TOKEN || '';
  if(token.length<32)return json(503);
  const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
  const [expected,actual]=await Promise.all([digest(`Bearer ${token}`),digest(request.headers.get('Authorization') || '')]);
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^actual[i];
  if(diff)return json(401);
  if(!env.CONTACT_QUEUE || !env.SMTP_USER || !env.SMTP_PASSWORD)return json(503);
  const queue=env.CONTACT_QUEUE.get(env.CONTACT_QUEUE.idFromName('tournstack-contact-mail-v1'));
  const path=new URL(request.url).pathname;
  try {
    if(request.method==='GET' && path==='/health')return json(200,{queue:await queue.stats()});
    if(request.method==='POST' && path==='/smtp-check'){await queue.verifySMTP();return json(200);}
    if(request.method!=='POST' || path!=='/contact-email')return json(404);
    if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || ''))return json(415);
    if(Number(request.headers.get('Content-Length') || 0)>32768)return json(413);
    const reader=request.body?.getReader();if(!reader)return json(400);
    const chunks=[];let length=0;
    while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;
      if(length>32768){await reader.cancel();return json(413);}chunks.push(part.value);}
    const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{return json(400);}
    const result=await queue.enqueue(value);
    return json(result.status);
  } catch {return json(503);}
}
