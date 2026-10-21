// =============================================================
// ESCENARIO: Isla del volcán
// Terreno + mar + volcán + luces + puerto/poblado + personaje.
// Basado en heightmap.js (generación del terreno) y en el estilo
// de Practica2-5.js / s3-cam1.js (cámara, materiales, iluminación).
// El personaje (Jugador) vive en personaje.js
// =============================================================

var renderer, scene, camera;
var cameraControls;

// Datos del heightmap, guardados para poder consultar la altura del
// terreno en cualquier punto (apoya al personaje sobre el suelo)
var hm_data = null, hm_width, hm_height;

// Parámetros de construcción de la isla (ajustables)
const scaleFactorXZ = 3.2;    // separación entre vértices en X/Z
const scaleFactorY = 0.85;    // cuánto se exagera la altura
const seaLevelY = 4;          // altura (en Y) a la que ponemos el plano de agua
const craterRadiusWorld = 60; // radio aprox. de la caldera, en unidades de mundo

// El pico del volcán está descentrado respecto al centro de la isla.
// Coordenadas de mundo a partir de la posición del pico del heightmap
const peakWorldX = 82;
const peakWorldZ = -66;

// reloj animaciones
var reloj = new THREE.Clock();

// Haz giratorio del faro (se anima en update)
var faroHaz = null;

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
  camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.5, 5000);
  camera.position.set(0, 650, 950);

  //cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
  //cameraControls.target.set(0, 100, 0);

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

        // la textura horneada está en la misma rejilla que el heightmap
        uvs[index * 2 + 0] = j / (width - 1);
        uvs[index * 2 + 1] = 1 - i / (height - 1);
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    // Textura de alta resolución (4096x4096): evita el pixelado al caminar
    const texturaIsla = loader.load('images/textura_isla_4k.jpg');
    texturaIsla.generateMipmaps = true;
    texturaIsla.minFilter = THREE.LinearMipmapLinearFilter;
    texturaIsla.magFilter = THREE.LinearFilter;
    texturaIsla.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // Si tu build ya usa colorSpace, cambia la línea de abajo por:
    // texturaIsla.colorSpace = THREE.SRGBColorSpace;
    if ('encoding' in texturaIsla) texturaIsla.encoding = THREE.sRGBEncoding;

    const material = new THREE.MeshLambertMaterial({ map: texturaIsla });
    const terreno = new THREE.Mesh(geometry, material);
    terreno.receiveShadow = true;
    scene.add(terreno);

    crearLavaCaldera();

    // --- Puerto, casas, edificios, faro, cajas y árboles (con colisiones) ---
    var puerto = crearPoblado();

    // --- Personaje ---
    // El suelo es el terreno + cubiertas del embarcadero/muelle
    Jugador.cfg.funcionAltura = alturaSuelo;
    // Colisiones con obstáculos y límite del agua profunda
    Jugador.cfg.radioJugador = 0.4;
    Jugador.cfg.resolverColision = resolverColision;
    // Punto de aparición: junto al arranque del muelle de hormigón
    Jugador.cfg.posicionInicial = { x: puerto.spawn.x, z: puerto.spawn.z };

    Jugador.cargar(scene, camera, renderer.domElement, function (j) {
      // Mirando hacia el poblado (rotado 180 grados), con la cámara detrás
      j.raiz.rotation.y = puerto.giro + Math.PI;
      j.yawCam = Math.atan2(puerto.ux, puerto.uz); // Invertimos los signos para girar la cámara
      j._actualizarCamara(1000, true);
      console.log('Jugador cargado correctamente en la isla.');
    });
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

  // "Sol": luz direccional (para el ciclo día/noche en la siguiente fase)
  const sol = new THREE.DirectionalLight(0xfff3d6, 0.9);
  sol.position.set(300, 400, 200);
  scene.add(sol);
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// Altura del terreno en un punto del mundo (interpolación bilineal)
function hm_altura(worldX, worldZ) {
  if (hm_data == null) return 0;
  const fi = Math.min(Math.max(worldX / scaleFactorXZ + hm_height / 2, 0), hm_height - 1.001);
  const fj = Math.min(Math.max(worldZ / scaleFactorXZ + hm_width / 2, 0), hm_width - 1.001);
  const i = Math.floor(fi), j = Math.floor(fj);
  const ti = fi - i, tj = fj - j;
  const h00 = hm_data[i * hm_width + j];
  const h01 = hm_data[i * hm_width + j + 1];
  const h10 = hm_data[(i + 1) * hm_width + j];
  const h11 = hm_data[(i + 1) * hm_width + j + 1];
  return (h00 * (1 - tj) + h01 * tj) * (1 - ti) + (h10 * (1 - tj) + h11 * tj) * ti;
}

function update() {
  var delta = reloj.getDelta();

  // El haz del faro gira
  if (faroHaz) faroHaz.rotation.y += delta * 0.7;

  // Si el jugador ya terminó de cargar, actualizamos su posición y animaciones
  if (Jugador && Jugador.listo) {
    Jugador.actualizar(delta);
  }
}

function render() {
  requestAnimationFrame(render);
  update();
  renderer.render(scene, camera);
}


// ============================================================================
//  COLISIONES Y SUELO
//   - colisionadores: círculos (árboles, faro, barriles) y cajas orientadas
//     en el plano XZ (casas, edificios, pilas de cajas, barandillas)
//   - plataformas: rectángulos con altura propia (cubiertas del embarcadero
//     y del muelle) para poder caminar sobre el agua
//   - agua profunda: no se puede entrar (salvo sobre una plataforma)
// ============================================================================
var colisionadores = [];
var plataformas = [];
var PROFUNDIDAD_MAX = 0.7;   // hasta qué profundidad se puede vadear

function registrarCirculo(x, z, r) {
  colisionadores.push({ tipo: 'c', x: x, z: z, r: r });
}

// Caja orientada: centro (x,z), giro (rotation.y del objeto), semiejes hx (local X) y hz (local Z)
function registrarCaja(x, z, giro, hx, hz) {
  colisionadores.push({ tipo: 'o', x: x, z: z, hx: hx, hz: hz, c: Math.cos(giro), s: Math.sin(giro) });
}

