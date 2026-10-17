/*
 * Ninja del pueblo: recoge todas las monedas sin ser iluminado por los focos.
 * Basado en tron-v1.js (misma plantilla: init / loadScene / render y mismos
 * scripts en el HTML: three, OrbitControls). Ya NO hacen falta composer,
 * GLTFLoader ni texturas: todo se construye con primitivas.
 *
 * Herramientas de la asignatura usadas:
 *  - Geometrias basicas + grafo de escena (Group) -> casas y ninja
 *  - Movimiento y camara en 3a persona (thirdperson.js)
 *  - Colisiones con Raycaster (s3-colisiones.js)
 *  - Luces SpotLight + viewport/scissor para el minimapa (s3-cam1.js)
 */

var renderer, scene, camera, cameraTop;
var clock = new THREE.Clock();

// ---------------- ESTADO DEL JUEGO ----------------
// 'menu' | 'jugando' | 'fin'
var estado = 'menu';
var tiempo = 0;            // tiempo global (mueve los focos tambien en el menu)
var tiempo_partida = 0;
var angulo_menu = 0;

// ---------------- PARAMETROS ----------------
const tam_pueblo = 140;
const limite_pueblo = 64;
const separacion_casas = 24;
const radio_foco = 4.5;
const radio_moneda = 1.8;
const total_monedas = 8;

// ---------------- JUGADOR ----------------
const pos_inicial = new THREE.Vector3(-60, 0, 0);
var pos_ninja = pos_inicial.clone();
var angulo = Math.PI / 2;
var velocity = new THREE.Vector3(Math.sin(angulo), 0, Math.cos(angulo));
var ninja = null;

const controls = {
  moveForward: false, moveBackward: false,
  moveLeft: false, moveRight: false,
  speed: 0.25
};

// camara en tercera persona
const distancia_camara = 8;
const altura_camara = 4;
const desfase_lookat_y = 1.5;
const pos_obj_camara = new THREE.Vector3();
const mirada_camara = new THREE.Vector3();

// ---------------- COLISIONES / OBJETOS ----------------
const raycaster = new THREE.Raycaster();
var edificios = [];        // casas: bloquean al jugador y proyectan "sombra" de los focos
var monedas = [];
var focos = [];
var recogidas = 0;

// ---------------- INTERFAZ (se crea desde JS, no hay que tocar el HTML) ----------------
var overlay, hud;

// ---------------- TECLADO ----------------
document.addEventListener('keydown', function(e) {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': controls.moveForward = true; e.preventDefault(); break;
    case 'ArrowDown': case 'KeyS': controls.moveBackward = true; e.preventDefault(); break;
    case 'ArrowLeft': case 'KeyA': controls.moveLeft = true; e.preventDefault(); break;
    case 'ArrowRight': case 'KeyD': controls.moveRight = true; e.preventDefault(); break;
    case 'Enter': if (estado !== 'jugando') empezarJuego(); break;
  }
});
document.addEventListener('keyup', function(e) {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': controls.moveForward = false; break;
    case 'ArrowDown': case 'KeyS': controls.moveBackward = false; break;
    case 'ArrowLeft': case 'KeyA': controls.moveLeft = false; break;
    case 'ArrowRight': case 'KeyD': controls.moveRight = false; break;
  }
});

init();
loadScene();
crearInterfaz();
mostrarMenu('NINJA DEL PUEBLO',
  'Recoge las ' + total_monedas + ' monedas sin que un foco te ilumine.<br>' +
  'Los edificios te esconden de la luz.<br><small>WASD / flechas para moverte</small>',
  'Jugar');
render();

// ======================================================================
function init()
{
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x0a0f1e));
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1e);
  scene.fog = new THREE.Fog(0x0a0f1e, 40, 170);

  // Noche: luz ambiente tenue + luna
  scene.add(new THREE.AmbientLight(0x4a5a8a, 0.45));
  var luna = new THREE.DirectionalLight(0x8899cc, 0.35);
  luna.position.set(-40, 80, 30);
  scene.add(luna);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(90, 55, 0);

  // minimapa cenital (capa 1 = marcadores solo visibles en el minimapa)
  var m = tam_pueblo / 2;
  cameraTop = new THREE.OrthographicCamera(-m, m, m, -m, 1, 300);
  cameraTop.up.set(0, 0, -1);
  cameraTop.position.set(0, 120, 0);
  cameraTop.lookAt(0, 0, 0);
  cameraTop.layers.enable(1);

  window.addEventListener('resize', updateAspectRatio);
}

