// cameraPath.js — Cinematic camera keyframes for each section + smooth interpolation
import * as THREE from 'three';

// Each keyframe sits at a steadily increasing angle around the car (see the "orbit angle"
// comment on each one, going from 20° to 430° — just over one full lap). Keeping the angle
// monotonic and the step between consecutive keyframes modest (40°) means the Catmull-Rom
// spline always sweeps around the OUTSIDE of the car as it interpolates between two
// keyframes, rather than cutting a straight line through the middle of the body — which is
// what happened when earlier keyframes jumped between near-opposite sides of the car.
//
// The car itself stays visually stationary (see main.js) — this file only moves the camera.
// Distances assume a car ~460 units long / ~235 wide / ~90 tall, centered at the origin,
// resting on y=0.
export const CAMERA_KEYFRAMES = [
  { // hero — orbit angle 20°, front 3/4
    id: 'hero',
    pos: new THREE.Vector3(147, 65, 404),
    look: new THREE.Vector3(0, 45, 0),
    fov: 32,
  },
  { // overview — orbit angle 70°, wide front-side
    id: 'overview',
    pos: new THREE.Vector3(395, 85, 144),
    look: new THREE.Vector3(0, 42, 0),
    fov: 30,
  },
  { // performance — orbit angle 110°, side, slightly forward
    id: 'performance',
    pos: new THREE.Vector3(329, 55, -120),
    look: new THREE.Vector3(0, 40, 0),
    fov: 28,
  },
  { // exterior — orbit angle 150°, side profile
    id: 'exterior',
    pos: new THREE.Vector3(190, 60, -329),
    look: new THREE.Vector3(0, 45, 0),
    fov: 28,
    sideProfile: true,
  },
  { // interior — orbit angle 190°, side-rear
    id: 'interior',
    pos: new THREE.Vector3(-63, 55, -355),
    look: new THREE.Vector3(0, 42, 0),
    fov: 24,
  },
  { // technology — orbit angle 230°, rear 3/4
    id: 'technology',
    pos: new THREE.Vector3(-291, 55, -244),
    look: new THREE.Vector3(0, 40, 0),
    fov: 26,
  },
  { // wheels — orbit angle 270°, rear-side
    id: 'wheels',
    pos: new THREE.Vector3(-360, 45, 0),
    look: new THREE.Vector3(0, 38, 0),
    fov: 22,
  },
  { // specs — orbit angle 310°, wide pull-back
    id: 'specs',
    pos: new THREE.Vector3(-352, 100, 296),
    look: new THREE.Vector3(0, 45, 0),
    fov: 30,
  },
  { // gallery — orbit angle 350°, almost back to front
    id: 'gallery',
    pos: new THREE.Vector3(-73, 80, 414),
    look: new THREE.Vector3(0, 45, 0),
    fov: 30,
  },
  { // showcase — orbit angle 390° (30° past a full lap), dramatic front 3/4
    id: 'showcase',
    pos: new THREE.Vector3(190, 55, 329),
    look: new THREE.Vector3(0, 45, 0),
    fov: 26,
  },
  { // contact — orbit angle 430°, final wide pull-back
    id: 'contact',
    pos: new THREE.Vector3(489, 110, 178),
    look: new THREE.Vector3(0, 45, 0),
    fov: 34,
  },
];

// Named presets for the gallery "walk around it" buttons — absolute camera states
export const GALLERY_PRESETS = {
  front: { pos: new THREE.Vector3(0, 70, 420), look: new THREE.Vector3(0, 45, 0), fov: 28 },
  side:  { pos: new THREE.Vector3(460, 65, 0), look: new THREE.Vector3(0, 45, 0), fov: 26 },
  rear:  { pos: new THREE.Vector3(0, 70, -420), look: new THREE.Vector3(0, 45, 0), fov: 28 },
  top:   { pos: new THREE.Vector3(0, 380, 10), look: new THREE.Vector3(0, 0, 0), fov: 30 },
  interior: { pos: new THREE.Vector3(100, 65, 130), look: new THREE.Vector3(0, 45, 0), fov: 22 },
};

// Catmull-Rom-ish smooth interpolation across keyframes using a global scroll progress [0,1]
export function sampleCameraPath(progress, keyframes){
  const n = keyframes.length;
  const scaled = progress * (n - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(i0 + 1, n - 1);
  const t = scaled - i0;

  const kA = keyframes[Math.max(i0 - 1, 0)];
  const kB = keyframes[i0];
  const kC = keyframes[i1];
  const kD = keyframes[Math.min(i1 + 1, n - 1)];

  const pos = catmullRomVec3(kA.pos, kB.pos, kC.pos, kD.pos, t);
  const look = catmullRomVec3(kA.look, kB.look, kC.look, kD.look, t);
  const fov = catmullRomScalar(kA.fov, kB.fov, kC.fov, kD.fov, t);

  return { pos, look, fov, index: i0, t };
}

function catmullRomVec3(p0, p1, p2, p3, t){
  return new THREE.Vector3(
    catmullRomScalar(p0.x, p1.x, p2.x, p3.x, t),
    catmullRomScalar(p0.y, p1.y, p2.y, p3.y, t),
    catmullRomScalar(p0.z, p1.z, p2.z, p3.z, t)
  );
}

function catmullRomScalar(p0, p1, p2, p3, t){
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}
