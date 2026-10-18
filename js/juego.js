// ============================================================================
//  juego.js  -  Mecanicas de juego sobre la isla (proyecto.js + personaje.js)
//
//  Objetivo: recoger las monedas del poblado sin que un foco te ilumine.
//  NO hace falta tocar proyecto.js ni personaje.js: este fichero se engancha
//  redefiniendo update() y render() (al cargarse el ultimo, sus funciones
//  sustituyen a las de proyecto.js).
//
//  ORDEN EN EL HTML:  three.js, FBXLoader, personaje.js, proyecto.js, juego.js
//
//  Usa: Raycaster (s3-colisiones), SpotLight, Groups, viewport/scissor para el
//  minimapa (s3-cam1), y las funciones que ya existen en proyecto.js:
//  hm_altura, alturaSuelo, aMundo, PUERTO, Jugador...
// ============================================================================

// ---------------- PARAMETROS (ajustar dificultad aqui) ----------------
const JG = {
  usarOclusion: false,     // false: basta con pisar el disco. true: edificios/arboles te esconden (usa rayos)
  radioFoco: 3.5,          // radio de la zona iluminada (el personaje mide 1.8)
  radioMoneda: 1.4,        // distancia para recoger una moneda
  alturaTorre: 9,          // altura sobre el suelo a la que cuelga cada foco
  // posicion de las monedas en coordenadas del puerto (s = lateral, l = hacia el mar)
  monedas: [[-13, -20], [13, -20], [-10, -35], [10, -35],
            [-20, -52], [20, -52], [0, -62], [25, -72]],
  // esquinas de las murallas, donde estan las 4 torres
  torres: [[-35, -10], [35, -10], [-35, -85], [35, -85]],
  // patron de cada foco: f(t) -> [s, l]
  patrones: [
    function (t) { return [10 * Math.cos(0.4 * t), -52 + 10 * Math.sin(0.4 * t)]; }, // circulo en la plaza
    function (t) { return [28 * Math.sin(0.18 * t + 1), -35]; },                     // calle del mercado
    function (t) { return [28 * Math.sin(0.20 * t + 2), -62]; },                     // calle de atras
    function (t) { return [28 * Math.sin(0.22 * t), -20]; }                          // calle de la entrada
  ]
};

// ---------------- ESTADO ----------------
var estado = 'cargando';    // 'cargando' | 'menu' | 'jugando' | 'fin'
var juegoListo = false;     // isla preparada (monedas, focos, minimapa)
var preparando = false;     // true durante el fotograma previo a la inicializacion
var errorInicio = false;    // si algo falla al inicializar, no reintentamos en bucle
var jugadorPreparado = false;   // personaje FBX ya cargado y precompilado
var erroresCarga = [];      // URLs de FBX que no se han podido cargar
var tInicio = performance.now();
var botonJugar = null;
var fogJuego = null;
var tiempoPartida = 0, tFoco = 0, anguloMenu = 0;
var recogidas = 0;

var grupoJuego = new THREE.Group();   // type 'Group': no cuenta como obstaculo
var listaMonedas = [];
var listaFocos = [];
var obstaculos = [];                  // objetos que tapan la luz (casas, murallas, arboles...)
var marcadorJugador;
var raycasterLuz = new THREE.Raycaster();
var spawnJuego = null;
var centroPoblado = new THREE.Vector3();
var cameraTop;

// ---------------- INTERFAZ ----------------
var overlay, hud;
function crearInterfaz() {
  overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;left:0;top:0;width:100%;height:100%;display:flex;' +
    'flex-direction:column;align-items:center;justify-content:center;' +
    'background:rgba(0,0,10,0.65);color:#fff;font-family:sans-serif;' +
    'text-align:center;z-index:10;';
  overlay.innerHTML = '<h1>Cargando...</h1>';
  document.body.appendChild(overlay);

  hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;left:16px;top:12px;color:#ffd84a;font:bold 20px sans-serif;' +
    'text-shadow:0 0 6px #000;z-index:5;display:none;';
  document.body.appendChild(hud);
}

// Si falla algun FBX (ruta mal escrita, 404...) lo mostramos en pantalla
// en vez de quedarnos eternamente en "Cargando..."
THREE.DefaultLoadingManager.onError = function (url) {
  console.error('juego.js: no se pudo cargar ' + url);
  if (/\.fbx/i.test(url)) {
    erroresCarga.push(url);
    if (estado === 'cargando') mostrarProgreso(); else actualizarBotonJugar();
  }
};