function registrarPlataforma(x, z, giro, hx, hz, y) {
  plataformas.push({ x: x, z: z, hx: hx, hz: hz, c: Math.cos(giro), s: Math.sin(giro), y: y });
}

function dentroPlataforma(p, x, z) {
  var dx = x - p.x, dz = z - p.z;
  var lx = dx * p.c - dz * p.s;
  var lz = dx * p.s + dz * p.c;
  return Math.abs(lx) <= p.hx && Math.abs(lz) <= p.hz;
}

function sobrePlataforma(x, z) {
  for (var i = 0; i < plataformas.length; i++) {
    if (dentroPlataforma(plataformas[i], x, z)) return true;
  }
  return false;
}

// Altura del suelo: terreno o cubierta (lo que sea más alto)
function alturaSuelo(x, z) {
  var h = hm_altura(x, z);
  for (var i = 0; i < plataformas.length; i++) {
    var p = plataformas[i];
    if (p.y > h && dentroPlataforma(p, x, z)) h = p.y;
  }
  return h;
}

function esTransitable(x, z) {
  return hm_altura(x, z) > seaLevelY - PROFUNDIDAD_MAX || sobrePlataforma(x, z);
}

// Llamada por Jugador tras cada movimiento. Corrige pos.x / pos.z
function resolverColision(pos, xAnt, zAnt, R) {

  // 1) Agua profunda: deslizar por un eje o quedarse donde estaba
  if (!esTransitable(pos.x, pos.z)) {
    if (esTransitable(pos.x, zAnt)) pos.z = zAnt;
    else if (esTransitable(xAnt, pos.z)) pos.x = xAnt;
    else { pos.x = xAnt; pos.z = zAnt; }
  }

  // 2) Obstáculos (2 pasadas para esquinas con varios obstáculos)
  for (var pasada = 0; pasada < 2; pasada++) {
    for (var i = 0; i < colisionadores.length; i++) {
      var o = colisionadores[i];

      if (o.tipo === 'c') {
        var dx = pos.x - o.x, dz = pos.z - o.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        var m = o.r + R;
        if (d < m) {
          if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
          pos.x += (dx / d) * (m - d);
          pos.z += (dz / d) * (m - d);
        }
      } else {
        // Pasar al sistema local de la caja
        var ddx = pos.x - o.x, ddz = pos.z - o.z;
        var lx = ddx * o.c - ddz * o.s;
        var lz = ddx * o.s + ddz * o.c;
        // Punto de la caja más cercano al jugador
        var cx = Math.max(-o.hx, Math.min(o.hx, lx));
        var cz = Math.max(-o.hz, Math.min(o.hz, lz));
        var ex = lx - cx, ez = lz - cz;
        var d2 = ex * ex + ez * ez;
        if (d2 >= R * R) continue;

        var nlx, nlz;
        if (d2 > 1e-9) {
          var dd = Math.sqrt(d2);
          nlx = cx + (ex / dd) * R;
          nlz = cz + (ez / dd) * R;
        } else {
          // Dentro de la caja: salir por la cara más cercana
          var px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
          if (px < pz) { nlx = (lx >= 0 ? o.hx + R : -o.hx - R); nlz = lz; }
          else         { nlz = (lz >= 0 ? o.hz + R : -o.hz - R); nlx = lx; }
        }
        // Volver a coordenadas de mundo
        pos.x = o.x + nlx * o.c + nlz * o.s;
        pos.z = o.z - nlx * o.s + nlz * o.c;
      }
    }
  }

  // 3) Si el empujón nos ha metido en agua profunda, volver atrás
  if (!esTransitable(pos.x, pos.z)) { pos.x = xAnt; pos.z = zAnt; }
}

var texLoader = new THREE.TextureLoader();

// Función auxiliar para cargar texturas y que se repitan (tiling)
function cargarTex(ruta, repX, repY) {
  var tex = texLoader.load(ruta);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repX && repY) tex.repeat.set(repX, repY);
  return tex;
}

// ============================================================================
//  MATERIALES COMPARTIDOS Y AYUDANTES (solo primitivas de three.js)
// ============================================================================
var MAT = {
  maderaA:   new THREE.MeshLambertMaterial({ map: cargarTex('textures/Wood01_Color.jpg', 1, 1) }),
  maderaB:   new THREE.MeshLambertMaterial({ map: cargarTex('textures/Wood01_Color.jpg', 1, 1) }),
  maderaOsc: new THREE.MeshLambertMaterial({ map: cargarTex('textures/WoodDark_Color.jpg', 1, 1) }),
  caja:      new THREE.MeshLambertMaterial({ map: cargarTex('textures/Box_Color.jpg', 1, 1) }),
  hormigon:  new THREE.MeshLambertMaterial({ map: cargarTex('textures/Concrete01_Color.jpg', 2, 2) }),
  hormigonOsc: new THREE.MeshLambertMaterial({ map: cargarTex('textures/Concrete02_Color.jpg', 2, 2) }),
  edificio:  new THREE.MeshLambertMaterial({ map: cargarTex('textures/Plaster01_Color.jpg', 2, 2) }),
  pared:     new THREE.MeshLambertMaterial({ map: cargarTex('textures/Bricks01_Color.jpg', 2, 2) }),
  tejado:    new THREE.MeshLambertMaterial({ map: cargarTex('textures/Roof01_Color.jpg', 3, 3) }),
  ladrillo:  new THREE.MeshLambertMaterial({ map: cargarTex('textures/Bricks02_Color.jpg', 1, 1) }),
  muralla:   new THREE.MeshLambertMaterial({ map: cargarTex('textures/StoneWall01_Color.jpg', 4, 2) }), // Nuevo material
  piedra:    new THREE.MeshLambertMaterial({ map: cargarTex('textures/StoneWall01_Color.jpg', 2, 2) }),      // Nuevo material
  puerta:    new THREE.MeshLambertMaterial({ color: 0x5a3a22 }), // Sin textura (opcional)
  cristal:   new THREE.MeshPhongMaterial({ color: 0x7fb7d9, shininess: 90 }),
  metal:     new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 40 }),
  goma:      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  amarillo:  new THREE.MeshLambertMaterial({ color: 0xe0b400 }),
  barril:    new THREE.MeshLambertMaterial({ map: cargarTex('textures/Wood01_Color.jpg', 1, 1) }),
  blanco:    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  rojoFaro:  new THREE.MeshLambertMaterial({ color: 0xc0281e }),
  cristalFaro: new THREE.MeshPhongMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45, shininess: 100 }),
  luzFaro:   new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
  haz:       new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  tronco:    new THREE.MeshLambertMaterial({ map: cargarTex('textures/Bark01_Color.jpg', 1, 2) }),
  hojaPino:  new THREE.MeshLambertMaterial({ color: 0x2e6b3a, flatShading: true }),
  hojaA:     new THREE.MeshLambertMaterial({ color: 0x5a9e3c, flatShading: true }),
  hojaB:     new THREE.MeshLambertMaterial({ color: 0x6fb04a, flatShading: true }),
  telaRoja:  new THREE.MeshLambertMaterial({ color: 0xcc3333, side: THREE.DoubleSide }),
  telaAzul:  new THREE.MeshLambertMaterial({ color: 0x3366cc, side: THREE.DoubleSide }),
  oro:       new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 })
};

