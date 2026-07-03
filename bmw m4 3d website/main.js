// main.js — Orchestrates the BMW M4 Competition experience
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createScene } from './scene.js';
import { loadCar, collectHeadlightMaterials, collectBodyMaterials, disposeLoader } from './carLoader.js';
import { CAMERA_KEYFRAMES, GALLERY_PRESETS, sampleCameraPath } from './cameraPath.js';
import * as Audio from './audio.js';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   STATE
   ============================================================ */
const state = {
  autoRotate: true,
  scrollProgress: 0,
  scrollVelocity: 0,
  lastScrollY: 0,
  mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
  activePreset: null,
  galleryActive: false,
  freehandMode: false,
  prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  carReady: false,
  idleSpinAngle: 0,
  wasInIdleZone: false,
};

/* ============================================================
   CLEANUP PREVIOUS INSTANCE (Prevent soft-refresh memory leaks & CPU freezes)
   ============================================================ */
if (window.__bmwScene) {
  console.log('[BMW M4] Cleaning up previous instance...');
  try {
    if (window.__bmwScene.stop) window.__bmwScene.stop();
    if (window.__bmwScene.dispose) window.__bmwScene.dispose();
  } catch (e) {
    console.error('Error disposing previous instance:', e);
  }
}

/* ============================================================
   SCENE SETUP
   ============================================================ */
const canvas = document.getElementById('webgl');
const { scene, camera, renderer, composer, useComposer, accentLight, accentLight2, dispose: disposeScene } = createScene(canvas);

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.warn('[WebGL] Context lost. Pausing rendering loop...');
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}, false);

canvas.addEventListener('webglcontextrestored', () => {
  console.log('[WebGL] Context restored. Re-initializing scene...');
  window.location.reload();
}, false);

let car = null;
let controls = null;
let headlightMats = [];
let bodyPaintMats = [];
let visualizerCanvas = null;
let visualizerCtx = null;
let visualizerDataArray = null;
const clock = new THREE.Clock();
let animFrameId = null;

/* ============================================================
   LOADER UI
   ============================================================ */
const loaderEl = document.getElementById('loader');
const loaderBarFill = document.getElementById('loaderBarFill');
const loaderPct = document.getElementById('loaderPct');
const loaderParticlesEl = document.getElementById('loaderParticles');

function spawnLoaderParticles(){
  for (let i = 0; i < 28; i++){
    const span = document.createElement('span');
    span.style.left = `${Math.random() * 100}%`;
    span.style.bottom = `${Math.random() * 20}%`;
    span.style.animationDelay = `${Math.random() * 6}s`;
    span.style.animationDuration = `${4 + Math.random() * 4}s`;
    loaderParticlesEl.appendChild(span);
  }
}
spawnLoaderParticles();

function updateLoaderProgress(p){
  const pct = Math.round(p * 100);
  loaderBarFill.style.width = `${pct}%`;
  loaderPct.textContent = `${pct}%`;
}

function hideLoader(){
  return new Promise((resolve) => {
    gsap.to(loaderEl, {
      opacity: 0,
      duration: 1.1,
      ease: 'power2.inOut',
      onStart: () => loaderEl.classList.add('is-hidden'),
      onComplete: () => {
        loaderEl.style.display = 'none';
        resolve();
      },
    });
  });
}

/* ============================================================
   SMOOTH SCROLL (Lenis) + ScrollTrigger bridge
   ============================================================ */
let lenis = null;

function initSmoothScroll(){
  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.3,
  });

  lenis.on('scroll', (e) => {
    ScrollTrigger.update();
    state.scrollVelocity = e.velocity ?? 0;
    Audio.updateEngineFromScroll(state.scrollVelocity);
  });

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

/* ============================================================
   INIT SEQUENCE
   ============================================================ */
let animationsInitialized = false;
let loopStarted = false;
let currentLoadId = 0;

async function init(){
  initSmoothScroll();
  Audio.initAudioOnFirstGesture();

  visualizerCanvas = document.getElementById('hudVisualizer');
  if (visualizerCanvas) {
    visualizerCtx = visualizerCanvas.getContext('2d');
  }

  await attemptLoad();
}