function mostrarProgreso(texto) {
  if (!overlay || juegoListo && Jugador.listo) return;
  var html = '<h1>' + (texto || 'Cargando...') + '</h1>';
  if (erroresCarga.length) {
    html += '<p style="color:#ff8080;max-width:700px">No se han podido cargar estos archivos:<br>' +
            erroresCarga.join('<br>') + '<br><small>Revisa las rutas en personaje.js (PERSONAJE_CFG) ' +
            'y la consola (F12).</small></p>';
  }
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}

function estiloBoton(b) {
  b.style.cssText =
    'font-size:22px;padding:10px 36px;margin:8px;border:2px solid #ffd84a;' +
    'background:#111;color:#ffd84a;border-radius:8px;cursor:pointer;';
}

// Menu generico: sirve para el principal y para victoria/derrota
function mostrarMenu(titulo, texto, textoBoton) {
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
  botonJugar = bJugar;
  actualizarBotonJugar();
  var bSalir = document.createElement('button');
  bSalir.textContent = 'Salir';
  estiloBoton(bSalir);
  bSalir.onclick = salirJuego;
  overlay.appendChild(h); overlay.appendChild(p);
  overlay.appendChild(bJugar); overlay.appendChild(bSalir);
  overlay.style.display = 'flex';
  hud.style.display = 'none';
}

function actualizarBotonJugar() {
  if (!botonJugar) return;
  var ok = Jugador.listo && jugadorPreparado;
  botonJugar.disabled = !ok;
  botonJugar.style.opacity = ok ? '1' : '0.5';
  botonJugar.style.cursor = ok ? 'pointer' : 'wait';
  if (!ok) botonJugar.textContent = erroresCarga.length ? 'Error al cargar el personaje' : 'Listo';
}

function menuPrincipal() {
  estado = 'menu';
  mostrarMenu('INFILTRADO EN LA ISLA DEL TESORO',
    'Roba las ' + JG.monedas.length + ' monedas del poblado sin que un foco te ilumine.<br>' +
    'Que no te descubran los enemigos.<br>' +
    '<small>WASD / flechas: mover &nbsp; Shift: correr &nbsp; Espacio: saltar &nbsp; Arrastrar raton: camara</small>',
    'Jugar');
}

function salirJuego() {
  window.close();   // solo funciona si la pestana la abrio un script
  estado = 'menu';
  overlay.innerHTML = '<h1>Gracias por jugar</h1>';
  var b = document.createElement('button');
  b.textContent = 'Volver al menu';
  estiloBoton(b);
  b.onclick = menuPrincipal;
  overlay.appendChild(b);
}

document.addEventListener('keydown', function (e) {
  if (e.code === 'Enter' && (estado === 'menu' || estado === 'fin') && Jugador.listo && jugadorPreparado) empezarJuego();
});

// ---------------- CONSTRUCCION (se hace una vez, cuando la isla y el personaje ya estan cargados) ----------------
function suelo(s, l) {
  var c = aMundo(s, l);
  return { x: c.x, z: c.z, y: alturaSuelo(c.x, c.z) };
}

function inicializarJuego() {
  scene.add(grupoJuego);

  // Obstaculos para la luz: los objetos "Object3D" que proyecto.js anade a la
  // escena (casas, murallas, arboles...). El terreno, el mar y las luces no.
  scene.children.forEach(function (o) {
    if (o.type === 'Object3D' && o !== Jugador.raiz) obstaculos.push(o);
  });

  // Ambiente nocturno (los focos se ven mucho mejor)
  scene.traverse(function (o) {
    if (o.isAmbientLight) { o.color.set(0x5566aa); o.intensity = 0.45; }
    if (o.isDirectionalLight) { o.color.set(0x8899cc); o.intensity = 0.35; }
  });
  renderer.setClearColor(new THREE.Color(0x0a0f1e));
  fogJuego = new THREE.Fog(0x0a0f1e, 60, 420);
  scene.fog = fogJuego;

  crearMonedas();
  crearFocos();

  // Minimapa cenital orientado con el poblado (el mar queda abajo)
  var c = aMundo(0, -48);
  centroPoblado.set(c.x, alturaSuelo(c.x, c.z), c.z);
  cameraTop = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 1500);
  cameraTop.position.set(c.x, 600, c.z);
  cameraTop.up.set(-PUERTO.ux, 0, -PUERTO.uz);
  cameraTop.lookAt(c.x, 0, c.z);
  cameraTop.layers.enable(1);   // capa 1: marcadores solo visibles en el minimapa

  marcadorJugador = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  marcadorJugador.rotation.x = -Math.PI / 2;
  marcadorJugador.layers.set(1);
  grupoJuego.add(marcadorJugador);

  spawnJuego = aMundo(0, 14);   // mismo punto que usa proyecto.js

  // Precompilamos los shaders AHORA (con el overlay "Preparando...") para que no
  // haya tirones al abrir el menu ni al pulsar Jugar
  renderer.compile(scene, camera);
  juegoListo = true;
  menuPrincipal();
}