// ======================================================================
function crearInterfaz()
{
  overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;left:0;top:0;width:100%;height:100%;display:flex;' +
    'flex-direction:column;align-items:center;justify-content:center;' +
    'background:rgba(0,0,10,0.65);color:#fff;font-family:sans-serif;' +
    'text-align:center;z-index:10;';
  document.body.appendChild(overlay);

  hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;left:16px;top:12px;color:#ffd84a;font:bold 20px sans-serif;' +
    'text-shadow:0 0 6px #000;z-index:5;display:none;';
  document.body.appendChild(hud);
}

function estiloBoton(b)
{
  b.style.cssText =
    'font-size:22px;padding:10px 36px;margin:8px;border:2px solid #ffd84a;' +
    'background:#111;color:#ffd84a;border-radius:8px;cursor:pointer;';
}

// Menu generico: sirve para el principal y para victoria/derrota.
function mostrarMenu(titulo, texto, textoBoton)
{
  estado = estado === 'jugando' ? 'fin' : estado;
  overlay.innerHTML = '';
  var h = document.createElement('h1');
  h.style.fontSize = '54px';
  h.innerHTML = titulo;
  var p = document.createElement('p');
  p.style.fontSize = '20px';
  p.innerHTML = texto;
  var bJugar = document.createElement('button');
  bJugar.textContent = textoBoton;
  estiloBoton(bJugar);
  bJugar.onclick = empezarJuego;
  var bSalir = document.createElement('button');
  bSalir.textContent = 'Salir';
  estiloBoton(bSalir);
  bSalir.onclick = salirJuego;
  overlay.appendChild(h);
  overlay.appendChild(p);
  overlay.appendChild(bJugar);
  overlay.appendChild(bSalir);
  overlay.style.display = 'flex';
  hud.style.display = 'none';
}

function salirJuego()
{
  window.close(); // solo funciona si la pestaña la abrio un script
  overlay.innerHTML = '<h1>Gracias por jugar</h1>';
  var b = document.createElement('button');
  b.textContent = 'Volver al menu';
  estiloBoton(b);
  b.onclick = function() {
    mostrarMenu('NINJA DEL PUEBLO', 'Recoge todas las monedas sin ser iluminado.', 'Jugar');
  };
  overlay.appendChild(b);
}