async function attemptLoad(){
  currentLoadId++;
  const thisLoadId = currentLoadId;
  const errorEl = document.getElementById('loaderError');
  const errorMsgEl = errorEl.querySelector('.error-msg');
  const loaderPctEl = document.getElementById('loaderPct');
  const barFillEl = document.getElementById('loaderBarFill');

  // Reset UI states
  errorEl.style.display = 'none';
  loaderPctEl.style.display = 'block';
  barFillEl.parentElement.style.display = 'block';
  updateLoaderProgress(0);

  // If there's an existing car in the scene, remove it to prevent duplicates
  if (car) {
    scene.remove(car);
    car = null;
    state.carReady = false;
  }

  try {
    // 25-second loading timeout for large assets over slow networks
    const loadPromise = loadCar(scene, updateLoaderProgress);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout. Please check your network and retry.')), 25000)
    );

    const result = await Promise.race([loadPromise, timeoutPromise]);
    
    // Check if this load attempt was superseded by a newer click retry
    if (thisLoadId !== currentLoadId) {
      console.log('Discarded superseded car load request:', thisLoadId);
      return;
    }

    car = result.car;
    scene.add(car); // Add the mesh to the scene here
    renderer.shadowMap.needsUpdate = true; // Compile static shadows once on load
    headlightMats = collectHeadlightMaterials(car);
    bodyPaintMats = collectBodyMaterials(car);
    state.carReady = true;

    initPaintConfigurator();

    const ASSUMED_CAR_LENGTH = 460;
    const actualCarLength = Math.max(result.dimensions.x, result.dimensions.y, result.dimensions.z);
    cameraScaleCorrection = actualCarLength / ASSUMED_CAR_LENGTH;
    console.log('[BMW M4 diagnostic] actual car length:', actualCarLength.toFixed(1),
      '— camera scale correction factor:', cameraScaleCorrection.toFixed(3));

    // Minimum show time for the loader so the silhouette animation can be appreciated
    await new Promise((r) => setTimeout(r, 600));
    await hideLoader();

    playIntroSequence();
    
    if (!animationsInitialized){
      initScrollAnimations();
      initUIInteractions();
      initSectionRail();
      initNavScrollEffects();
      animationsInitialized = true;
    }
    if (!loopStarted){
      animate();
      loopStarted = true;
    }
  } catch (err) {
    console.error('Failed to load BMW M4 model:', err);
    // Only display error state if this load attempt wasn't superseded
    if (thisLoadId === currentLoadId) {
      loaderPctEl.style.display = 'none';
      barFillEl.parentElement.style.display = 'none';
      errorMsgEl.textContent = err.message || 'Failed to load model. Connection error.';
      errorEl.style.display = 'flex';
    }
  }
}

function initPaintConfigurator() {
  const dots = document.querySelectorAll('.color-dot');
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      dots.forEach(d => d.classList.remove('is-active'));
      dot.classList.add('is-active');

      const colorHex = dot.getAttribute('data-color');
      const threeColor = new THREE.Color(colorHex);

      bodyPaintMats.forEach(m => {
        gsap.to(m.color, {
          r: threeColor.r,
          g: threeColor.g,
          b: threeColor.b,
          duration: 0.8,
          ease: 'power2.out'
        });
      });
      Audio.playClick();
    });
  });
}

function drawVisualizer() {
  if (!visualizerCtx || !visualizerCanvas) return;
  const w = visualizerCanvas.width;
  const h = visualizerCanvas.height;
  visualizerCtx.clearRect(0, 0, w, h);

  if (!visualizerDataArray) {
    const bins = Audio.getAnalyserFrequencyBinCount();
    if (bins > 0) {
      visualizerDataArray = new Uint8Array(bins);
    }
  }

  if (visualizerDataArray) {
    Audio.getAnalyserData(visualizerDataArray);
  }

  const barCount = 18;
  const barWidth = w / barCount - 2;
  
  const grad = visualizerCtx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#3ad6ff');
  grad.addColorStop(0.5, '#1c3fa8');
  grad.addColorStop(1, '#e6293c');

  visualizerCtx.fillStyle = grad;

  for (let i = 0; i < barCount; i++) {
    let value = 0;
    if (visualizerDataArray && !Audio.isMuted()) {
      const dataIdx = Math.floor((i / barCount) * visualizerDataArray.length);
      value = visualizerDataArray[dataIdx] / 255;
    } else {
      const elapsed = clock.getElapsedTime();
      value = 0.08 + Math.sin(elapsed * 4 + i * 0.4) * 0.04;
    }

    const revMultiplier = 1.0 + Math.min(Math.abs(state.scrollVelocity) * 0.005, 2.5);
    const finalValue = Math.min(value * revMultiplier, 1.0);
    const barHeight = Math.max(finalValue * h, 3);

    const x = i * (barWidth + 2);
    const y = h - barHeight;

    visualizerCtx.shadowColor = 'rgba(58,214,255,0.25)';
    visualizerCtx.shadowBlur = 4;
    visualizerCtx.fillRect(x, y, barWidth, barHeight);
  }
  visualizerCtx.shadowBlur = 0;
}