// El personaje FBX suele llegar despues que la isla: lo ocultamos y precompilamos
function prepararJugador() {
  jugadorPreparado = true;
  renderer.compile(scene, camera);   // con el ninja visible, para compilar sus materiales
  Jugador.raiz.visible = false;
  actualizarBotonJugar();
}

function crearMonedas() {
  var geo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 20);
  geo.rotateX(Math.PI / 2);
  var mat = new THREE.MeshPhongMaterial({ color: 0xffd400, emissive: 0x886600, shininess: 100 });
  var geoMarca = new THREE.CircleGeometry(2.2, 12);
  var matMarca = new THREE.MeshBasicMaterial({ color: 0xffd400 });

  JG.monedas.forEach(function (m) {
    var p = suelo(m[0], m[1]);
    var malla = new THREE.Mesh(geo, mat);
    malla.position.set(p.x, p.y + 1.0, p.z);
    grupoJuego.add(malla);

    var marca = new THREE.Mesh(geoMarca, matMarca);
    marca.rotation.x = -Math.PI / 2;
    marca.position.set(p.x, 500, p.z);
    marca.layers.set(1);
    grupoJuego.add(marca);

    listaMonedas.push({ malla: malla, marca: marca, yBase: p.y + 1.0, activa: true });
  });
}

// Cada foco cuelga de una torre y apunta con un SpotLight a un punto del suelo
// que se mueve segun su patron. La zona peligrosa es el disco de radio JG.radioFoco.
function crearFocos() {
  for (var i = 0; i < JG.patrones.length; i++) {
    var tt = JG.torres[i % JG.torres.length];
    var c = aMundo(tt[0], tt[1]);
    var yTorre = Math.max(alturaSuelo(c.x, c.z), alturaSuelo(c.x + 3, c.z),
                          alturaSuelo(c.x - 3, c.z), alturaSuelo(c.x, c.z + 3),
                          alturaSuelo(c.x, c.z - 3)) + JG.alturaTorre;

    var lampara = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 })
    );
    lampara.position.set(c.x, yTorre, c.z);
    grupoJuego.add(lampara);

    var luz = new THREE.SpotLight(0xfff2b0, 2.5, 0, 0.1, 0.3);
    luz.decay = 0;                // sin atenuacion por distancia (en versiones nuevas de three seria 2)
    luz.position.copy(lampara.position);
    grupoJuego.add(luz);
    grupoJuego.add(luz.target);   // imprescindible para que 'target' surta efecto

    // Disco que se adapta al relieve: sus vertices se recolocan cada frame
    var geoDisco = new THREE.CircleGeometry(JG.radioFoco, 24);
    geoDisco.rotateX(-Math.PI / 2);
    var base = geoDisco.attributes.position.array.slice();
    var disco = new THREE.Mesh(geoDisco, new THREE.MeshBasicMaterial({
      color: 0xffee88, transparent: true, opacity: 0.35, depthWrite: false
    }));
    disco.frustumCulled = false;
    grupoJuego.add(disco);

    var marca = new THREE.Mesh(
      new THREE.RingGeometry(JG.radioFoco * 0.6, JG.radioFoco, 24),
      new THREE.MeshBasicMaterial({ color: 0xff4040, side: THREE.DoubleSide })
    );
    marca.rotation.x = -Math.PI / 2;
    marca.layers.set(1);
    grupoJuego.add(marca);

    listaFocos.push({
      patron: JG.patrones[i], luz: luz, origen: lampara.position.clone(),
      disco: disco, base: base, marca: marca, objetivo: new THREE.Vector3(),
      // Obstaculos que pueden tapar ESTE foco: se excluye la torre de la que
      // cuelga (y cualquier objeto a menos de 4 m de la lampara en horizontal)
      obstaculos: obstaculos.filter(function (o) {
        return Math.hypot(o.position.x - lampara.position.x,
                          o.position.z - lampara.position.z) > 4;
      })
    });
  }
}

