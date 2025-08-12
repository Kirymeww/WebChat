(function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrameId = null;
    let isRunning = false;
    let canvas, ctx;
    let particles = [];
    let lastTimestamp = 0;
    let colors = { particle: 'rgba(139, 92, 246, 0.8)', link: 'rgba(139, 92, 246, 0.12)' };
    let globalAlphaTarget = 1;
    let globalAlphaCurrent = 0;
    const FADE_IN_PER_MS = 1 / 400;

    let currentType = 'dots';
  
    function createCanvasIfNeeded() {
      if (canvas && ctx) return;
      canvas = document.createElement('canvas');
      canvas.id = 'bg-canvas';
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';
      canvas.style.opacity = '0.6';
      document.body.insertBefore(canvas, document.body.firstChild);
      ctx = canvas.getContext('2d');
      resizeCanvas();
    }
  
    function getVar(name, fallback = '') {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    }
  
    function hexToRgb(hex) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return null;
      return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
    }
  
    function updateColorsFromTheme() {
      const accentRgbStr = getVar('--accent-color-rgb', '139, 92, 246');
      const primaryHex = getVar('--primary-color', '#7c3aed');
      const primaryRgb = hexToRgb(primaryHex) || { r: 124, g: 58, b: 237 };
  
      colors.particle = `rgba(${accentRgbStr}, 0.85)`;
      colors.link = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.10)`;
    }
  
    function resizeCanvas() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  
    function computeParticleCount() {
      const area = window.innerWidth * window.innerHeight;
      const isMobile = window.innerWidth <= 768;
      const target = isMobile ? 40 : 100;
      const densityFactor = isMobile ? 0.00004 : 0.00006;
      const byArea = Math.min(target, Math.max(24, Math.floor(area * densityFactor)));
      return byArea;
    }
  
    function createParticles() {
        particles = [];
        const count = computeParticleCount();
        for (let i = 0; i < count; i++) {
        particles.push(createParticle(true));
        }
    }
  
    function createParticle(randomizePosition = false) {
      const x = randomizePosition ? Math.random() * window.innerWidth : (Math.random() < 0.5 ? 0 : window.innerWidth);
      const y = randomizePosition ? Math.random() * window.innerHeight : Math.random() * window.innerHeight;
      const size = Math.random() * 1.8 + 0.6; 
      const speed = (Math.random() * 0.5 + 0.15) * (window.innerWidth <= 768 ? 0.7 : 1);
      const angle = Math.random() * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      return { x, y, vx, vy, size };
    }
  
    function step(deltaMs) {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      if (globalAlphaCurrent < globalAlphaTarget) {
        globalAlphaCurrent = Math.min(globalAlphaTarget, globalAlphaCurrent + (deltaMs * FADE_IN_PER_MS));
      }
      ctx.save();
      ctx.globalAlpha = globalAlphaCurrent;
      
        ctx.fillStyle = colors.particle;
        for (let i = 0; i < particles.length; i++) {
         const p = particles[i];
         p.x += p.vx * (deltaMs / 16.6667);
         p.y += p.vy * (deltaMs / 16.6667);
         if (p.x < -10 || p.x > window.innerWidth + 10 || p.y < -10 || p.y > window.innerHeight + 10) {
           particles[i] = createParticle(false);
         }
         ctx.beginPath();
         ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
         ctx.fill();
       }
       const linkDistance = Math.min(140, Math.max(80, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.18)));
       ctx.strokeStyle = colors.link;
       for (let i = 0; i < particles.length; i++) {
         for (let j = i + 1; j < particles.length; j++) {
           const dx = particles[i].x - particles[j].x;
           const dy = particles[i].y - particles[j].y;
           const dist2 = dx * dx + dy * dy;
           if (dist2 < linkDistance * linkDistance) {
             const alpha = 1 - Math.sqrt(dist2) / linkDistance;
             ctx.globalAlpha = Math.min(0.6, Math.max(0.05, alpha * 0.6)) * globalAlphaCurrent;
             ctx.beginPath();
             ctx.moveTo(particles[i].x, particles[i].y);
             ctx.lineTo(particles[j].x, particles[j].y);
             ctx.stroke();
           }
         }
       }
      ctx.restore();
    }
  
    function animate(timestamp) {
      if (!isRunning) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = Math.min(48, timestamp - lastTimestamp);
      lastTimestamp = timestamp;
      step(delta);
      animationFrameId = requestAnimationFrame(animate);
    }
  
    function isUserDisabled() {
      try {
        const v = localStorage.getItem('bgParticlesEnabled');
        return v === 'false';
      } catch (_) {
        return false;
      }
    }
  
    function start() {
       if (isRunning || prefersReducedMotion || isUserDisabled()) return;
       createCanvasIfNeeded();
       updateColorsFromTheme();
       resizeCanvas();
       createParticles();
       isRunning = true;
       lastTimestamp = 0;
       globalAlphaCurrent = 0;
       animationFrameId = requestAnimationFrame(animate);
    }
  
    function stop() {
      isRunning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      globalAlphaTarget = 1;
      globalAlphaCurrent = 0;
    }
  
    function pauseForVisibility() {
      isRunning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  
    function redrawStatic() {
       createCanvasIfNeeded();
       updateColorsFromTheme();
       resizeCanvas();
       if (!ctx) return;
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       
       const count = Math.floor(computeParticleCount() * 0.8);
       ctx.fillStyle = colors.particle;
       for (let i = 0; i < count; i++) {
         const x = Math.random() * window.innerWidth;
         const y = Math.random() * window.innerHeight;
         const size = Math.random() * 1.8 + 0.6;
         ctx.beginPath();
         ctx.arc(x, y, size, 0, Math.PI * 2);
         ctx.fill();
       }
    }
  
    function handleResize() {
      resizeCanvas();
      if (prefersReducedMotion) {
        redrawStatic();
      } else {
        createParticles();
      }
    }
  
    const themeObserver = new MutationObserver(() => {
      updateColorsFromTheme();
      if (prefersReducedMotion) {
        redrawStatic();
      }
    });
  
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pauseForVisibility();
      } else {
        if (prefersReducedMotion || isUserDisabled()) {
          redrawStatic();
        } else {
          start();
        }
      }
    });
  
    window.addEventListener('resize', handleResize);
  
    document.addEventListener('DOMContentLoaded', () => {
      createCanvasIfNeeded();
      updateColorsFromTheme();
      if (prefersReducedMotion || isUserDisabled()) {
        redrawStatic();
      } else {
        start();
      }
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });
  
    window.ParticlesBackground = { 
       start, 
       stop, 
       redrawStatic
    };
  })();