// Generador pseudoaleatorio con semilla: el reparto es siempre el mismo,
// así podemos revisar la distribución sin que cambie al recargar
var _semilla = 20241005;
function rnd() {
  var t = (_semilla += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function caja(ancho, alto, fondo, material, x, y, z) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material);
  m.position.set(x, y, z);
  m.castShadow = true;  m.receiveShadow = true;
  return m;
}

function cilindro(rSup, rInf, alto, material, x, y, z, segmentos) {
  var m = new THREE.Mesh(new THREE.CylinderGeometry(rSup, rInf, alto, segmentos || 12), material);
  m.position.set(x, y, z);
  m.castShadow = true;  m.receiveShadow = true;
  return m;
}

function pendienteEn(x, z) {
  var dx = hm_altura(x + 2, z) - hm_altura(x - 2, z);
  var dz = hm_altura(x, z + 2) - hm_altura(x, z - 2);
  return Math.sqrt(dx * dx + dz * dz) / 4;
}


// ============================================================================
//  MUELLE DE HORMIGÓN (con bolardos y defensas de neumático)
//  Origen en el extremo de tierra; se extiende hacia +Z
// ============================================================================
function crearMuelleHormigon(largo, ancho, alto) {
  var g = new THREE.Object3D();

  // Bloque macizo (hundido 1.5 bajo el agua)
  g.add(caja(ancho, alto + 1.5, largo, MAT.hormigon, 0, (alto - 1.5) / 2, largo / 2));

  // Franjas amarillas de seguridad en los bordes
  [-1, 1].forEach(function (lado) {
    g.add(caja(0.3, 0.04, largo, MAT.amarillo, lado * (ancho / 2 - 0.2), alto + 0.02, largo / 2));
  });

  // Bolardos y defensas (toros negros) en los laterales
  for (var z = 1.5; z < largo; z += 3) {
    [-1, 1].forEach(function (lado) {
      g.add(cilindro(0.18, 0.22, 0.5, MAT.metal, lado * (ancho / 2 - 0.6), alto + 0.25, z, 10));

      var defensa = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 8, 16), MAT.goma);
      defensa.rotation.y = Math.PI / 2;
      defensa.position.set(lado * (ancho / 2 + 0.1), alto - 0.6, z);
      defensa.castShadow = true;
      g.add(defensa);
    });
  }
  return g;
}

// ============================================================================
//  MURALLAS Y TORRES
// ============================================================================
function crearTramoMuralla(ancho, alto, fondo) {
  var g = new THREE.Object3D();
  // Cuerpo principal de la muralla
  g.add(caja(ancho, alto, fondo, MAT.muralla, 0, alto / 2, 0));
  
  // Almenas superiores (para dar aspecto de fortificación)
  var numAlmenas = Math.floor(ancho / 2);
  for (var i = 0; i < numAlmenas; i++) {
    var x = -ancho / 2 + 1 + i * (ancho / numAlmenas);
    // Almenas hacia el exterior y el interior
    g.add(caja(1.2, 1, 0.6, MAT.muralla, x, alto + 0.5, fondo/2 - 0.3));
    g.add(caja(1.2, 1, 0.6, MAT.muralla, x, alto + 0.5, -fondo/2 + 0.3));
  }
  // Pasillo de ronda de madera
  g.add(caja(ancho, 0.2, fondo - 1.2, MAT.maderaOsc, 0, alto, 0));
  return g;
}

function crearTorreMuralla(radio, alto) {
  var g = new THREE.Object3D();
  // Torre cilíndrica
  g.add(cilindro(radio, radio + 0.5, alto, MAT.muralla, 0, alto / 2, 0, 16));
  
  // Almenas de la torre
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4;
    g.add(caja(1.2, 1.2, 1.2, MAT.muralla, Math.cos(a) * (radio - 0.4), alto + 0.6, Math.sin(a) * (radio - 0.4)));
  }
  // Suelo interior de la torre
  g.add(cilindro(radio - 0.2, radio - 0.2, 0.2, MAT.maderaOsc, 0, alto, 0, 16));
  return g;
}

// ============================================================================
//  CAJAS Y BARRILES
// ============================================================================
var LADO_CAJA = 1.1;

function crearCaja(lado) {
  var g = new THREE.Object3D();
  g.add(caja(lado, lado, lado, MAT.caja, 0, 0, 0));
  // 4 montantes en las esquinas verticales
  var o = lado / 2;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (e) {
    g.add(caja(0.1, lado + 0.02, 0.1, MAT.maderaOsc, e[0] * o, 0, e[1] * o));
  });
  // listones (frente y fondo)
  [-1, 1].forEach(function (cara) {
    g.add(caja(lado, 0.1, 0.04, MAT.maderaB, 0, 0, cara * (o + 0.01)));
  });
  return g;
}