// ======================================================================
function loadScene()
{
  // Suelo (Lambert para que el SpotLight lo ilumine)
  var suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(tam_pueblo, tam_pueblo),
    new THREE.MeshLambertMaterial({ color: 0x2a3a2a })
  );
  suelo.rotation.x = -Math.PI / 2;
  scene.add(suelo);

  // Calles: dos bandas por eje, solo decorativas (planos finos sobre el suelo)
  var matCalle = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
  [-36, -12, 12, 36].forEach(function(c) {
    var a = new THREE.Mesh(new THREE.PlaneGeometry(10, tam_pueblo), matCalle);
    a.rotation.x = -Math.PI / 2; a.position.set(c, 0.02, 0); scene.add(a);
    var b = new THREE.Mesh(new THREE.PlaneGeometry(tam_pueblo, 10), matCalle);
    b.rotation.x = -Math.PI / 2; b.position.set(0, 0.02, c); scene.add(b);
  });

  crearCasas();
  crearMonedas();
  crearFocos();
  crearNinja();

  // Marcador del jugador para el minimapa (capa 1)
  marcador_jugador = new THREE.Mesh(
    new THREE.CircleGeometry(3, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  marcador_jugador.rotation.x = -Math.PI / 2;
  marcador_jugador.layers.set(1);
  scene.add(marcador_jugador);
}
var marcador_jugador;

// Casas: Group (caja + tejado piramidal). Rejilla de 5x5 sin la casa central,
// que queda como plaza. Alturas y colores pseudo-aleatorios pero fijos.
function crearCasas()
{
  var colores = [0x6b4a3a, 0x7a6a55, 0x5a5f6b, 0x6a3f3f];
  var n = 0;
  for (var i = -2; i <= 2; i++) {
    for (var j = -2; j <= 2; j++) {
      if (i === 0 && j === 0) continue;
      n++;
      var ancho = 9 + (n * 7) % 3;
      var alto = 6 + (n * 5) % 7;
      var casa = new THREE.Group();
      var cuerpo = new THREE.Mesh(
        new THREE.BoxGeometry(ancho, alto, ancho),
        new THREE.MeshLambertMaterial({ color: colores[n % colores.length] })
      );
      cuerpo.position.y = alto / 2;
      var tejado = new THREE.Mesh(
        new THREE.ConeGeometry(ancho * 0.8, 4, 4),
        new THREE.MeshLambertMaterial({ color: 0x2b2024 })
      );
      tejado.rotation.y = Math.PI / 4;
      tejado.position.y = alto + 2;
      casa.add(cuerpo);
      casa.add(tejado);
      casa.position.set(i * separacion_casas, 0, j * separacion_casas);
      scene.add(casa);
      edificios.push(casa);
    }
  }
}

function crearMonedas()
{
  var puestos = [[12, 12], [-12, -12], [36, 12], [-36, -12],
                 [12, 36], [-12, -36], [36, -36], [-36, 36]];
  var geo = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 20);
  geo.rotateX(Math.PI / 2); // la moneda mira hacia Z
  var mat = new THREE.MeshPhongMaterial({
    color: 0xffd400, emissive: 0x886600, shininess: 100
  });
  var geoMarca = new THREE.CircleGeometry(1.6, 12);
  var matMarca = new THREE.MeshBasicMaterial({ color: 0xffd400 });

  puestos.forEach(function(p) {
    var moneda = new THREE.Mesh(geo, mat);
    moneda.position.set(p[0], 1.3, p[1]);
    scene.add(moneda);
    var marca = new THREE.Mesh(geoMarca, matMarca);
    marca.rotation.x = -Math.PI / 2;
    marca.position.set(p[0], 40, p[1]);
    marca.layers.set(1);
    scene.add(marca);
    monedas.push({ malla: moneda, marca: marca, activa: true });
  });
}

// Focos: una torre en cada esquina apunta con un SpotLight a un punto del suelo
// que se mueve siguiendo un patron. Cada patron es una funcion f(t) -> (x, z).
function crearFocos()
{
  var patrones = [
    function(t) { return [14 * Math.cos(0.5 * t), 14 * Math.sin(0.5 * t)]; },       // circulo en la plaza
    function(t) { return [12, 42 * Math.sin(0.35 * t)]; },                           // recta N-S
    function(t) { return [45 * Math.sin(0.3 * t + 1), -12]; },                       // recta E-O
    function(t) { return [-36, 45 * Math.sin(0.4 * t + 2)]; }                        // recta N-S (otra calle)
  ];
  var torres = [[62, 62], [-62, 62], [62, -62], [-62, -62]];
  var altura_torre = 22;

  for (var i = 0; i < 4; i++) {
    // torre
    var poste = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, altura_torre, 8),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    poste.position.set(torres[i][0], altura_torre / 2, torres[i][1]);
    scene.add(poste);
    var lampara = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 })
    );
    lampara.position.set(torres[i][0], altura_torre, torres[i][1]);
    scene.add(lampara);

    // luz
    var luz = new THREE.SpotLight(0xfff2b0, 3, 0, 0.1, 0.3);
    luz.position.copy(lampara.position);
    scene.add(luz);
    scene.add(luz.target); // imprescindible para que 'target' surta efecto

    // disco amarillo en el suelo: es la zona peligrosa real
    var disco = new THREE.Mesh(
      new THREE.CircleGeometry(radio_foco, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffee88, transparent: true, opacity: 0.3, depthWrite: false
      })
    );
    disco.rotation.x = -Math.PI / 2;
    scene.add(disco);

    // marcador del minimapa
    var marca = new THREE.Mesh(
      new THREE.RingGeometry(radio_foco * 0.7, radio_foco, 24),
      new THREE.MeshBasicMaterial({ color: 0xff4040, side: THREE.DoubleSide })
    );
    marca.rotation.x = -Math.PI / 2;
    marca.layers.set(1);
    scene.add(marca);

    focos.push({
      patron: patrones[i], luz: luz, disco: disco, marca: marca,
      origen: lampara.position.clone(), objetivo: new THREE.Vector3()
    });
  }
}

