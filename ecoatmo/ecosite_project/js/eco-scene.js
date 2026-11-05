import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

(() => {
const host = document.querySelector('#eco-scene');
const canvas = document.querySelector('#eco-canvas');
const resetButton = document.querySelector('#eco-scene-reset');
if (!host || !canvas || !resetButton) return;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;

try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
} catch (error) {
    host.dataset.state = 'unavailable';
    console.error('The 3D landscape could not be initialized.', error);
    return;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
camera.position.set(7, 7, 9);
camera.lookAt(0, 1.05, 0);

scene.add(new THREE.HemisphereLight(0xe9f6f1, 0x536d57, 2.2));

const sunlight = new THREE.DirectionalLight(0xfff2d6, 3.2);
sunlight.position.set(-4, 8, 5);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024);
sunlight.shadow.camera.left = -7;
sunlight.shadow.camera.right = 7;
sunlight.shadow.camera.top = 7;
sunlight.shadow.camera.bottom = -7;
sunlight.shadow.bias = -0.0005;
scene.add(sunlight);

const world = new THREE.Group();
scene.add(world);
world.scale.setScalar(reducedMotion ? 1 : 0.82);
world.rotation.y = reducedMotion ? 0 : -0.42;

const material = (color, roughness = 0.8, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });

const grassMaterial = material(0x6da77a);
const darkGreenMaterial = material(0x326b48);
const leafMaterial = material(0x4c8b5b);
const lightLeafMaterial = material(0x77aa70);
const creamMaterial = material(0xf4f0dc);
const roofMaterial = material(0xd97b51);
const woodMaterial = material(0x916b4c);
const glassMaterial = material(0x75b9c5, 0.35, { metalness: 0.15 });

function addMesh(parent, geometry, meshMaterial, position, options = {}) {
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.position.set(...position);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    parent.add(mesh);
    return mesh;
}

const shoreline = addMesh(
    world,
    new THREE.TorusGeometry(2.62, 0.13, 12, 96),
    material(0x6bbbc0, 0.45),
    [0, -0.16, 0],
    { rotation: [-Math.PI / 2, 0, 0] }
);

addMesh(
    world,
    new THREE.CylinderGeometry(2.65, 2.35, 0.62, 80, 1),
    material(0x927c5d),
    [0, 0, 0]
);
addMesh(
    world,
    new THREE.CylinderGeometry(2.66, 2.66, 0.12, 80),
    grassMaterial,
    [0, 0.32, 0]
);

const riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.2, 0.385, 0.6),
    new THREE.Vector3(-1.45, 0.385, 0.34),
    new THREE.Vector3(-0.9, 0.385, 0.65),
    new THREE.Vector3(-0.05, 0.385, 0.42),
    new THREE.Vector3(0.7, 0.385, 0.55),
    new THREE.Vector3(1.35, 0.385, 0.12)
]);
addMesh(
    world,
    new THREE.TubeGeometry(riverCurve, 64, 0.075, 10, false),
    material(0x75c6cf, 0.38, { metalness: 0.08 }),
    [0, 0, 0],
    { castShadow: false }
);

const house = new THREE.Group();
house.position.set(-0.8, 0.38, -0.58);
world.add(house);
addMesh(house, new THREE.BoxGeometry(0.92, 0.72, 0.82), creamMaterial, [0, 0.36, 0]);
const roof = addMesh(house, new THREE.ConeGeometry(0.72, 0.58, 4), roofMaterial, [0, 1.0, 0]);
roof.rotation.y = Math.PI / 4;
addMesh(house, new THREE.BoxGeometry(0.2, 0.38, 0.035), woodMaterial, [0, 0.2, 0.43]);
addMesh(house, new THREE.BoxGeometry(0.2, 0.18, 0.035), glassMaterial, [-0.28, 0.46, 0.43]);
addMesh(house, new THREE.BoxGeometry(0.2, 0.18, 0.035), glassMaterial, [0.28, 0.46, 0.43]);

const solarArray = new THREE.Group();
solarArray.position.set(1.15, 0.43, -1.05);
solarArray.rotation.x = -0.28;
world.add(solarArray);
addMesh(solarArray, new THREE.BoxGeometry(1.05, 0.055, 0.74), material(0x315e78, 0.38, { metalness: 0.28 }), [0, 0.28, 0]);
const solarLineMaterial = material(0xb9d8d8, 0.38, { metalness: 0.2 });
for (const x of [-0.25, 0, 0.25]) {
    addMesh(solarArray, new THREE.BoxGeometry(0.012, 0.012, 0.68), solarLineMaterial, [x, 0.315, 0], { castShadow: false });
}
addMesh(solarArray, new THREE.BoxGeometry(1.0, 0.012, 0.012), solarLineMaterial, [0, 0.315, 0], { castShadow: false });
for (const x of [-0.38, 0.38]) {
    addMesh(solarArray, new THREE.BoxGeometry(0.045, 0.32, 0.045), woodMaterial, [x, 0.12, 0]);
}

