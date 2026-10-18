// =============================================================
// ESCENARIO: Isla del volcán
// Primera fase del proyecto final: terreno + mar + volcán + luces.
// Basado en heightmap.js (generación del terreno) y en el estilo
// de Practica2-5.js / s3-cam1.js (cámara, materiales, iluminación).
// Todavía sin jugador ni cámara en 3ª persona: usamos OrbitControls
// para poder inspeccionar la isla mientras la diseñamos.
// =============================================================

var renderer, scene, camera;
var cameraControls;

// Datos del heightmap, guardados para poder consultar la altura del
// terreno en cualquier punto (lo necesitaremos en la siguiente fase
// para apoyar al personaje sobre el suelo, como en heightmap.js)
var hm_data = null, hm_width, hm_height;

// Parámetros de construcción de la isla (ajustables)
const scaleFactorXZ = 3.2;    // separación entre vértices en X/Z
const scaleFactorY = 0.85;    // cuánto se exagera la altura
const seaLevelY = 4;          // altura (en Y) a la que ponemos el plano de agua
const craterRadiusWorld = 60; // radio aprox. de la caldera, en unidades de mundo

// El pico del volcán está descentrado respecto al centro de la isla (igual
// que en una isla volcánica real). Estas coordenadas de mundo salen de la
// posición del pico usada al generar el heightmap (ver gen_terreno.py /
// combina_terreno2.py: peak_x=-0.08, peak_y=0.10, heightmap de 512x512)
const peakWorldX = 82;
const peakWorldZ = -66;

init();
loadScene();
render();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x8fd0ff)); // cielo despejado
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspectRatio, 1, 5000);
  camera.position.set(0, 650, 950);

  cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
  cameraControls.target.set(0, 100, 0);

  window.addEventListener('resize', updateAspectRatio);
}

// Igual que en heightmap.js: hay que pintar la imagen en un canvas
// para poder leer el valor de brillo de cada píxel
function getImagePixelData(image) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0, image.width, image.height);
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

function loadScene() {
  // Terreno a partir del heightmap. La altura sale del heightmap (en escala
  // de grises) y el color sale de una textura "horneada" (textura_isla.jpg)
  // generada a partir de ese mismo heightmap, mezclando arena/vegetación/roca
  // según la altura y la pendiente de cada zona (en vez de pintar a mano).
  const loader = new THREE.TextureLoader();
  loader.load('images/heightmap_isla.png', function (texture) {

    const width = texture.image.width;
    const height = texture.image.height;

    const geometry = new THREE.BufferGeometry();
    const numVertices = width * height;

    const vertices = new Float32Array(numVertices * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const uvs = new Float32Array(numVertices * 2);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const indices = [];
    for (let i = 0; i < height - 1; i++) {
      for (let j = 0; j < width - 1; j++) {
        const v0 = i * width + j;
        const v1 = (i + 1) * width + j;
        const v2 = (i + 1) * width + (j + 1);
        const v3 = i * width + (j + 1);

        indices.push(v0, v2, v1);
        indices.push(v0, v3, v2);
      }
    }
    geometry.setIndex(indices);

    const data = getImagePixelData(texture.image);

    hm_data = new Float32Array(numVertices);
    hm_width = width;
    hm_height = height;

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const index = i * width + j;
        const pixelIndex = index * 4;
        const brillo = data[pixelIndex]; // imagen en gris: r=g=b

        const worldX = (i - height / 2) * scaleFactorXZ;
        const worldZ = (j - width / 2) * scaleFactorXZ;
        const worldY = brillo * scaleFactorY;

        vertices[index * 3 + 0] = worldX;
        vertices[index * 3 + 1] = worldY;
        vertices[index * 3 + 2] = worldZ;
        hm_data[index] = worldY;

        // la textura horneada está en la misma rejilla que el heightmap,
        // así que el UV es directo (0..1), sin repetición
        uvs[index * 2 + 0] = j / (width - 1);
        uvs[index * 2 + 1] = 1 - i / (height - 1);
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    const texturaIsla = loader.load('images/textura_isla.jpg');
    // En versiones antiguas de three.js (las del curso) el espacio de color
    // de las texturas de color se marca así; si tu build ya usa colorSpace,
    // cambia la línea de abajo por: texturaIsla.colorSpace = THREE.SRGBColorSpace;
    if ('encoding' in texturaIsla) texturaIsla.encoding = THREE.sRGBEncoding;

    const material = new THREE.MeshLambertMaterial({ map: texturaIsla });
    const terreno = new THREE.Mesh(geometry, material);
    terreno.receiveShadow = true;
    scene.add(terreno);

    crearLavaCaldera();
  });

  crearMar();
  crearLuces();
}

// Disco de "lava" al fondo de la caldera: MeshBasicMaterial para que
// brille por sí mismo, igual que el Sol en s3-sistema-solar.js
function crearLavaCaldera() {
  const alturaCaldera = hm_altura(peakWorldX, peakWorldZ);

  const geometriaLava = new THREE.CircleGeometry(craterRadiusWorld * 0.55, 32);
  const materialLava = new THREE.MeshBasicMaterial({ color: 0xff5500 });
  const lava = new THREE.Mesh(geometriaLava, materialLava);
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(peakWorldX, alturaCaldera - 4, peakWorldZ);
  scene.add(lava);

  // Luz puntual para que la lava ilumine un poco su entorno de noche
  const luzLava = new THREE.PointLight(0xff6600, 1.2, 180);
  luzLava.position.set(peakWorldX, alturaCaldera + 10, peakWorldZ);
  scene.add(luzLava);
}

function crearMar() {
  const geometriaMar = new THREE.PlaneGeometry(1200, 1200, 1, 1);
  const materialMar = new THREE.MeshPhongMaterial({
    color: 0x1565c0,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    shininess: 80
  });
  const mar = new THREE.Mesh(geometriaMar, materialMar);
  mar.rotation.x = -Math.PI / 2;
  mar.position.y = seaLevelY;
  scene.add(mar);
}

function crearLuces() {
  const luzAmbiental = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(luzAmbiental);

  // "Sol": luz direccional, la usaremos en la siguiente fase para el
  // ciclo día/noche (moviéndola con una rotación, como en s3-sistema-solar.js)
  const sol = new THREE.DirectionalLight(0xfff3d6, 0.9);
  sol.position.set(300, 400, 200);
  scene.add(sol);
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// Altura del terreno en un punto del mundo (la usaremos para apoyar
// al personaje sobre el suelo, igual que hm_altura() en heightmap.js)
function hm_altura(worldX, worldZ) {
  if (hm_data == null) return 0;
  const i = Math.min(Math.max(Math.floor(worldX / scaleFactorXZ + hm_height / 2), 0), hm_height - 1);
  const j = Math.min(Math.max(Math.floor(worldZ / scaleFactorXZ + hm_width / 2), 0), hm_width - 1);
  return hm_data[i * hm_width + j];
}

function update() {
  cameraControls.update();
}

function render() {
  requestAnimationFrame(render);
  update();
  renderer.render(scene, camera);
}
