// Memory only: customer data is never persisted to localStorage or a service worker.
export class SessionCache {
  constructor(ttl = 20_000, max = 40) { this.ttl=ttl; this.max=max; this.epoch=0; this.entries=new Map(); this.pending=new Map(); }
  clear() { this.epoch++; this.entries.clear(); this.pending.clear(); }
  async get(key, loader) {
    const hit=this.entries.get(key);
    if(hit && Date.now()-hit.at<this.ttl) return hit.value;
    if(this.pending.has(key)) return this.pending.get(key);
    const epoch=this.epoch;
    const promise=Promise.resolve().then(loader).then(value=>{
      if(epoch!==this.epoch) throw new Error('STALE_SESSION');
      if(this.entries.size>=this.max) this.entries.delete(this.entries.keys().next().value);
      this.entries.set(key,{value,at:Date.now()}); return value;
    }).finally(()=>{ if(this.pending.get(key)===promise) this.pending.delete(key); });
    this.pending.set(key,promise); return promise;
  }
}