// Ninja con primitivas: cuerpo, cabeza, antifaz y cinta roja. Mira hacia +Z.
function crearNinja()
{
  ninja = new THREE.Group();
  var negro = new THREE.MeshLambertMaterial({ color: 0x111111 });
  var cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.3, 12), negro);
  cuerpo.position.y = 0.75;
  var cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), negro);
  cabeza.position.y = 1.7;
  var ojos = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.12, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffe0c0 })
  );
  ojos.position.set(0, 1.72, 0.33);
  var cinta = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16),
    new THREE.MeshBasicMaterial({ color: 0xcc1111 })
  );
  cinta.position.y = 1.9;
  var bufanda = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.1, 0.9),
    new THREE.MeshBasicMaterial({ color: 0xcc1111 })
  );
  bufanda.position.set(0, 1.9, -0.55);
  ninja.add(cuerpo, cabeza, ojos, cinta, bufanda);
  scene.add(ninja);
  ninja.position.copy(pos_ninja);
}

// ======================================================================
// Flujo del juego
function empezarJuego()
{
  recogidas = 0;
  tiempo_partida = 0;
  monedas.forEach(function(m) { m.activa = true; m.malla.visible = true; m.marca.visible = true; });
  pos_ninja.copy(pos_inicial);
  angulo = Math.PI / 2;
  camara_iniciada = false;
  controls.moveForward = controls.moveBackward = false;
  controls.moveLeft = controls.moveRight = false;
  overlay.style.display = 'none';
  hud.style.display = 'block';
  estado = 'jugando';
}

function perder()
{
  estado = 'fin';
  mostrarMenu('¡TE HAN DESCUBIERTO!',
    'Monedas recogidas: ' + recogidas + ' / ' + total_monedas, 'Reintentar');
}

function ganar()
{
  estado = 'fin';
  mostrarMenu('¡VICTORIA!',
    'Has robado todo el tesoro en ' + tiempo_partida.toFixed(1) + ' s', 'Jugar de nuevo');
}

// ======================================================================
// Un foco detecta al jugador si esta dentro del disco iluminado y ningun
// edificio se interpone entre la lampara y el jugador (rayo lampara -> ninja).
function jugadorIluminado()
{
  var pecho = new THREE.Vector3(pos_ninja.x, pos_ninja.y + 1, pos_ninja.z);
  for (var i = 0; i < focos.length; i++) {
    var f = focos[i];
    var dx = pos_ninja.x - f.objetivo.x;
    var dz = pos_ninja.z - f.objetivo.z;
    if (dx * dx + dz * dz > radio_foco * radio_foco) continue;

    var dir = pecho.clone().sub(f.origen);
    var dist = dir.length();
    raycaster.set(f.origen, dir.normalize());
    raycaster.far = dist;
    var impactos = raycaster.intersectObjects(edificios, true);
    raycaster.far = Infinity;
    if (impactos.length === 0) return true; // nada tapa la luz
  }
  return false;
}

function actualizarFocos()
{
  focos.forEach(function(f) {
    var p = f.patron(tiempo);
    f.objetivo.set(p[0], 0, p[1]);
    f.luz.target.position.copy(f.objetivo);
    f.disco.position.set(p[0], 0.06, p[1]);
    f.marca.position.set(p[0], 35, p[1]);
    // el cono se ajusta para que su base ronde el radio del disco
    var d = f.origen.distanceTo(f.objetivo);
    f.luz.angle = Math.atan(radio_foco / d);
  });
}