// ---------------- FLUJO ----------------
function empezarJuego() {
  if (!juegoListo || !Jugador.listo) return;
  recogidas = 0;
  tiempoPartida = 0;
  listaMonedas.forEach(function (m) { m.activa = true; m.malla.visible = true; m.marca.visible = true; });

  // Colocamos al ninja como al principio (igual que en proyecto.js)
  var J = Jugador;
  J.raiz.position.set(spawnJuego.x, alturaSuelo(spawnJuego.x, spawnJuego.z), spawnJuego.z);
  J.raiz.rotation.y = PUERTO.giro + Math.PI;
  J.yawCam = Math.atan2(PUERTO.ux, PUERTO.uz);
  J.pitchCam = J.cfg.camPitchInicial;
  J.vy = 0; J.enSuelo = true; J.saltando = false; J._temporizadorSalto = -1;
  for (var k in J.teclas) J.teclas[k] = false;
  J.raiz.visible = true;
  J._reproducir('idle');
  J._actualizarCamara(1000, true);

  overlay.style.display = 'none';
  hud.style.display = 'block';
  estado = 'jugando';
}

function perder() {
  estado = 'fin';
  mostrarMenu('¡TE HAN DESCUBIERTO!',
    'Monedas recogidas: ' + recogidas + ' / ' + listaMonedas.length, 'Reintentar');
}

function ganar() {
  estado = 'fin';
  mostrarMenu('¡VICTORIA!',
    'Has robado todo el tesoro en ' + tiempoPartida.toFixed(1) + ' s', 'Jugar de nuevo');
}

// ---------------- LOGICA POR FOTOGRAMA ----------------
function actualizarFocos() {
  listaFocos.forEach(function (f) {
    var p = f.patron(tFoco);
    var w = aMundo(p[0], p[1]);
    f.objetivo.set(w.x, alturaSuelo(w.x, w.z), w.z);
    f.luz.target.position.copy(f.objetivo);
    f.luz.angle = Math.atan(JG.radioFoco / f.origen.distanceTo(f.objetivo));

    var pos = f.disco.geometry.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = w.x + f.base[i * 3], z = w.z + f.base[i * 3 + 2];
      pos.setXYZ(i, x, alturaSuelo(x, z) + 0.2, z);
    }
    pos.needsUpdate = true;

    f.marca.position.set(w.x, 520, w.z);
  });
}

// Un foco te ve si estas dentro del disco y ningun obstaculo se interpone
// entre la lampara y tu pecho (rayo lampara -> jugador, como s3-colisiones)
// DETECCION: manda el disco del suelo (lo que ve el jugador).
// Te detectan si estas dentro del disco (radio del foco + radio del jugador)
// Y la luz te llega: basta con que UNO de tres puntos del cuerpo (pies, pecho,
// cabeza) tenga linea directa con la lampara. Solo te salvas si un obstaculo
// tapa los tres. La torre del propio foco nunca cuenta como obstaculo.
var PUNTOS_CUERPO = [0.3, 1.0, 1.7];
var _punto = new THREE.Vector3(), _dir = new THREE.Vector3();

function jugadorIluminado() {
  var p = Jugador.raiz.position;
  var radio = JG.radioFoco + Jugador.cfg.radioJugador;

  for (var i = 0; i < listaFocos.length; i++) {
    var f = listaFocos[i];
    var dx = p.x - f.objetivo.x, dz = p.z - f.objetivo.z;
    if (dx * dx + dz * dz > radio * radio) continue;   // fuera del disco: a salvo

    // Dentro del disco: si la oclusion esta desactivada, te detectan sin mas
    if (!JG.usarOclusion) return true;

    // Con oclusion: comprobamos si algun punto del cuerpo recibe la luz
    for (var k = 0; k < PUNTOS_CUERPO.length; k++) {
      _punto.set(p.x, p.y + PUNTOS_CUERPO[k], p.z);
      _dir.copy(_punto).sub(f.origen);
      var dist = _dir.length();
      raycasterLuz.set(f.origen, _dir.normalize());
      raycasterLuz.far = dist - 0.3;   // no contamos lo que toque al propio jugador
      var impactos = raycasterLuz.intersectObjects(f.obstaculos, true);
      raycasterLuz.far = Infinity;
      if (impactos.length === 0) return true;   // linea libre: te ven
    }
  }
  return false;
}

function recogerMonedas() {
  var p = Jugador.raiz.position;
  listaMonedas.forEach(function (m) {
    if (!m.activa) return;
    var dx = p.x - m.malla.position.x, dz = p.z - m.malla.position.z;
    if (dx * dx + dz * dz < JG.radioMoneda * JG.radioMoneda &&
        Math.abs(p.y + 1 - m.malla.position.y) < 2.5) {
      m.activa = false;
      m.malla.visible = false;
      m.marca.visible = false;
      recogidas++;
    }
  });
}

