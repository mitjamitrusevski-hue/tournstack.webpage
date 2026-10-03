export const retention=30*86400000;
export function reject(status) {return Object.assign(new Error('Request rejected.'),{status});}
export function validateContact(value) {
  const keys=['SubmissionId','Name','Email','Inquiry'];
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k)) || keys.some(k=>typeof value[k]!=='string'))throw reject(400);
  const c=Object.fromEntries(keys.map(k=>[k,value[k].trim()]));
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(c.SubmissionId) || !c.Name || c.Name.length>100 || /[\r\n\x00]/.test(c.Name) ||
    c.Email.length>254 || !/^[\x21-\x7e]+$/.test(c.Email) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.Email) ||
    !c.Inquiry || c.Inquiry.length>5000 || c.Inquiry.includes('\x00'))throw reject(400);
  return c;
}
export function queueStore(sql,transaction,{now=Date.now,maxContacts=100,maxConfirmations=3}={}) {
  const run=(q,...args)=>sql.exec(q,...args).toArray();
  run('CREATE TABLE IF NOT EXISTS contacts(id TEXT PRIMARY KEY,hash TEXT NOT NULL,email TEXT NOT NULL,created INTEGER NOT NULL)');
  run("CREATE TABLE IF NOT EXISTS jobs(id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,due INTEGER NOT NULL,PRIMARY KEY(id,kind))");
  run('CREATE INDEX IF NOT EXISTS contacts_created ON contacts(created)');
  run('CREATE INDEX IF NOT EXISTS jobs_due ON jobs(state,due)');
  return {
    enqueue(contact,hash) {
      return transaction(()=>{
        const time=now(),old=run('SELECT hash FROM contacts WHERE id=?',contact.SubmissionId)[0];
        if(old){if(old.hash!==hash)throw reject(409);return;}
        if(run('SELECT COUNT(*) AS n FROM contacts WHERE created>?',time-86400000)[0].n>=maxContacts)throw reject(429);
        const count=run('SELECT COUNT(*) AS n FROM contacts WHERE email=? AND created>?',contact.Email.toLowerCase(),time-86400000)[0].n;
        run('INSERT INTO contacts VALUES(?,?,?,?)',contact.SubmissionId,hash,contact.Email.toLowerCase(),time);
        run('INSERT INTO jobs(id,kind,payload,due) VALUES(?,?,?,?)',contact.SubmissionId,'notification',JSON.stringify(contact),time);
        if(count<maxConfirmations)run('INSERT INTO jobs(id,kind,payload,due) VALUES(?,?,?,?)',contact.SubmissionId,'confirmation',JSON.stringify(contact),time);
      });
    },
    claim() {
      return transaction(()=>{
        const job=run("SELECT * FROM jobs WHERE state IN ('pending','sending') AND due<=? ORDER BY due LIMIT 1",now())[0];
        if(!job)return null;
        run("UPDATE jobs SET state='sending',attempts=attempts+1,due=? WHERE id=? AND kind=?",now()+45000,job.id,job.kind);
        return {...job,attempts:job.attempts+1};
      });
    },
    success(job){run("UPDATE jobs SET state='sent',payload='' WHERE id=? AND kind=?",job.id,job.kind);},
    failure(job,error){
      const state=Number(error.responseCode)>=500 || job.attempts>=5?'failed':'pending';
      run('UPDATE jobs SET state=?,due=? WHERE id=? AND kind=?',state,now()+Math.min(3600000,30000*2**(job.attempts-1)),job.id,job.kind);
      return state;
    },
    nextAlarm(){
      const next=run("SELECT MIN(due) AS due FROM jobs WHERE state IN ('pending','sending')")[0].due;
      const expires=run('SELECT MIN(created) AS created FROM contacts')[0].created;
      const choices=[next,expires===null?null:expires+retention+1].filter(v=>v!==null);
      return choices.length?Math.max(now()+1000,Math.min(...choices)):null;
    },
    purge(){transaction(()=>{
      run('DELETE FROM jobs WHERE id IN(SELECT id FROM contacts WHERE created<?)',now()-retention);
      run('DELETE FROM contacts WHERE created<?',now()-retention);
    });},
    stats(){return Object.fromEntries(run('SELECT state,COUNT(*) AS n FROM jobs GROUP BY state').map(r=>[r.state,r.n]));}
  };
}