function addTree(x, z, scale = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.37, z);
    tree.scale.setScalar(scale);
    world.add(tree);
    addMesh(tree, new THREE.CylinderGeometry(0.09, 0.13, 0.58, 7), woodMaterial, [0, 0.29, 0]);
    addMesh(tree, new THREE.ConeGeometry(0.48, 0.82, 7), leafMaterial, [0, 0.86, 0]);
    addMesh(tree, new THREE.ConeGeometry(0.36, 0.68, 7), lightLeafMaterial, [0, 1.3, 0]);
    return tree;
}

addTree(-1.9, -0.65, 0.95);
addTree(-1.75, 0.78, 0.72);
addTree(0.12, 1.65, 0.86);
addTree(1.95, 0.78, 0.78);
addTree(0.9, -1.95, 0.66);

const turbine = new THREE.Group();
turbine.position.set(1.72, 0.38, 0.18);
world.add(turbine);
addMesh(turbine, new THREE.CylinderGeometry(0.035, 0.075, 1.92, 10), creamMaterial, [0, 0.96, 0]);
const rotor = new THREE.Group();
rotor.position.set(0, 1.95, 0);
turbine.add(rotor);
addMesh(rotor, new THREE.SphereGeometry(0.13, 16, 12), roofMaterial, [0, 0, 0]);
for (let index = 0; index < 3; index += 1) {
    const bladePivot = new THREE.Group();
    bladePivot.rotation.z = index * (Math.PI * 2 / 3);
    rotor.add(bladePivot);
    addMesh(bladePivot, new THREE.BoxGeometry(0.12, 0.93, 0.07), creamMaterial, [0, 0.52, 0]);
}

const clouds = new THREE.Group();
scene.add(clouds);

function addCloud(x, y, z, scale) {
    const cloud = new THREE.Group();
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    clouds.add(cloud);
    const cloudMaterial = material(0xf6faf6, 1);
    addMesh(cloud, new THREE.SphereGeometry(0.32, 16, 12), cloudMaterial, [-0.22, 0, 0], { castShadow: false });
    addMesh(cloud, new THREE.SphereGeometry(0.42, 16, 12), cloudMaterial, [0.12, 0.06, 0], { castShadow: false });
    addMesh(cloud, new THREE.SphereGeometry(0.28, 16, 12), cloudMaterial, [0.43, -0.02, 0], { castShadow: false });
    return cloud;
}

const cloudOne = addCloud(-3.1, 3.35, -1.2, 0.8);
const cloudTwo = addCloud(2.8, 4.15, -1.8, 0.58);

const sun = addMesh(scene, new THREE.SphereGeometry(0.38, 24, 18), material(0xeabf60, 0.6), [3.6, 3.35, -2.7], { castShadow: false });
sun.scale.set(1, 1, 0.25);

const pointer = { active: false, id: null, x: 0, y: 0 };
const rotationTarget = { x: 0, y: 0 };
let frameStart = performance.now();

function resizeScene() {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resizeScene);
resizeObserver.observe(host);
resizeScene();

canvas.addEventListener('pointerdown', event => {
    pointer.active = true;
    pointer.id = event.pointerId;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    host.dataset.dragging = 'true';
});

canvas.addEventListener('pointermove', event => {
    if (!pointer.active || event.pointerId !== pointer.id) return;
    const changeX = event.clientX - pointer.x;
    const changeY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    rotationTarget.y += changeX * 0.008;
    rotationTarget.x = THREE.MathUtils.clamp(rotationTarget.x + changeY * 0.005, -0.42, 0.42);
});

function endDrag(event) {
    if (!pointer.active || event.pointerId !== pointer.id) return;
    pointer.active = false;
    pointer.id = null;
    delete host.dataset.dragging;
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

resetButton.addEventListener('pointerdown', event => event.stopPropagation());
resetButton.addEventListener('click', () => {
    rotationTarget.x = 0;
    rotationTarget.y = 0;
});

function animate(now) {
    requestAnimationFrame(animate);
    const elapsed = now - frameStart;
    const introProgress = reducedMotion ? 1 : Math.min(elapsed / 1200, 1);
    const ease = 1 - Math.pow(1 - introProgress, 3);
    world.scale.setScalar(reducedMotion ? 1 : 0.82 + 0.18 * ease);
    world.rotation.y += ((-0.42 * (1 - ease)) + rotationTarget.y - world.rotation.y) * 0.055;
    world.rotation.x += (rotationTarget.x - world.rotation.x) * 0.055;

    rotor.rotation.z -= reducedMotion ? 0.006 : 0.018;

    if (!reducedMotion) {
        cloudOne.position.x += 0.0015;
        cloudTwo.position.x -= 0.001;
        if (cloudOne.position.x > 4.2) cloudOne.position.x = -4.2;
        if (cloudTwo.position.x < -4.2) cloudTwo.position.x = 4.2;
    }

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);
})();