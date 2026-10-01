// Critically damped selection spring, preserving current position and velocity.
(() => {
  const host = document.getElementById('presets');
  const marker = document.createElement('i'); marker.className = 'segment-highlight'; marker.setAttribute('aria-hidden','true'); host.prepend(marker);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let x=0,w=0,vx=0,vw=0,tx=0,tw=0,frame=0,last=0;
  function paint(){ marker.style.transform=`translateX(${x}px)`; marker.style.width=`${w}px`; }
  function tick(now){
    const dt=Math.min((now-last)/1000,.032); last=now;
    const k=420,d=2*Math.sqrt(k);
    vx+=(k*(tx-x)-d*vx)*dt; vw+=(k*(tw-w)-d*vw)*dt;
    x+=vx*dt; w+=vw*dt; paint();
    if(Math.abs(tx-x)+Math.abs(tw-w)+Math.abs(vx)+Math.abs(vw)>.08) frame=requestAnimationFrame(tick);
    else {x=tx;w=tw;vx=vw=0;paint();frame=0;}
  }
  function target(snap=false){
    const label=host.querySelector('input:checked')?.closest('label'); if(!label)return;
    tx=label.offsetLeft;tw=label.offsetWidth;
    if(snap||reduced.matches){ cancelAnimationFrame(frame);frame=0;x=tx;w=tw;vx=vw=0;paint(); }
    else if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
  }
  host.addEventListener('change',()=>target());
  new ResizeObserver(()=>target(true)).observe(host);
  reduced.addEventListener('change',()=>target(true));
  target(true);
})();