init();

/* ============================================================
   INTRO SEQUENCE — plays once after loader hides
   ============================================================ */
function playIntroSequence(){
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to('.eyebrow', { y: 0, opacity: 1, duration: 0.9 }, 0.1)
    .to('.hero-title-light', { y: 0, duration: 1.0 }, 0.25)
    .to('.hero-title-bold', { y: 0, duration: 1.1 }, 0.4)
    .to('.hero-sub', { y: 0, opacity: 1, duration: 0.9 }, 0.75)
    .to('.hero-cta-wrap', { y: 0, opacity: 1, duration: 0.9 }, 0.85)
    .to('.hero-scroll-cue', { opacity: 1, duration: 0.8 }, 1.1)
    .to('.hero-controls', { opacity: 1, duration: 0.8 }, 1.1)
    .to('#telemetryHud', { duration: 0.1 }, 1.2, () => {
      document.getElementById('telemetryHud').classList.add('is-visible');
    });

  // subtle camera dolly-in on load for cinematic arrival
  if (camera && !state.prefersReducedMotion){
    const startPos = camera.position.clone().add(
      new THREE.Vector3(40, 25, 90).multiplyScalar(cameraScaleCorrection)
    );
    camera.position.copy(startPos);
    gsap.to(camera.position, {
      x: CAMERA_KEYFRAMES[0].pos.x * cameraScaleCorrection,
      y: CAMERA_KEYFRAMES[0].pos.y * cameraScaleCorrection,
      z: CAMERA_KEYFRAMES[0].pos.z * cameraScaleCorrection,
      duration: 2.4,
      ease: 'power2.out',
    });
  }
}

/* ============================================================
   SCROLL-DRIVEN CAMERA + CAR ANIMATION (GSAP ScrollTrigger)
   ============================================================ */
let cameraDriveProgress = 0; // 0..1 across the whole document, driven by ScrollTrigger
let cameraScaleCorrection = 1; // set once the real car size is known in init()
const tmpLookTarget = new THREE.Vector3();
const dummyCamPos = new THREE.Vector3();
const dummyLookPos = new THREE.Vector3();

function exitGalleryMode(){
  if (!state.galleryActive) return;
  state.galleryActive = false;
  state.activePreset = null;
  document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-active'));
  document.getElementById('hudCam').textContent = state.autoRotate ? 'ORBIT.AUTO' : 'ORBIT.MANUAL';

  // Smoothly transition camera up vector back to default (0, 1, 0) to prevent orientations locks
  gsap.to(camera.up, {
    x: 0,
    y: 1,
    z: 0,
    duration: 1.2,
    ease: 'power2.out'
  });
}

