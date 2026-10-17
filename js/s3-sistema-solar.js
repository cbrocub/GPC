// Variables globales
var renderer, scene, camera;
var cameraControls;

// Objetos del sistema solar
var sol, tierra, luna;

// Ángulos para los movimientos
var anguloTierraOrbit = 0;
var anguloTierraSpin = 0;
var anguloLunaOrbit = 0;

// 1- Inicializa
init();
// 2- Crea la escena
loadScene();
// 3- Renderiza
render();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x000000));
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.1, 100);
  camera.position.set(10, 20, 30);

  cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
  cameraControls.target.set(0, 0, 0);

  window.addEventListener('resize', updateAspectRatio);
}

function loadScene() {
  // Sol (fijo en el origen)
  sol = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
  );
  scene.add(sol);

  // Tierra (se añade directamente a la escena, NO al sol)
  tierra = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0fa0, wireframe: true })
  );
  scene.add(tierra);

  // Luna (se añade directamente a la escena, NO a la tierra)
  luna = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true })
  );
  scene.add(luna);

  // Desactivar la actualización automática de matrices para controlar la transformación mediante composes explícitos
  sol.matrixAutoUpdate = false;
  tierra.matrixAutoUpdate = false;
  luna.matrixAutoUpdate = false;

  scene.add(new THREE.AxesHelper(15));
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update() {
  // Actualización de la cámara con el ratón
  cameraControls.update();

  // Incremento de ángulos (velocidad de rotación propia distinta a la orbital)
  anguloTierraOrbit += 0.01;
  anguloTierraSpin += 0.05;
  anguloLunaOrbit += 0.03;

  // 1. Matriz para el Sol (Fijo en el origen)
  sol.matrix.identity();

  // 2. Matriz para la Tierra:
  // M_tierra = Rotación_Órbita_Sol * Traslación_Distancia_Sol * Rotación_Eje_Propio
  var R_orbit_E = new THREE.Matrix4().makeRotationY(anguloTierraOrbit);  // Rotación de la Tierra alrededor del Sol 3ª
  var T_orbit_E = new THREE.Matrix4().makeTranslation(12, 0, 0); // Distancia Sol - Tierra 2ª
  var R_spin_E  = new THREE.Matrix4().makeRotationY(anguloTierraSpin); // Rotación propia de la Tierra 1ª

  var M_tierra = new THREE.Matrix4();
  M_tierra.multiply(R_orbit_E);
  M_tierra.multiply(T_orbit_E);
  M_tierra.multiply(R_spin_E);

  tierra.matrix.copy(M_tierra);

  // 3. Matriz para la Luna:
  // M_luna = Rotación_Órbita_Sol * Traslación_Distancia_Sol * Rotación_Órbita_Tierra * Traslación_Distancia_Tierra
  var R_orbit_M = new THREE.Matrix4().makeRotationY(anguloLunaOrbit);
  var T_orbit_M = new THREE.Matrix4().makeTranslation(2.5, 0, 0); // Distancia Tierra - Luna

  var M_luna = new THREE.Matrix4();
  M_luna.multiply(R_orbit_E);
  M_luna.multiply(T_orbit_E);
  M_luna.multiply(R_orbit_M);
  M_luna.multiply(T_orbit_M);

  luna.matrix.copy(M_luna);
}

function render() {
  requestAnimationFrame(render);
  update();
  renderer.render(scene, camera);
}