// Pila piramidal: nx cajas en X; el nivel k tiene (nz - k) cajas en Z.
// (lx, lz) = centro de la base; yBase = altura de la superficie donde apoya.
function anadirPilaCajas(grupo, lx, lz, nx, nz, niveles, yBase) {
  var t = LADO_CAJA;
  for (var k = 0; k < niveles; k++) {
    var cnt = Math.max(1, nz - k);
    for (var i = 0; i < cnt; i++) {
      for (var j = 0; j < nx; j++) {
        var c = crearCaja(t);
        c.position.set(lx + (j - (nx - 1) / 2) * t,
                       yBase + t / 2 + k * t,
                       lz + (i - (cnt - 1) / 2) * t);
        c.rotation.y = (rnd() - 0.5) * 0.12;
        grupo.add(c);
      }
    }
  }
}

function crearBarril() {
  var g = new THREE.Object3D();
  g.add(cilindro(0.4, 0.4, 1.0, MAT.barril, 0, 0.5, 0, 14));
  [0.2, 0.8].forEach(function (y) {
    g.add(cilindro(0.42, 0.42, 0.06, MAT.metal, 0, y, 0, 14));
  });
  return g;
}


// ============================================================================
//  CASA con tejado a dos aguas (frente hacia +Z)
//  El tejado es un prisma triangular = cilindro de 3 lados, tumbado y escalado
// ============================================================================
function crearCasa(ancho, fondo, alto, colorPared) {
  var g = new THREE.Object3D();

  var matPared = MAT.pared.clone();
  if (colorPared !== undefined) matPared.color.setHex(colorPared);

  g.add(caja(ancho, alto, fondo, matPared, 0, alto / 2, 0));
  g.add(caja(ancho + 0.1, 0.4, fondo + 0.1, MAT.hormigon, 0, 0.2, 0));

  var altoTejado = ancho * 0.45;
  var geoTejado = new THREE.CylinderGeometry(1, 1, 1, 3);
  geoTejado.rotateX(-Math.PI / 2);
  var tejado = new THREE.Mesh(geoTejado, MAT.tejado);
  tejado.scale.set((ancho + 0.6) / 1.732, altoTejado / 1.5, fondo + 0.6);
  tejado.position.y = alto + altoTejado / 3;
  tejado.castShadow = true;  tejado.receiveShadow = true;
  g.add(tejado);

  // Chimenea
  g.add(caja(0.5, 1.4, 0.5, MAT.ladrillo, ancho * 0.25, alto + altoTejado * 0.6, -fondo * 0.2));

  // Puerta y escalón
  g.add(caja(1.0, 1.8, 0.1, MAT.puerta, 0, 0.95, fondo / 2 + 0.03));
  g.add(caja(1.4, 0.15, 0.6, MAT.hormigon, 0, 0.075, fondo / 2 + 0.3));

  // Ventanas (marco + cristal)
  function ventana(x, y, z, girada) {
    var w = girada ? 0.08 : 1.0, d = girada ? 1.0 : 0.08;
    g.add(caja(w, 0.9, d, MAT.maderaOsc, x, y, z));
    var w2 = girada ? 0.1 : 0.8, d2 = girada ? 0.8 : 0.1;
    g.add(caja(w2, 0.7, d2, MAT.cristal, x, y, z));
  }
  var yV = alto * 0.6;
  ventana(-ancho * 0.28, yV, fondo / 2 + 0.03, false);
  ventana( ancho * 0.28, yV, fondo / 2 + 0.03, false);
  ventana(-ancho / 2 - 0.03, yV, 0, true);
  ventana( ancho / 2 + 0.03, yV, 0, true);

  return g;
}


// ============================================================================
//  EDIFICIO de hormigón con rejilla de ventanas y azotea
// ============================================================================
function crearEdificio(ancho, fondo, pisos) {
  var g = new THREE.Object3D();
  var altoPiso = 3, alto = pisos * altoPiso;

  g.add(caja(ancho, alto, fondo, MAT.edificio, 0, alto / 2, 0));

  var colsFrente = Math.max(2, Math.floor(ancho / 2.2));
  var colsLado   = Math.max(2, Math.floor(fondo / 2.2));
  for (var p = 0; p < pisos; p++) {
    var y = p * altoPiso + 1.8;
    for (var c = 0; c < colsFrente; c++) {
      var x = (c + 0.5) * (ancho / colsFrente) - ancho / 2;
      if (p > 0) g.add(caja(1.0, 1.2, 0.1, MAT.cristal, x, y,  fondo / 2 + 0.02));  // la planta baja lleva puerta
      g.add(caja(1.0, 1.2, 0.1, MAT.cristal, x, y, -fondo / 2 - 0.02));
    }
    for (var k = 0; k < colsLado; k++) {
      var z = (k + 0.5) * (fondo / colsLado) - fondo / 2;
      g.add(caja(0.1, 1.2, 1.0, MAT.cristal,  ancho / 2 + 0.02, y, z));
      g.add(caja(0.1, 1.2, 1.0, MAT.cristal, -ancho / 2 - 0.02, y, z));
    }
  }

  g.add(caja(1.8, 2.3, 0.12, MAT.puerta, 0, 1.15, fondo / 2 + 0.03));

  // Cornisa y cuarto de máquinas en la azotea
  g.add(caja(ancho + 0.4, 0.3, fondo + 0.4, MAT.hormigonOsc, 0, alto + 0.15, 0));
  g.add(caja(ancho * 0.3, 1.2, fondo * 0.3, MAT.hormigon, ancho * 0.2, alto + 0.9, 0));

  return g;
}


