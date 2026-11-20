/* eslint-disable @typescript-eslint/no-explicit-any -- test harness fakes the AudioWorklet globals */
import fs from 'fs';
import { LevelHistory } from '../src/audio/decay';
const src = fs.readFileSync('src/audio/onsetWorklet.ts','utf8').match(/`([\s\S]*)`/)![1];
const g = globalThis as any; let Proc: any; const msgs: any[] = [];
g.sampleRate = 48000; g.currentTime = 0;
g.AudioWorkletProcessor = class { port = { postMessage: (m: any) => msgs.push(m) } };
g.registerProcessor = (_: string, c: any) => { Proc = c }; eval(src);
const SR = 48000; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const OPEN = [40,45,50,55,59,64], G = '320003';
function chord(sig: Float32Array, t: number, amp: number, tau: number, muteAt?: number) {
  G.split('').forEach((c, s) => { const f0 = 440*2**((OPEN[s]+ +c-69)/12); const st = Math.floor(t*SR)+s*150;
    for (let h=1;h<=10;h++){ const ph=rnd()*6.28, ah=amp/h**1.1*(0.5+rnd());
      for (let i=0;st+i<sig.length;i++){ const tt=i/SR; let e=Math.exp(-tt/(tau/Math.sqrt(h))); if(muteAt!==undefined&&tt>muteAt) e*=Math.exp(-(tt-muteAt)/0.015);
        sig[st+i]+=ah*e*Math.sin(ph+2*Math.PI*f0*h*tt);} } });
  const st=Math.floor(t*SR); for(let i=0;i<300;i++) sig[st+i]+=amp*0.4*(rnd()-.5)*Math.exp(-i/96);
}
function run(label: string, build: (s: Float32Array)=>void, onset: number, holdUntil: number) {
  msgs.length=0; const p=new Proc(); const h=new LevelHistory(); const sig=new Float32Array(SR*4); build(sig);
  for(let i=0;i<sig.length;i++) sig[i]+=(rnd()-.5)*0.003;
  let drop: number|null=null;
  for(let i=0;i<sig.length;i+=128){ g.currentTime=i/SR; p.process([[sig.subarray(i,i+128)]]);
    while(msgs.length){const m=msgs.shift(); if(m.type==='level'){h.push(m.time,m.value); if(drop===null&&m.time>onset&&m.time<holdUntil&&h.suddenDrop(onset)) drop=m.time;}} }
  // re-run quickly for ratios
  const r = (dt:number)=>h.decayRatio(onset, onset+dt);
  console.log(label.padEnd(30), 'ratio@0.15', r(0.15)?.toFixed(2), ' ratio@0.22', r(0.22)?.toFixed(2), ' suddenDrop at', drop===null?'never':(drop-onset).toFixed(2)+'s after strum');
}
// note: decayRatio uses history (keeps 4s) — fine
for (const tau of [0.6, 1.5]) {
  run(`ring, tau ${tau}`, s=>chord(s,0.5,0.12,tau), 0.5, 3.5);
  run(`ring then mute @1.2s, tau ${tau}`, s=>chord(s,0.5,0.12,tau,1.2), 0.5, 3.5);
  run(`chop (mute @0.1s), tau ${tau}`, s=>chord(s,0.5,0.12,tau,0.1), 0.5, 3.5);
}
run('chuck (all strings muted)', s=>chord(s,0.5,0.12,0.03), 0.5, 3.5);
run('soft ring, tau 1.0', s=>chord(s,0.5,0.03,1.0), 0.5, 3.5);