function moverJugador()
{
  // Copiado de thirdperson.js: giro con A/D, avance segun el angulo
  if (controls.moveLeft) angulo += 0.05;
  if (controls.moveRight) angulo -= 0.05;
  velocity.set(Math.sin(angulo), 0, Math.cos(angulo));

  var dir = null;
  if (controls.moveForward) dir = velocity.clone();
  else if (controls.moveBackward) dir = velocity.clone().negate();

  if (dir !== null) {
    // Copiado de s3-colisiones.js: rayo en la direccion del movimiento
    var origen = pos_ninja.clone();
    origen.y += 0.5;
    raycaster.set(origen, dir);
    var impactos = raycaster.intersectObjects(edificios, true);
    var libre = !(impactos.length > 0 && impactos[0].distance <= controls.speed + 0.8);
    if (libre) pos_ninja.addScaledVector(dir, controls.speed);
  }

  // Limites del pueblo
  pos_ninja.x = Math.max(-limite_pueblo, Math.min(limite_pueblo, pos_ninja.x));
  pos_ninja.z = Math.max(-limite_pueblo, Math.min(limite_pueblo, pos_ninja.z));

  ninja.position.copy(pos_ninja);
  ninja.rotation.y = angulo;
  marcador_jugador.position.set(pos_ninja.x, 45, pos_ninja.z);
}

function recogerMonedas()
{
  monedas.forEach(function(m) {
    if (!m.activa) return;
    var dx = pos_ninja.x - m.malla.position.x;
    var dz = pos_ninja.z - m.malla.position.z;
    if (dx * dx + dz * dz < radio_moneda * radio_moneda) {
      m.activa = false;
      m.malla.visible = false;
      m.marca.visible = false;
      recogidas++;
    }
  });
}

// ======================================================================
var camara_iniciada = false;
function actualizarCamara(delta)
{
  if (estado === 'menu') {
    // en el menu la camara da vueltas al pueblo
    angulo_menu += 0.1 * delta;
    camera.position.set(Math.cos(angulo_menu) * 95, 55, Math.sin(angulo_menu) * 95);
    camera.lookAt(0, 0, 0);
    camara_iniciada = false;
    return;
  }

  // tercera persona: la camara persigue suavemente una posicion detras del ninja
  pos_obj_camara.copy(pos_ninja).addScaledVector(velocity, -distancia_camara);
  pos_obj_camara.y += altura_camara;
  mirada_camara.copy(pos_ninja);
  mirada_camara.y += desfase_lookat_y;

  if (!camara_iniciada) {
    camera.position.copy(pos_obj_camara);
    camara_iniciada = true;
  } else {
    camera.position.lerp(pos_obj_camara, 1 - Math.exp(-6 * delta));
  }
  camera.lookAt(mirada_camara);
}

function update()
{
  var delta = Math.min(clock.getDelta(), 0.05);
  tiempo += delta;

  actualizarFocos();
  monedas.forEach(function(m) { m.malla.rotation.y += 2 * delta; });
  ninja.visible = estado !== 'menu';
  marcador_jugador.visible = estado !== 'menu';

  if (estado === 'jugando') {
    tiempo_partida += delta;
    moverJugador();
    recogerMonedas();
    hud.textContent = 'Monedas: ' + recogidas + ' / ' + total_monedas +
      '   Tiempo: ' + tiempo_partida.toFixed(1);

    if (jugadorIluminado()) perder();
    else if (recogidas === total_monedas) ganar();
  }

  actualizarCamara(delta);
}

function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function render()
{
  requestAnimationFrame(render);
  update();

  // Vista principal
  renderer.autoClear = false;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.clear();
  renderer.render(scene, camera);

  // Minimapa en la esquina superior derecha (solo durante la partida),
  // como la vista de planta de s3-cam1.js
  if (estado === 'jugando') {
    var lado = Math.min(window.innerWidth, window.innerHeight) / 3.5;
    var margen = 16;
    var x = window.innerWidth - lado - margen;
    var y = window.innerHeight - lado - margen;
    renderer.setViewport(x, y, lado, lado);
    renderer.setScissor(x, y, lado, lado);
    renderer.setScissorTest(true);
    renderer.clear();
    var niebla = scene.fog;
    scene.fog = null; // sin niebla en el minimapa
    renderer.render(scene, cameraTop);
    scene.fog = niebla;
    renderer.setScissorTest(false);
  }
}