// ============================================================================
//  FARO: torre cónica a franjas, galería con barandilla, linterna y haz de luz
// ============================================================================
// Material de haz de luz: se desvanece en los bordes (efecto fresnel) y con la distancia
function crearMaterialHaz(intensidad, largo) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color:      { value: new THREE.Color(0xfff2a0) },
      intensidad: { value: intensidad },
      largo:      { value: largo }
    },
    vertexShader: [
      'varying float vAlong;',
      'varying vec3 vNormal;',
      'varying vec3 vView;',
      'uniform float largo;',
      'void main() {',
      '  vAlong = position.x / largo;',                       // 0 en la lampara, 1 en el extremo
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vView = normalize(-mv.xyz);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 color;',
      'uniform float intensidad;',
      'varying float vAlong;',
      'varying vec3 vNormal;',
      'varying vec3 vView;',
      'void main() {',
      '  float borde = abs(dot(normalize(vNormal), normalize(vView)));',
      '  borde = pow(borde, 2.5);',                            // bordes suaves: sin silueta dura
      '  float dist = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.6);', // mas intensa cerca de la lampara
      '  float punta = smoothstep(0.0, 0.06, vAlong);',        // evita un punto quemado en el origen
      '  gl_FragColor = vec4(color * intensidad * borde * dist * punta, 1.0);',
      '}'
    ].join('\n'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function crearHaz(largo, radio) {
  var haz = new THREE.Object3D();

  // 3 capas concentricas: ancha y tenue + media + estrecha y brillante
  var capas = [
    { r: 1.00, k: 0.45 },
    { r: 0.55, k: 0.60 },
    { r: 0.25, k: 0.90 }
  ];

  capas.forEach(function (c) {
    var geo = new THREE.ConeGeometry(radio * c.r, largo, 32, 1, true);
    geo.rotateZ(Math.PI / 2);         // vertice hacia -X, base hacia +X
    geo.translate(largo / 2, 0, 0);   // vertice en el origen
    var mat = crearMaterialHaz(c.k, largo);

    var m1 = new THREE.Mesh(geo, mat);
    var m2 = m1.clone();
    m2.rotation.y = Math.PI;          // segundo haz, opuesto
    haz.add(m1);
    haz.add(m2);
  });
  return haz;
}

function crearFaro() {
  var g = new THREE.Object3D();

  // Basamento
  g.add(cilindro(2.4, 3.0, 1.5, MAT.hormigonOsc, 0, 0.75, 0, 20));

  // Torre: 4 tramos troncocónicos alternando blanco y rojo
  var y = 1.5, rBase = 2.4, afinado = 0.17, altoTramo = 3.2;
  function radioEn(yy) { return rBase - (yy - 1.5) / altoTramo * afinado; }
  for (var k = 0; k < 4; k++) {
    g.add(cilindro(radioEn(y + altoTramo), radioEn(y), altoTramo,
                   (k % 2) ? MAT.rojoFaro : MAT.blanco, 0, y + altoTramo / 2, 0, 20));
    y += altoTramo;
  }
  // y = parte alta de la torre

  // Puerta y ventanas hacia +Z (el mar)
  g.add(caja(1.0, 2.0, 0.3, MAT.puerta, 0, 2.5, radioEn(2.5)));
  [6.5, 10.5].forEach(function (yy) {
    g.add(caja(0.5, 0.9, 0.2, MAT.cristal, 0, yy, radioEn(yy) + 0.02));
  });

  // Galería con barandilla
  g.add(cilindro(2.6, 2.6, 0.3, MAT.hormigon, 0, y + 0.15, 0, 20));
  var aro = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.06, 6, 24), MAT.metal);
  aro.rotation.x = Math.PI / 2;
  aro.position.y = y + 1.1;
  g.add(aro);
  for (var i = 0; i < 12; i++) {
    var a = i / 12 * Math.PI * 2;
    g.add(cilindro(0.05, 0.05, 0.9, MAT.metal, Math.cos(a) * 2.45, y + 0.75, Math.sin(a) * 2.45, 6));
  }

  // Linterna: cristal translúcido + foco brillante + techo cónico
  var yl = y + 0.3;
  g.add(cilindro(1.2, 1.2, 0.2, MAT.metal, 0, yl + 0.1, 0, 16));
  g.add(cilindro(1.0, 1.0, 1.8, MAT.cristalFaro, 0, yl + 1.1, 0, 16));
  g.add(cilindro(0.45, 0.45, 1.2, MAT.luzFaro, 0, yl + 1.1, 0, 12));
  var techo = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.5, 16), MAT.rojoFaro);
  techo.position.y = yl + 2.0 + 0.75;
  techo.castShadow = true;
  g.add(techo);
  var bola = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), MAT.metal);
  bola.position.y = yl + 3.9;
  g.add(bola);

  // Haz giratorio + luz puntual en la linterna
  faroHaz = crearHaz(30, 3.5);
  faroHaz.position.y = yl + 1.1;
  g.add(faroHaz);

  var luz = new THREE.PointLight(0xffe9a0, 1.0, 60);
  luz.position.y = yl + 1.1;
  g.add(luz);

  return g;
}


// ============================================================================
//  ÁRBOLES
// ============================================================================
function crearPino(altura) {
  var h = altura || 6;
  var g = new THREE.Object3D();

  g.add(cilindro(0.18 * h / 6, 0.28 * h / 6, h * 0.3, MAT.tronco, 0, h * 0.15, 0, 8));

  for (var i = 0; i < 3; i++) {
    var radio = (1.6 - i * 0.45) * h / 6;
    var altoC = h * 0.4;
    var cono = new THREE.Mesh(new THREE.ConeGeometry(radio, altoC, 8), MAT.hojaPino);
    cono.position.y = h * 0.25 + i * h * 0.22 + altoC / 2;
    cono.castShadow = true;  cono.receiveShadow = true;
    g.add(cono);
  }
  return g;
}

function crearArbolRedondo(altura) {
  var h = altura || 5;
  var g = new THREE.Object3D();

  g.add(cilindro(0.15 * h / 5, 0.25 * h / 5, h * 0.5, MAT.tronco, 0, h * 0.25, 0, 8));

  var blobs = [  // [radio, x, y, z, material]
    [0.32,  0,     0.68,  0,     MAT.hojaA],
    [0.22,  0.20,  0.58,  0.10,  MAT.hojaB],
    [0.22, -0.18,  0.60, -0.12,  MAT.hojaB]
  ];
  blobs.forEach(function (b) {
    var copa = new THREE.Mesh(new THREE.IcosahedronGeometry(h * b[0], 1), b[4]);
    copa.scale.y = 0.85;
    copa.position.set(h * b[1], h * b[2], h * b[3]);
    copa.castShadow = true;  copa.receiveShadow = true;
    g.add(copa);
  });
  return g;
}

