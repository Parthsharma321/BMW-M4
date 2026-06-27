// scene.js — Core Three.js renderer, lighting rig, environment, post-processing
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createScene(canvas){
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.FogExp2(0x07080a, 0.0021);

  const camera = new THREE.PerspectiveCamera(
    32,
    window.innerWidth / window.innerHeight,
    5,
    2000
  );
  camera.position.set(0, 60, 480);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ---- Environment lighting (procedural studio HDRI substitute) ----
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envScene = buildStudioEnvironment();
  const envRT = pmremGenerator.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  envScene.environment = null;

  // ---- Key / Rim / Fill lighting rig ----
  const keyLight = new THREE.DirectionalLight(0xf5f5f0, 1.5);
  keyLight.position.set(180, 220, 140);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 1200;
  keyLight.shadow.camera.left = -320;
  keyLight.shadow.camera.right = 320;
  keyLight.shadow.camera.top = 320;
  keyLight.shadow.camera.bottom = -320;
  keyLight.shadow.bias = -0.0008;
  keyLight.shadow.radius = 4;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xc8d8f0, 0.6);
  rimLight.position.set(-220, 90, -260);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xd0d4dc, 0.5);
  fillLight.position.set(-140, 60, 220);
  scene.add(fillLight);

  const ambient = new THREE.AmbientLight(0x404040, 0.35);
  scene.add(ambient);

  // Moving accent lights for subtle "reflections traveling across the body" — kept
  // neutral/dim rather than saturated color, so they read as studio light movement
  // rather than colored gel lighting on the car itself.
  const accentLight = new THREE.PointLight(0xe8eef5, 5, 600, 2);
  accentLight.position.set(0, 80, 0);
  scene.add(accentLight);

  const accentLight2 = new THREE.PointLight(0xd8e0ec, 4, 600, 2);
  accentLight2.position.set(0, 40, -200);
  scene.add(accentLight2);

  // ---- Studio floor with reflection ----
  const floorGeo = new THREE.CircleGeometry(900, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c10,
    roughness: 0.45,
    metalness: 0.3,
    envMapIntensity: 0.5,
  });
  // Floor sits just beneath y=0, since carLoader.js rests the car's lowest point
  // (wheel contact patches) at y≈-0.2. A larger gap here would visibly float the car.
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.3;
  floor.receiveShadow = true;
  scene.add(floor);

  // subtle radial grid lines on floor (studio feel)
  const gridTex = buildGridTexture();
  floorMat.map = gridTex;
  floorMat.map.colorSpace = THREE.SRGBColorSpace;

  // ---- Post-processing composer ----
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.15, // strength
    0.4,  // radius
    0.95  // threshold
  );
  composer.addPass(bloomPass);

  let ssaoPass = null;
  if (!isLowPowerDevice()) {
    ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 10;
    ssaoPass.minDistance = 0.0005;
    ssaoPass.maxDistance = 0.08;
    composer.addPass(ssaoPass);
  }

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function isLowPowerDevice(){
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    return isMobile || lowCores;
  }

  function buildStudioEnvironment(){
    // RoomEnvironment provides a complete, enclosed studio-style room for reflections.
    // Earlier versions of this function added bright cyan/blue MeshBasicMaterial panels
    // here to "tint" the environment — but because reflective body panels pick up the
    // environment map directly, those colored panels showed up as visible cyan/blue
    // streaks reflected across the paint and floor. A real studio shot uses neutral
    // white/grey softboxes, so we do the same here: a single dim, neutral fill panel,
    // with all the actual color/mood coming from the directional lights instead.
    const envScene = new THREE.Scene();
    const room = new RoomEnvironment();
    envScene.add(room);

    const panelGeo = new THREE.PlaneGeometry(4, 6);
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x808080, toneMapped: false });
    const p1 = new THREE.Mesh(panelGeo, panelMat);
    p1.position.set(-4, 3, 2);
    p1.lookAt(0, 2, 0);
    envScene.add(p1);

    return envScene;
  }

  function buildGridTexture(){
    const size = 1024;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(120,150,200,0.07)';
    ctx.lineWidth = 1;
    const step = size / 24;
    for (let i = 0; i <= 24; i++){
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  function handleResize(){
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
    if (ssaoPass) ssaoPass.setSize(w, h);
  }
  window.addEventListener('resize', handleResize);

  return {
    scene, camera, renderer, composer,
    keyLight, rimLight, fillLight, accentLight, accentLight2,
    floor, bloomPass, ssaoPass,
    handleResize,
  };
}