function initScrollAnimations(){
  // Master scroll progress across entire page drives the camera path
  ScrollTrigger.create({
    trigger: '#content',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      cameraDriveProgress = self.progress;
      state.scrollProgress = self.progress;
      updateRailFill(self.progress);
    },
  });

  // If a gallery preset is active and the user scrolls again, hand control
  // back to the scroll-driven camera path rather than leaving it stuck.
  let lastScrollYForGallery = window.scrollY;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: () => {
      if (state.galleryActive && Math.abs(window.scrollY - lastScrollYForGallery) > 4){
        exitGalleryMode();
      }
      lastScrollYForGallery = window.scrollY;
    },
  });

  // Per-section text reveal animations
  const sectionFrames = gsap.utils.toArray('.section-frame, .stat-grid, .specs-panel, .showcase-content, .contact-panel');
  sectionFrames.forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 50, filter: 'blur(6px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)',
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 78%',
          end: 'top 35%',
          scrub: false,
          toggleActions: 'play none none reverse',
        },
      }
    );
  });

  // Stat counter animation
  const statCards = gsap.utils.toArray('.stat-card');
  statCards.forEach((card) => {
    const target = parseFloat(card.dataset.target);
    const decimals = parseInt(card.dataset.decimals || '0', 10);
    const suffix = card.dataset.suffix || '';
    const numEl = card.querySelector('.stat-num');
    const suffixEl = card.querySelector('.stat-suffix');
    suffixEl.textContent = suffix;

    ScrollTrigger.create({
      trigger: card,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.fromTo({ val: 0 }, { val: target }, {
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: function(){
            numEl.textContent = this.targets()[0].val.toFixed(decimals);
          },
        });
        gsap.fromTo(card, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
      },
    });
  });

  // Specs rows stagger
  gsap.fromTo('.specs-row',
    { opacity: 0, x: -20 },
    {
      opacity: 1, x: 0,
      duration: 0.6,
      stagger: 0.06,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.specs-table',
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    }
  );

  // Headlight glow intensifies during the technology/showcase sections
  ScrollTrigger.create({
    trigger: '#technology',
    start: 'top 60%',
    end: 'bottom 20%',
    onUpdate: (self) => {
      const intensity = self.progress * 2.2;
      headlightMats.forEach((m) => { m.emissiveIntensity = intensity; });
    },
    onLeaveBack: () => headlightMats.forEach((m) => { m.emissiveIntensity = 0; }),
  });

  ScrollTrigger.refresh();
}

function updateRailFill(progress){
  const railFill = document.getElementById('railFillPath');
  const total = 400;
  const offset = total - (progress * total);
  railFill.style.strokeDashoffset = offset;
}

/* ============================================================
   SECTION RAIL DASH SETUP + HUD SECTION LABEL
   ============================================================ */
const SECTION_IDS = ['hero','overview','performance','exterior','interior','technology','wheels','specs','gallery','showcase','contact'];
const SECTION_LABELS = {
  hero: '00 / HERO', overview: '01 / OVERVIEW', performance: '02 / PERFORMANCE',
  exterior: '03 / EXTERIOR', interior: '04 / INTERIOR', technology: '05 / ENGINE',
  wheels: '06 / WHEELS', specs: '07 / SPECS', gallery: '08 / GALLERY',
  showcase: '09 / SHOWCASE', contact: '10 / CONTACT',
};

const SECTION_COLORS = {
  hero: '#3ad6ff',
  overview: '#3ad6ff',
  performance: '#e6293c',
  exterior: '#07513b',
  interior: '#07513b',
  technology: '#cbd622',
  wheels: '#cbd622',
  specs: '#1c3fa8',
  gallery: '#1c3fa8',
  showcase: '#3ad6ff',
  contact: '#e6293c'
};

const SECTION_BLOB_POSITIONS = {
  hero: { top: '30%', left: '20%' },
  overview: { top: '50%', left: '15%' },
  performance: { top: '65%', left: '85%' },
  exterior: { top: '40%', left: '20%' },
  interior: { top: '75%', left: '80%' },
  technology: { top: '50%', left: '15%' },
  wheels: { top: '60%', left: '85%' },
  specs: { top: '45%', left: '20%' },
  gallery: { top: '50%', left: '50%' },
  showcase: { top: '35%', left: '80%' },
  contact: { top: '60%', left: '25%' }
};

function initSectionRail(){
  const railFill = document.getElementById('railFillPath');
  railFill.style.strokeDasharray = '400';
  railFill.style.strokeDashoffset = '400';

  const hudSection = document.getElementById('hudSection');

  SECTION_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top center',
      end: 'bottom center',
      onEnter: () => setActiveSection(id),
      onEnterBack: () => setActiveSection(id),
    });
  });

  function setActiveSection(id){
    hudSection.textContent = SECTION_LABELS[id] || id;
    document.querySelectorAll('.nav-links a, #mobileMenu a').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.section === id);
    });

    const activeColor = SECTION_COLORS[id] || '#3ad6ff';
    const threeColor = new THREE.Color(activeColor);

    document.documentElement.style.setProperty('--active-accent', activeColor);

    // Smooth transition for 3D accent lights to match section theme
    if (accentLight) {
      gsap.to(accentLight.color, {
        r: threeColor.r,
        g: threeColor.g,
        b: threeColor.b,
        duration: 1.2,
        ease: 'power2.out'
      });
    }
    if (accentLight2) {
      gsap.to(accentLight2.color, {
        r: threeColor.r,
        g: threeColor.g,
        b: threeColor.b,
        duration: 1.2,
        ease: 'power2.out'
      });
    }

    // Smoothly shift the background glow radial blob position
    const blob = document.getElementById('glowBgBlob');
    if (blob) {
      const pos = SECTION_BLOB_POSITIONS[id] || { top: '50%', left: '50%' };
      blob.style.top = pos.top;
      blob.style.left = pos.left;
    }
  }
}