// Sustituye a update() de proyecto.js (se instala al final, ver instalarHooks)
function juegoUpdate() {
  var delta = Math.min(reloj.getDelta(), 0.1);   // evita saltos si la pestana estuvo en segundo plano

  if (faroHaz) faroHaz.rotation.y += delta * 0.7;

  // 1) Preparar la isla en cuanto exista (NO hace falta esperar al personaje)
  if (!juegoListo) {
    if (errorInicio || !hm_data || !PUERTO) return;   // la isla aun se esta construyendo
    if (!preparando) {          // un fotograma para que el navegador pinte "Preparando..."
      preparando = true;
      mostrarProgreso('Preparando la isla...');
      return;
    }
    try {
      inicializarJuego();
    } catch (err) {
      errorInicio = true;
      console.error('juego.js: error al inicializar', err);
      overlay.innerHTML = '<h1>Error al iniciar el juego</h1><p>' + err.message +
                          '</p><small>Mas detalles en la consola (F12)</small>';
    }
    return;
  }

  // 2) El personaje llega mas tarde: cuando este listo se activa el boton Jugar
  if (!jugadorPreparado) {
    if (Jugador.listo) {
      prepararJugador();
    } else if (performance.now() - tInicio > 30000 && !erroresCarga.length && botonJugar) {
      botonJugar.textContent = 'El personaje tarda mucho... (F12 para ver la consola)';
    }
  }

  // Los focos se mueven siempre (tambien en el menu)
  if (estado === 'jugando') tFoco = tiempoPartida; else if (estado === 'menu') tFoco += delta;
  actualizarFocos();

  var tiempoMon = performance.now() / 1000;
  listaMonedas.forEach(function (m) {
    m.malla.rotation.y += 2 * delta;
    m.malla.position.y = m.yBase + Math.sin(tiempoMon * 2) * 0.1;
  });

  if (estado === 'jugando') {
    tiempoPartida += delta;
    Jugador.actualizar(delta);     // movimiento, animaciones y camara en 3a persona
    recogerMonedas();
    marcadorJugador.position.set(Jugador.raiz.position.x, 510, Jugador.raiz.position.z);
    hud.textContent = 'Monedas: ' + recogidas + ' / ' + listaMonedas.length +
                      '   Tiempo: ' + tiempoPartida.toFixed(1);

    // Si coges la ultima moneda y a la vez te ilumina un foco, gana el jugador
    if (recogidas === listaMonedas.length) ganar();
    else if (jugadorIluminado()) perder();
  } else if (estado === 'menu') {
    // camara que orbita el poblado
    anguloMenu += 0.1 * delta;
    camera.position.set(centroPoblado.x + Math.cos(anguloMenu) * 110, centroPoblado.y + 60,
                        centroPoblado.z + Math.sin(anguloMenu) * 110);
    camera.lookAt(centroPoblado);
  }
}

// Sustituye a render() de proyecto.js: vista principal + minimapa
function juegoRender() {
  requestAnimationFrame(juegoRender);
  juegoUpdate();

  var W = window.innerWidth, H = window.innerHeight;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, H);
  renderer.render(scene, camera);

  if (estado === 'jugando') {
    var lado = Math.min(W, H) / 3.5, margen = 16;
    var x = W - lado - margen, y = H - lado - margen;
    renderer.setViewport(x, y, lado, lado);
    renderer.setScissor(x, y, lado, lado);
    renderer.setScissorTest(true);
    // Sin niebla en el minimapa: en vez de poner scene.fog = null (que obliga a three.js
    // a recalcular los programas de TODOS los materiales cada frame) alejamos la niebla
    var nNear = fogJuego.near, nFar = fogJuego.far;
    fogJuego.near = 1e7; fogJuego.far = 2e7;
    renderer.render(scene, cameraTop);
    fogJuego.near = nNear; fogJuego.far = nFar;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
  }
}

crearInterfaz();

// Instalamos update/render cuando TODOS los scripts ya se han ejecutado, asi da igual
// el orden en el HTML: ni proyecto.js (que tambien define update/render) puede pisarlos.
function instalarHooks() {
  window.update = juegoUpdate;
  window.render = juegoRender;   // la cadena de requestAnimationFrame de proyecto.js pasa a la nuestra
  console.log('juego.js v2: hooks instalados (update/render)');
}
console.log('juego.js v2 cargado');
if (document.readyState === 'complete') instalarHooks();
else window.addEventListener('load', instalarHooks);