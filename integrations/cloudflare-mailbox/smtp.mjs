import { base64UTF8 } from './mime.mjs';

// Inject connect in tests. Production uses cloudflare:sockets with TLS from the start.
export async function mailboxSMTP(connect, credentials, message=null, timeoutMs=20000) {
  if (!credentials.user || !credentials.password || /[\r\n\x00]/.test(credentials.user+credentials.password)) throw new Error('SMTP credentials missing or invalid.');
  const socket=connect({hostname:'smtp.mailbox.org',port:465},{secureTransport:'on'});
  socket.closed.catch(()=>{});
  const reader=socket.readable.getReader(), writer=socket.writable.getWriter();
  const decoder=new TextDecoder(), encoder=new TextEncoder();
  let buffer='',timer,accepted=false;
  const write=value=>writer.write(encoder.encode(value+'\r\n'));
  async function reply() {
    const lines=[];let length=0,code;
    while(true) {
      let end;
      while((end=buffer.indexOf('\r\n'))<0) {
        const chunk=await reader.read();
        if(chunk.done)throw new Error('SMTP connection closed.');
        buffer+=decoder.decode(chunk.value,{stream:true});
        if(buffer.length>16384)throw new Error('SMTP reply too large.');
      }
      const line=buffer.slice(0,end);buffer=buffer.slice(end+2);length+=line.length;
      const match=/^(\d{3})([ -])(.*)$/.exec(line);
      if(!match || length>16384 || (code && code!==Number(match[1])))throw new Error('Invalid SMTP reply.');
      code=Number(match[1]);lines.push(match[3]);
      if(match[2]===' ')return {code,lines};
    }
  }
  async function expect(codes) {
    const result=await reply();
    if(!codes.includes(result.code))throw Object.assign(new Error('SMTP command rejected.'),{responseCode:result.code});
    return result;
  }
  async function command(value,codes) {await write(value);return expect(codes);}
  const run=async()=>{
    await socket.opened;await expect([220]);
    const hello=await command('EHLO tournstack.com',[250]);
    const auth=hello.lines.filter(line=>/^AUTH(?:\s|=)/i.test(line)).join(' ');
    if(/\bPLAIN\b/i.test(auth)) {
      const value=base64UTF8('\x00'+credentials.user+'\x00'+credentials.password);
      const result=await command('AUTH PLAIN '+value,[235,334]);
      if(result.code===334)await command(value,[235]);
    } else if(/\bLOGIN\b/i.test(auth)) {
      await command('AUTH LOGIN',[334]);await command(base64UTF8(credentials.user),[334]);
      await command(base64UTF8(credentials.password),[235]);
    } else throw Object.assign(new Error('SMTP server has no supported authentication method.'),{responseCode:502});
    if(message) {
      // Envelope destinations originate only in validated fixed templates.
      if(message.from!=='info@tournstack.com' || /[\r\n<>\x00]/.test(message.to))throw new Error('Invalid SMTP envelope.');
      await command(`MAIL FROM:<${message.from}>`,[250]);
      await command(`RCPT TO:<${message.to}>`,[250,251]);await command('DATA',[354]);
      await writer.write(encoder.encode(message.raw.replace(/(^|\r\n)\./g,'$1..')+'.\r\n'));
      await expect([250]);accepted=true; // SMTP acceptance, not proof of inbox delivery.
    }
    // Once DATA is accepted, a lost QUIT reply must not trigger a duplicate send.
    try {await command('QUIT',[221]);}catch{}
    return {accepted:true};
  };
  try {
    return await Promise.race([run(),new Promise((resolve,reject)=>{
      timer=setTimeout(()=>accepted?resolve({accepted:true}):reject(new Error('SMTP timeout.')),timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);await socket.close().catch(()=>{});
    try{reader.releaseLock();writer.releaseLock();}catch{}
  }
}