/* ============================================================
   NAVBAR SCROLL BEHAVIOR (hide on scroll down, show on scroll up)
   ============================================================ */
function initNavScrollEffects(){
  const navbar = document.getElementById('navbar');
  let lastY = window.scrollY;

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = window.scrollY;
      navbar.classList.toggle('is-scrolled', y > 40);
      if (y > lastY && y > 120){
        navbar.classList.add('nav-hidden');
      } else {
        navbar.classList.remove('nav-hidden');
      }
      lastY = y;
    },
  });
}

/* ============================================================
   UI INTERACTIONS — rotate toggle, reset, fullscreen, gallery presets,
   mobile menu, audio toggle, nav links
   ============================================================ */
function initUIInteractions(){
  // Freehand Mode Toggle
  const freehandBtn = document.getElementById('navFreehandBtn');
  if (freehandBtn) {
    freehandBtn.addEventListener('click', () => {
      Audio.playClick();
      if (!state.freehandMode) {
        // Enter Freehand Mode
        state.freehandMode = true;
        document.body.classList.add('is-freehand-active');
        freehandBtn.textContent = 'EXIT FREEHAND';
        freehandBtn.classList.add('is-active');
        lenis.stop();

        // Initialize OrbitControls
        if (!controls) {
          controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.05;
          controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera from dipping below the floor
          controls.minDistance = 180 * cameraScaleCorrection;
          controls.maxDistance = 750 * cameraScaleCorrection;
        }
        controls.target.set(0, 45, 0).multiplyScalar(cameraScaleCorrection);
        controls.enabled = true;

        // Smoothly transition camera to a cinematic starting orbit position
        gsap.to(camera.position, {
          x: -160 * cameraScaleCorrection,
          y: 85 * cameraScaleCorrection,
          z: 385 * cameraScaleCorrection,
          duration: 1.4,
          ease: 'power2.out',
          onComplete: () => {
            controls.update();
          }
        });
      } else {
        // Exit Freehand Mode
        state.freehandMode = false;
        document.body.classList.remove('is-freehand-active');
        freehandBtn.textContent = 'FREEHAND 3D';
        freehandBtn.classList.remove('is-active');

        if (controls) {
          controls.enabled = false;
        }
        lenis.start();

        // Smoothly return camera to path scroll position
        const sample = sampleCameraPath(cameraDriveProgress, CAMERA_KEYFRAMES);
        gsap.to(camera.position, {
          x: sample.pos.x * cameraScaleCorrection,
          y: sample.pos.y * cameraScaleCorrection,
          z: sample.pos.z * cameraScaleCorrection,
          duration: 1.4,
          ease: 'power2.inOut',
          onComplete: () => {
            tmpLookTarget.copy(sample.look).multiplyScalar(cameraScaleCorrection);
            camera.lookAt(tmpLookTarget);
          }
        });
      }
    });
  }

  // Auto-rotate pause/resume
  const rotateBtn = document.getElementById('ctrlRotateToggle');
  rotateBtn.addEventListener('click', () => {
    state.autoRotate = !state.autoRotate;
    rotateBtn.classList.toggle('is-active', !state.autoRotate);
    Audio.playClick();
    document.getElementById('hudCam').textContent = state.autoRotate ? 'ORBIT.AUTO' : 'ORBIT.MANUAL';
  });

  // Reset camera — scroll back to hero
  const resetBtn = document.getElementById('ctrlReset');
  resetBtn.addEventListener('click', () => {
    Audio.playClick();
    exitGalleryMode();
    lenis.scrollTo(0, { duration: 1.4 });
  });

  // Fullscreen toggle
  const fsBtn = document.getElementById('ctrlFullscreen');
  fsBtn.addEventListener('click', () => {
    Audio.playClick();
    if (!document.fullscreenElement){
      document.documentElement.requestFullscreen?.();
      fsBtn.classList.add('is-active');
    } else {
      document.exitFullscreen?.();
      fsBtn.classList.remove('is-active');
    }
  });

  // Gallery presets
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      Audio.playClick();
      presetBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const presetKey = btn.dataset.preset;
      state.activePreset = presetKey;
      state.galleryActive = true;

      // Pause auto-rotation when viewing a static preset angle
      state.autoRotate = false;
      const rotateBtn = document.getElementById('ctrlRotateToggle');
      if (rotateBtn) {
        rotateBtn.classList.add('is-active');
      }
      document.getElementById('hudCam').textContent = `PRESET.${presetKey.toUpperCase()}`;

      const preset = GALLERY_PRESETS[presetKey];
      if (preset && !state.prefersReducedMotion){
        // Smoothly animate the car's rotation back to 0 so it aligns with the camera keyframe
        if (car) {
          gsap.to(car.rotation, {
            y: 0,
            duration: 1.4,
            ease: 'power2.inOut'
          });
        }

        // Animate camera up vector to support looking straight down without locks
        const targetUp = preset.up || new THREE.Vector3(0, 1, 0);
        gsap.to(camera.up, {
          x: targetUp.x,
          y: targetUp.y,
          z: targetUp.z,
          duration: 1.6,
          ease: 'power3.inOut'
        });

        gsap.to(camera.position, {
          x: preset.pos.x * cameraScaleCorrection,
          y: preset.pos.y * cameraScaleCorrection,
          z: preset.pos.z * cameraScaleCorrection,
          duration: 1.6, ease: 'power3.inOut',
        });
        gsap.to(camera, {
          fov: preset.fov,
          duration: 1.6, ease: 'power3.inOut',
          onUpdate: () => camera.updateProjectionMatrix(),
        });
      } else if (preset){
        if (car) car.rotation.y = 0;
        const targetUp = preset.up || new THREE.Vector3(0, 1, 0);
        camera.up.copy(targetUp);
        camera.position.copy(preset.pos).multiplyScalar(cameraScaleCorrection);
        camera.fov = preset.fov;
        camera.updateProjectionMatrix();
      }
      tmpLookTarget.copy(preset.look).multiplyScalar(cameraScaleCorrection);
    });
  });

  // Mobile menu
  const burger = document.getElementById('navBurger');
  const mobileMenu = document.getElementById('mobileMenu');
  burger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    document.body.classList.toggle('no-scroll', isOpen);
    burger.classList.toggle('is-active', isOpen);
  });
  mobileMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    });
  });

  // Audio toggle
  const audioBtn = document.getElementById('audioToggle');
  const iconOn = audioBtn.querySelector('.icon-sound-on');
  const iconOff = audioBtn.querySelector('.icon-sound-off');
  audioBtn.addEventListener('click', () => {
    const nowMuted = !Audio.isMuted();
    Audio.setMuted(nowMuted);
    iconOn.style.display = nowMuted ? 'none' : 'block';
    iconOff.style.display = nowMuted ? 'block' : 'none';
    if (!nowMuted) Audio.playClick();
  });
  // start muted by default; show "off" icon state correctly
  iconOn.style.display = 'none';
  iconOff.style.display = 'block';

  // Smooth-scroll nav links (Lenis handles anchor offsets)
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href.length > 1){
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) lenis.scrollTo(target, { duration: 1.3 });
      }
    });
  });

  // Contact form (no backend — just a graceful confirmation)
  const form = document.getElementById('contactForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('.form-submit');
    const original = btn.textContent;
    btn.textContent = 'Request received ✓';
    btn.style.background = 'linear-gradient(135deg, #1c3fa8, #3ad6ff)';
    setTimeout(() => { btn.textContent = original; }, 2600);
  });

  // Mouse parallax for hero camera float
  window.addEventListener('pointermove', (e) => {
    state.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    state.mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Loader retry button click listener
  const retryBtn = document.getElementById('loaderRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      Audio.playClick();
      attemptLoad();
    });
  }
}

