// carLoader.js — Loads bmw-m4.glb, enhances materials for premium PBR look
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const GLB_PATH = './assets/bmw-m4.glb';

let dracoLoader = null;
let loader = null;

function getLoader() {
  if (!loader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./assets/draco/');
    loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
  }
  return loader;
}

export function disposeLoader() {
  if (dracoLoader) {
    dracoLoader.dispose();
    dracoLoader = null;
  }
  loader = null;
}

export function loadCar(scene, onProgress){
  return new Promise((resolve, reject) => {
    const gltfLoader = getLoader();

    gltfLoader.load(
      GLB_PATH,
      (gltf) => {
        const car = gltf.scene;

        // Normalize scale & center the model
        const box = new THREE.Box3().setFromObject(car);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Target a consistent real-world-ish length (~450 units long, matches our camera framing)
        const targetLength = 460;
        const longestAxis = Math.max(size.x, size.y, size.z);
        const scaleFactor = targetLength / longestAxis;
        car.scale.setScalar(scaleFactor);

        // Re-measure after scaling, then re-center on X/Z and rest on floor (Y)
        const box2 = new THREE.Box3().setFromObject(car);
        const size2 = new THREE.Vector3();
        box2.getSize(size2);
        const center2 = new THREE.Vector3();
        box2.getCenter(center2);

        car.position.x -= center2.x;
        car.position.z -= center2.z;
        car.position.y -= box2.min.y; // sit exactly on y=0 (floor handled separately, slightly below)
        car.position.y -= 0.2;

        enhanceMaterials(car);
        enableShadows(car);

        console.log('[BMW M4 diagnostic] raw box size (pre-scale):', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
        console.log('[BMW M4 diagnostic] scaleFactor applied:', scaleFactor.toFixed(4));
        console.log('[BMW M4 diagnostic] final scaled size:', size2.x.toFixed(1), size2.y.toFixed(1), size2.z.toFixed(1));
        console.log('[BMW M4 diagnostic] final car.position:', car.position.x.toFixed(1), car.position.y.toFixed(1), car.position.z.toFixed(1));
        console.log('[BMW M4 diagnostic] final car.scale:', car.scale.x.toFixed(4));

        resolve({ car, gltf, dimensions: size2 });
      },
      (xhr) => {
        if (xhr.lengthComputable && onProgress) {
          onProgress(xhr.loaded / xhr.total);
        }
      },
      (err) => reject(err)
    );
  });
}

function enableShadows(root){
  root.traverse((node) => {
    if (node.isMesh){
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

// Heuristically upgrade materials based on mesh/material naming conventions
// found in the model (Body, glass, Rim, Brake, tire, headlight, InteriorAlcntr, etc.)
function enhanceMaterials(root){
  // Cache by original material uuid -> final (possibly upgraded) material,
  // so shared materials are only processed once but every mesh referencing
  // them still gets reassigned to the upgraded instance.
  const materialCache = new Map();

  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;

    const nodeName = (node.name || '').toLowerCase();
    const isSteeringMesh = /steering|strng/i.test(nodeName);

    const isArrayMat = Array.isArray(node.material);
    const mats = isArrayMat ? node.material : [node.material];

    const resultMats = mats.map((mat) => {
      if (!mat) return mat;

      if (isSteeringMesh) {
        // Clone shared materials to prevent coloring the seats/dash/belts black
        const clonedMat = mat.clone();
        clonedMat.color = new THREE.Color(0x0a0a0a); // Deep premium charcoal/black
        clonedMat.roughness = 0.8;
        clonedMat.metalness = 0.1;
        clonedMat.envMapIntensity = 0.5;
        return clonedMat;
      }

      if (!(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshPhysicalMaterial)){
        return mat;
      }
      return getUpgradedMaterial(node, mat);
    });

    node.material = isArrayMat ? resultMats : resultMats[0];
  });

  function getUpgradedMaterial(node, mat){
    if (materialCache.has(mat.uuid)){
      return materialCache.get(mat.uuid);
    }
    const upgraded = upgradeToPhysical(node, mat);
    materialCache.set(mat.uuid, upgraded);
    return upgraded;
  }

  function upgradeToPhysical(node, mat){
    const ctx = ((node.name || '') + ' ' + (node.parent?.name || '') + ' ' + (mat.name || '')).toLowerCase();

    const isGlass = /glass/.test(ctx) || mat.transparent || mat.alphaMode === 'BLEND';
    const isBody = /body|bumper|skirt|spoiler|fgrll|grille|tailpiece|fin/.test(ctx);

    // Body panels get the clearcoat treatment, which requires a true MeshPhysicalMaterial —
    // MeshStandardMaterial has no clearcoat property at all. Upgrade the instance first so
    // every property set below lands on a material that can actually express it.
    if (isBody && !(mat instanceof THREE.MeshPhysicalMaterial)){
      const physical = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(physical, mat);
      physical.name = mat.name;
      mat = physical;
    }
    const isHeadlight = /headlight|glsslight|\btail\b/.test(ctx);
    const isRim = /rim/.test(ctx);
    const isBrake = /brake|disc/.test(ctx);
    const isTire = /tire/.test(ctx);
    const isInterior = /alcntr|seat|dashboard|steering|interior|mirror/.test(ctx);
    const isChromeTrim = /laseralumobj|exhaust|plds|logo/.test(ctx);

    if (isGlass){
      mat.transparent = true;
      mat.opacity = Math.max(mat.opacity ?? 0.25, 0.22);
      mat.roughness = 0.04;
      mat.metalness = 0.1;
      mat.envMapIntensity = 2.2;
      mat.color = mat.color || new THREE.Color(0x0d1014);
      mat.color.lerp(new THREE.Color(0x10151c), 0.4);
      mat.depthWrite = false;
      mat.side = THREE.DoubleSide;
      node.renderOrder = 10;
      return mat;
    }

    if (isHeadlight){
      mat.envMapIntensity = 1.6;
      mat.roughness = Math.min(mat.roughness ?? 0.2, 0.18);
      mat.metalness = 0.3;
      if (!mat.emissive || mat.emissive.getHex() === 0){
        mat.emissive = new THREE.Color(0xbcdcff);
        mat.emissiveIntensity = 0.0; // turned on dynamically via headlightGlow controller
      }
      return mat;
    }

    if (isRim){
      mat.metalness = 0.9;
      mat.roughness = 0.35;
      mat.envMapIntensity = 1.0;
      return mat;
    }

    if (isBrake){
      mat.metalness = 0.85;
      mat.roughness = 0.35;
      mat.envMapIntensity = 1.3;
      return mat;
    }

    if (isTire){
      mat.metalness = 0.0;
      mat.roughness = 0.92;
      mat.envMapIntensity = 0.4;
      return mat;
    }

    if (isChromeTrim){
      mat.metalness = 1.0;
      mat.roughness = 0.12;
      mat.envMapIntensity = 2.0;
      return mat;
    }



    if (isInterior){
      mat.metalness = Math.min(mat.metalness ?? 0.2, 0.3);
      mat.roughness = Math.max(mat.roughness ?? 0.6, 0.55);
      mat.envMapIntensity = 0.8;
      return mat;
    }

    if (isBody){
      // Real automotive paint: a base coat + thin lacquer clearcoat, not a chrome mirror
      mat.metalness = 0.35;
      mat.roughness = 0.4;
      mat.envMapIntensity = 0.9;
      if ('clearcoat' in mat){
        mat.clearcoat = 0.6;
        mat.clearcoatRoughness = 0.25;
      }
      return mat;
    }

    // default catch-all: slight env boost for cohesion
    mat.envMapIntensity = mat.envMapIntensity ?? 1.0;
    return mat;
  }
}

// Collect headlight-ish materials so main.js can pulse their emissive intensity
export function collectHeadlightMaterials(car){
  const result = [];
  const seen = new Set();
  car.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const ctx = ((node.name || '') + ' ' + (node.parent?.name || '')).toLowerCase();
    if (/headlight|glsslight|\btail\b/.test(ctx)){
      mats.forEach((m) => {
        if (m && !seen.has(m.uuid)){
          seen.add(m.uuid);
          result.push(m);
        }
      });
    }
  });
  return result;
}

export function collectBodyMaterials(car){
  const result = [];
  const seen = new Set();
  car.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((m) => {
      if (!m) return;
      const ctx = ((node.name || '') + ' ' + (node.parent?.name || '') + ' ' + (m.name || '')).toLowerCase();
      const isBody = /body|bumper|skirt|spoiler|fgrll|grille|tailpiece|fin/.test(ctx);
      const isGlass = /glass|windshield|window/.test(ctx) || m.transparent;
      if (isBody && !isGlass){
        if (!seen.has(m.uuid)){
          seen.add(m.uuid);
          result.push(m);
        }
      }
    });
  });
  return result;
}