// ============================================================================
// ROCAS LIGERAS
// ============================================================================

var MAT_ROCA = new THREE.MeshLambertMaterial({
  color: 0x66635d,
  flatShading: true
});

function crearRoca(tamano) {
  var roca = new THREE.Mesh(new THREE.DodecahedronGeometry(tamano, 0), MAT.piedra);
  roca.scale.y = 0.6;
  roca.rotation.y = rnd() * Math.PI * 2;
  roca.castShadow = false;
  roca.receiveShadow = false;
  return roca;
}

// ============================================================================
//  TORRE DE VIGILANCIA (Madera)
// ============================================================================
function crearTorreVigilancia() {
  var g = new THREE.Object3D();
  var alto = 8;
  
  // 4 Postes principales inclinados
  var o = 1.5;
  [[-1,-1], [1,-1], [1,1], [-1,1]].forEach(function(e) {
    var poste = cilindro(0.15, 0.2, alto, MAT.tronco, e[0]*o, alto/2, e[1]*o, 6);
    poste.rotation.x = e[1] * 0.05;
    poste.rotation.z = -e[0] * 0.05;
    g.add(poste);
  });

  // Plataforma superior y barandilla
  g.add(caja(4, 0.2, 4, MAT.maderaB, 0, alto - 1, 0));
  g.add(caja(4.2, 0.8, 4.2, MAT.caja, 0, alto - 0.5, 0)); // Simulación de barandilla maciza

  // Techo simple
  var techo = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 4), MAT.tejado);
  techo.rotation.y = Math.PI / 4;
  techo.position.y = alto + 1.5;
  techo.castShadow = true;
  g.add(techo);

  return g;
}

// ============================================================================
//  PUESTOS DE MERCADO
// ============================================================================
function crearPuestoMercado(colorTela) {
  var g = new THREE.Object3D();
  var matTela = colorTela === 'rojo' ? MAT.telaRoja : MAT.telaAzul;

  // Mostrador y soportes
  g.add(caja(2.5, 0.8, 1.2, MAT.maderaA, 0, 0.4, 0));
  g.add(cilindro(0.05, 0.05, 2.2, MAT.maderaOsc, -1.1, 1.1, -0.4, 6));
  g.add(cilindro(0.05, 0.05, 2.2, MAT.maderaOsc, 1.1, 1.1, -0.4, 6));

  // Toldo inclinado
  var toldo = caja(2.8, 0.05, 1.8, matTela, 0, 2.2, 0.2);
  toldo.rotation.x = Math.PI / 8;
  g.add(toldo);

  // Cajas pequeñas de mercancía sobre el mostrador
  g.add(caja(0.4, 0.4, 0.4, MAT.caja, -0.5, 1.0, 0));
  g.add(caja(0.4, 0.4, 0.4, MAT.caja, 0, 1.0, 0.2));

  return g;
}

// ============================================================================
//  SANTUARIO
// ============================================================================
function crearSantuario() {
  var g = new THREE.Object3D();
  
  // Base de piedra escalonada
  g.add(caja(4, 0.3, 4, MAT.piedra, 0, 0.15, 0));
  g.add(caja(3, 0.3, 3, MAT.piedra, 0, 0.45, 0));

  // Columnas
  [[-1.2,-1.2], [1.2,-1.2], [1.2,1.2], [-1.2,1.2]].forEach(function(e) {
    g.add(cilindro(0.15, 0.15, 2.5, MAT.blanco, e[0], 1.7, e[1], 12));
  });

  // Cúpula / Techo
  g.add(caja(3.2, 0.4, 3.2, MAT.piedra, 0, 3.1, 0));
  var cupula = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16, 0, Math.PI*2, 0, Math.PI/2), MAT.oro);
  cupula.position.y = 3.3;
  g.add(cupula);

  // Altar central
  g.add(caja(0.8, 1, 0.8, MAT.piedra, 0, 1.1, 0));

  return g;
}

// ============================================================================
//  PLAZA (Fuente/Monumento central)
// ============================================================================
function crearMonumentoPlaza() {
  var g = new THREE.Object3D();
  g.add(cilindro(2, 2.2, 0.4, MAT.hormigonOsc, 0, 0.2, 0, 16));
  g.add(cilindro(0.8, 1, 1.5, MAT.piedra, 0, 1.0, 0, 8));
  var estatua = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), MAT.metal);
  estatua.position.y = 2.2;
  g.add(estatua);
  return g;
}


// ============================================================================
//  PUERTO: búsqueda automática de un buen punto de costa
//  Prueba muchas direcciones desde el mar hacia el interior y puntúa:
//  pendiente suave, agua profunda al final del muelle, terreno moderado
//  tierra adentro y lejos del volcán.
//  Si no te gusta el sitio, fija PUERTO_MANUAL = { x:..., z:..., ang:... }
//  (ang en grados: dirección hacia el mar, 0 = +Z, 90 = +X)
// ============================================================================
var PUERTO_MANUAL = null;   // <<< pon aquí tu propio punto cuando decidamos la distribución

var PUERTO = null;          // {x, z, ux, uz, giro}