/* ============================================================
   RENDER LOOP
   ============================================================ */
function animate(){
  animFrameId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // smooth mouse parallax
  state.mouse.x += (state.mouse.targetX - state.mouse.x) * 0.04;
  state.mouse.y += (state.mouse.targetY - state.mouse.y) * 0.04;

  if (car && state.carReady){
    if (state.freehandMode) {
      if (controls) controls.update();
    } else if (!state.galleryActive){
      const sample = sampleCameraPath(cameraDriveProgress, CAMERA_KEYFRAMES);

      // base camera position from path, rescaled to match the model's real size
      dummyCamPos.copy(sample.pos).multiplyScalar(cameraScaleCorrection);
      dummyLookPos.copy(sample.look).multiplyScalar(cameraScaleCorrection);

      // gentle floating + mouse parallax offset (cinematic "alive" feel) — also scaled
      // so the float/parallax amount stays proportional to the car's actual size
      const floatX = Math.sin(elapsed * 0.18) * 4 * cameraScaleCorrection;
      const floatY = Math.sin(elapsed * 0.23) * 2.4 * cameraScaleCorrection;
      const parallaxStrength = 14 * cameraScaleCorrection;

      dummyCamPos.x += floatX + state.mouse.x * parallaxStrength;
      dummyCamPos.y += floatY + -state.mouse.y * parallaxStrength * 0.5;

      camera.position.lerp(dummyCamPos, state.prefersReducedMotion ? 1 : 0.09);
      tmpLookTarget.lerp(dummyLookPos, state.prefersReducedMotion ? 1 : 0.09);
      camera.lookAt(tmpLookTarget);

      if (Math.abs(camera.fov - sample.fov) > 0.01){
        camera.fov += (sample.fov - camera.fov) * 0.08;
        camera.updateProjectionMatrix();
      }

      // The car itself stays put — every CAMERA_KEYFRAMES entry already sits at its own
      // angle around the car, so the spline alone produces the "walking around it" effect
      // as you scroll. The only rotation applied directly to the car is a slow cinematic
      // idle spin while sitting at the very top of the page (hero, pre-scroll).
      //
      // We accumulate the idle angle frame-by-frame (using delta, not the absolute
      // page-load clock) so it never "jumps" — reading the absolute clock here previously
      // caused the car to snap through several rotations the instant you first scrolled,
      // because elapsed time had already built up while you were just reading the hero text.
      const inIdleZone = state.autoRotate && cameraDriveProgress < 0.04;
      if (inIdleZone){
        if (!state.wasInIdleZone){
          // Just entered (or re-entered) the idle zone — resume spinning from the car's
          // current angle instead of a stale stored value, so there's no snap.
          state.idleSpinAngle = car.rotation.y;
        }
        state.idleSpinAngle += delta * 0.35;
        car.rotation.y += (state.idleSpinAngle - car.rotation.y) * 0.06;
      }
      // Once we leave the idle zone we simply stop touching car.rotation.y — it holds
      // whatever angle it was last at. The camera-orbit keyframes don't assume the car
      // sits at rotation 0, only that it stays fixed, so there's nothing to "undo" here.
      state.wasInIdleZone = inIdleZone;
    } else {
      // gallery preset active: keep car gently idling, camera held by GSAP tween
      camera.lookAt(tmpLookTarget);
      if (state.autoRotate){
        car.rotation.y += delta * 0.12;
      }
    }

    // moving accent lights — "reflections traveling across the body"
    accentLight.position.x = Math.sin(elapsed * 0.4) * 160;
    accentLight.position.z = Math.cos(elapsed * 0.4) * 160;
    accentLight2.position.x = Math.cos(elapsed * 0.3) * 140;
    accentLight2.position.z = Math.sin(elapsed * 0.3) * -140;
  }

  // Draw telemetry visualizer frame
  drawVisualizer();

  if (useComposer && composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

/* expose for other modules in this file scope via window for debugging if needed */
window.__bmwScene = {
  scene,
  camera,
  renderer,
  car: () => car,
  stop: () => {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  },
  dispose: () => {
    disposeScene();
    disposeLoader();
    if (controls) {
      controls.dispose();
      controls = null;
    }
    if (car) {
      car.traverse((node) => {
        if (node.isMesh) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(m => {
              if (m.dispose) m.dispose();
            });
          }
        }
      });
    }
  }
};

export { scene, camera, renderer, car, state };