function buscarCosta() {
  if (PUERTO_MANUAL) {
    var am = PUERTO_MANUAL.ang * Math.PI / 180;
    return { x: PUERTO_MANUAL.x, z: PUERTO_MANUAL.z, ux: Math.sin(am), uz: Math.cos(am), puntos: 0 };
  }

  var lPico = Math.sqrt(peakWorldX * peakWorldX + peakWorldZ * peakWorldZ);
  var mejor = null;

  for (var a = 0; a < 360; a += 4) {
    var ang = a * Math.PI / 180;
    var ux = Math.sin(ang), uz = Math.cos(ang);

    // Desde el mar hacia el interior: primer punto de tierra firme
    var r = 590;
    while (r > 0 && hm_altura(ux * r, uz * r) < seaLevelY + 0.8) r -= 1;
    if (r <= 40) continue;

    var px = ux * (r - 3), pz = uz * (r - 3);                    // 3 unidades tierra adentro
    var pend = Math.abs(hm_altura(px - ux * 10, pz - uz * 10) -
                        hm_altura(px + ux * 10, pz + uz * 10)) / 20;
    var hMar = hm_altura(px + ux * 17, pz + uz * 17);            // fondo en la punta del muelle
    var hTierra = hm_altura(px - ux * 40, pz - uz * 40) - seaLevelY;
    var haciaPico = (ux * peakWorldX + uz * peakWorldZ) / lPico; // 1 = mirando al volcán

    var puntos = pend * 10
               + (hMar > seaLevelY - 0.5 ? 5 : 0)
               + ((hTierra < 1 || hTierra > 15) ? 3 : 0)
               + haciaPico * 1.5;

    if (mejor == null || puntos < mejor.puntos) {
      mejor = { x: px, z: pz, ux: ux, uz: uz, puntos: puntos };
    }
  }

  if (mejor == null) mejor = { x: 0, z: 0, ux: 0, uz: 1, puntos: 99 };   // sin costa válida
  return mejor;
}

// Coordenadas del puerto -> mundo.
//   s = lateral (eje X local del puerto), l = a lo largo (+ hacia el mar, - tierra adentro)
function aMundo(s, l) {
  return {
    x: PUERTO.x + s * PUERTO.uz + l * PUERTO.ux,
    z: PUERTO.z - s * PUERTO.ux + l * PUERTO.uz
  };
}


// ============================================================================
//  COLOCACIÓN SOBRE EL TERRENO (con cimentación para pendientes)
// ============================================================================
var ocupados = [];   // [x, z, radio] zonas ocupadas (los árboles las evitan)

// Edificio rectangular en (s,l) del puerto, frente hacia el mar
function colocarRectangular(obj, s, l, ancho, fondo) {
  var c = aMundo(s, l);
  var ys = [hm_altura(c.x, c.z)];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (e) {
    var q = aMundo(s + e[0] * ancho / 2, l + e[1] * fondo / 2);
    ys.push(hm_altura(q.x, q.z));
  });
  var yBase = Math.max.apply(null, ys), yMin = Math.min.apply(null, ys);

  // Cimentación: bloque desde el punto más bajo hasta la base
  var h = (yBase - yMin) + 0.6;
  obj.add(caja(ancho + 0.2, h, fondo + 0.2, MAT.hormigonOsc, 0, -h / 2, 0));

  obj.position.set(c.x, yBase, c.z);
  obj.rotation.y = PUERTO.giro;
  scene.add(obj);

  registrarCaja(c.x, c.z, PUERTO.giro, ancho / 2 + 0.2, fondo / 2 + 0.2);
  ocupados.push([c.x, c.z, Math.sqrt(ancho * ancho + fondo * fondo) / 2 + 3]);
}

// Objeto circular (faro) con cimentación
function colocarCircular(obj, s, l, radio) {
  var c = aMundo(s, l);
  var ys = [hm_altura(c.x, c.z)];
  for (var i = 0; i < 8; i++) {
    var a = i / 8 * Math.PI * 2;
    ys.push(hm_altura(c.x + Math.cos(a) * radio, c.z + Math.sin(a) * radio));
  }
  var yBase = Math.max.apply(null, ys), yMin = Math.min.apply(null, ys);

  var h = (yBase - yMin) + 0.6;
  obj.add(cilindro(radio + 0.2, radio + 0.2, h, MAT.hormigonOsc, 0, -h / 2, 0, 20));

  obj.position.set(c.x, yBase, c.z);
  obj.rotation.y = PUERTO.giro;
  scene.add(obj);

  registrarCirculo(c.x, c.z, radio);
  ocupados.push([c.x, c.z, radio + 4]);
}


// ============================================================================
//  COMPOSICIÓN: puerto + faro + casas + edificios + bosque
//  Todo en coordenadas del puerto (s = lateral, l = hacia el mar).
//  Devuelve datos para colocar al jugador.
// ============================================================================
function crearPoblado() {

  var costa = buscarCosta();
  PUERTO = {
    x: costa.x, z: costa.z, ux: costa.ux, uz: costa.uz,
    giro: Math.atan2(costa.ux, costa.uz)      // el eje +Z local apunta al mar
  };
  console.log('Puerto en (' + PUERTO.x.toFixed(0) + ', ' + PUERTO.z.toFixed(0) +
              '), mirando al mar hacia (' + PUERTO.ux.toFixed(2) + ', ' + PUERTO.uz.toFixed(2) + ')');

 // ---------------- Muelle de hormigón (s = 0) ----------------
  var LARGO_M = 16, ANCHO_M = 6, ALTO_M = 1.0;
  var muelle = crearMuelleHormigon(LARGO_M, ANCHO_M, ALTO_M);
  muelle.position.set(PUERTO.x, seaLevelY, PUERTO.z);
  muelle.rotation.y = PUERTO.giro;
  scene.add(muelle);

  var yMuelle = seaLevelY + ALTO_M + 0.04;
  var cM = aMundo(0, LARGO_M / 2);
  registrarPlataforma(cM.x, cM.z, PUERTO.giro, ANCHO_M / 2, LARGO_M / 2, yMuelle);
  ocupados.push([cM.x, cM.z, 14]);

 // Cajas apiladas y colisiones
  var pilas = [
    [-1.0,  5.2, 2, 3, 3],
    [ 1.5,  9.2, 1, 2, 2],
    [-1.0, 12.0, 2, 2, 2]
  ];
  pilas.forEach(function (p) {
    anadirPilaCajas(muelle, p[0], p[1], p[2], p[3], p[4], yMuelle - seaLevelY);
    var cp = aMundo(p[0], p[1]);
    // Registramos la caja usando LADO_CAJA
    registrarCaja(cp.x, cp.z, PUERTO.giro, p[2] * LADO_CAJA / 2, p[3] * LADO_CAJA / 2);
  });

  // ---------------- PERÍMETRO: Murallas y Torres ----------------
  var altoM = 6, gruesoM = 3;
  // Torres en las 4 esquinas
  colocarCircular(crearTorreMuralla(3, altoM + 2), -35, -10, 3);
  colocarCircular(crearTorreMuralla(3, altoM + 2),  35, -10, 3);
  colocarCircular(crearTorreMuralla(3, altoM + 2), -35, -85, 3);
  colocarCircular(crearTorreMuralla(3, altoM + 2),  35, -85, 3);
  
// Tramos laterales divididos en 5 partes de 15 unidades de largo
  for (var i = 0; i < 5; i++) {
    var lOffset = -17.5 - (i * 15); 
    
    // Muro Izquierdo girado 90 grados (Math.PI / 2)
    var wrapperIzq = new THREE.Object3D();
    var tramoIzq = crearTramoMuralla(15, altoM, gruesoM);
    tramoIzq.rotation.y = Math.PI / 2; 
    wrapperIzq.add(tramoIzq);
    // Nota que aquí le pasamos el "grueso" (3) como ancho, y "15" como fondo para las colisiones
    colocarRectangular(wrapperIzq, -35, lOffset, gruesoM, 15); 

    // Muro Derecho girado 90 grados (Math.PI / 2)
    var wrapperDer = new THREE.Object3D();
    var tramoDer = crearTramoMuralla(15, altoM, gruesoM);
    tramoDer.rotation.y = Math.PI / 2;
    wrapperDer.add(tramoDer);
    colocarRectangular(wrapperDer, 35, lOffset, gruesoM, 15); 
  }
  // Muro frontal (con abertura central para el muelle)
  var tramoFrontal = (70 - 10) / 2; // 10 unidades de apertura
  colocarRectangular(crearTramoMuralla(tramoFrontal, altoM, gruesoM), -20, -10, tramoFrontal, gruesoM); // Frontal Izq
  colocarRectangular(crearTramoMuralla(tramoFrontal, altoM, gruesoM),  20, -10, tramoFrontal, gruesoM); // Frontal Der


  // ---------------- DISTRIBUCIÓN URBANA DENSA ----------------
  
  // Bloque 1: Puerto y Almacenes (l = -20)
  colocarRectangular(crearEdificio(10, 8, 3), -20, -20, 10, 8);
  colocarRectangular(crearEdificio(10, 8, 3),  20, -20, 10, 8);
  colocarRectangular(crearCasa(6, 5, 3, 0xffffff), -8, -20, 6, 5); // Oficina puerto
  colocarRectangular(crearCasa(6, 5, 3, 0xffffff),  8, -20, 6, 5);

  // Bloque 2: Mercado y Santuario (l = -35)
  colocarRectangular(crearSantuario(), -22, -35, 6, 6);
  // Zona de puestos de mercado alineados
  colocarRectangular(crearPuestoMercado('rojo'), -10, -32, 3, 2);
  colocarRectangular(crearPuestoMercado('azul'), -10, -38, 3, 2);
  colocarRectangular(crearPuestoMercado('rojo'),  10, -32, 3, 2);
  colocarRectangular(crearPuestoMercado('azul'),  10, -38, 3, 2);
  // Casas rodeando el mercado
  colocarRectangular(crearCasa(7, 6, 3.2),  22, -35, 7, 6);

  // Bloque 3: Plaza Central y Callejones (l = -52)
  colocarCircular(crearMonumentoPlaza(), 0, -52, 2.5);
  // Viviendas densas formando calles estrechas alrededor de la plaza
  var casasDensas = [
    [-18, -48, 5, 5, 3.5], [-24, -48, 5, 5, 3.0], 
    [-18, -56, 5, 5, 3.0], [-24, -56, 5, 5, 3.2],
    [ 18, -48, 6, 5, 3.0], [ 25, -48, 6, 5, 3.4],
    [ 18, -56, 6, 5, 3.0], [ 25, -56, 5, 5, 3.0]
  ];
  casasDensas.forEach(function (c) {
    colocarRectangular(crearCasa(c[2], c[3], c[4]), c[0], c[1], c[2], c[3]);
  });

  // Bloque 4: Zona militar y Edificios Administrativos (l = -72)
  colocarRectangular(crearEdificio(14, 8, 4), 0, -72, 14, 8); // Edificio principal
  colocarRectangular(crearCasa(6, 7, 3.5), -15, -72, 6, 7);
  colocarRectangular(crearCasa(6, 7, 3.5),  15, -72, 6, 7);
  
  // Faro (Reubicado ligeramente para encajar en la muralla)
  colocarCircular(crearFaro(), -35, -4, 3.0);

  // ---------------- Punto de aparición del jugador ----------------
  var spawn = aMundo(0, 14); // Al final del muelle
  ocupados.push([spawn.x, spawn.z, 4]);
  

  // ---------------- Bosque ----------------
  var centroBosque = aMundo(0, -55), radioBosque = 90;
  var plantados = 0, intentos = 0, MAX_ARBOLES = 70;
  while (plantados < MAX_ARBOLES && intentos < 1500) {
    intentos++;
    var ang = rnd() * Math.PI * 2;
    var rr = radioBosque * Math.sqrt(rnd());
    var x = centroBosque.x + Math.cos(ang) * rr;
    var z = centroBosque.z + Math.sin(ang) * rr;

    var y = hm_altura(x, z);
    if (y < seaLevelY + 1.5) continue;            // nada en el agua ni en la playa
    if (pendienteEn(x, z) > 0.6) continue;        // nada en pendientes fuertes
    var libre = ocupados.every(function (o) {
      return Math.hypot(x - o[0], z - o[1]) > o[2];
    });
    if (!libre) continue;

    var arbol = (rnd() < 0.5)
      ? crearPino(5 + rnd() * 3)
      : crearArbolRedondo(4 + rnd() * 2.5);
    arbol.position.set(x, y, z);
    arbol.rotation.y = rnd() * Math.PI * 2;
    scene.add(arbol);
    registrarCirculo(x, z, 0.45);
    plantados++;
  }
  console.log('Árboles plantados: ' + plantados);

  return { spawn: spawn, giro: PUERTO.giro, ux: PUERTO.ux, uz: PUERTO.uz };
}
