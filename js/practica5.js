// Variables globales de Three.js
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;

// Cámara y parámetros de la vista miniatura
var miniCamera;
var miniViewSize = 200; // medio-tamaño (en unidades de escena) que abarca la miniatura

// Objetos del robot para su articulación e interacción
var robot_brazo, base, brazo, antebrazo, mano, pinzaIz, pinzaDe;

// Materiales del robot, para poder alternar alambrico/solido (P4)
// todos a la vez, ya que ahora cada pieza tiene su propio material (P5)
var materialesRobot = [];

// Carpeta de imagenes y cargador de texturas 
var RUTA_IMAGENES = 'images/';
var cargadorTexturas = new THREE.TextureLoader();

// Mapa de entorno (cubemap) que usa la rotula para reflejar la habitacion (P5)
var mapaEntorno;

// Controlador para la interfaz gráfica de usuario (lil-gui)
var effectController;
var gui;

// 1. Inicializa la escena, cámara, controles e interacciones
init();
// 2. Construye la habitacion y su mapa de entorno (P5, punto 7)
crearHabitacion();
// 3. Crea los objetos de la escena (usa mapaEntorno para la rotula)
loadScene();
// 4. Añade las luces (P5, punto 1)
crearLuces();
// 5. Inicializa la interfaz gráfica lil-gui
setupGUI();
// 6. Bucle de renderizado
render();

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  // Sombras (P5, puntos 1 y 6)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 3000 );
  camera.position.set( 300, 300, 300 );

  // La cámara principal se controla con el ratón mediante OrbitControls:
  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  //cameraControls.maxDistance = 450;

  // Cámara cenital para la vista miniatura
  miniCamera = new THREE.OrthographicCamera(
      -miniViewSize, miniViewSize,   // left, right
       miniViewSize, -miniViewSize,  // top, bottom
       0.1, 3000
  );
  miniCamera.position.set(0, 1000, 0);
  miniCamera.up.set(0, 0, -1); // evita el vector "up" al mirar hacia abajo
  miniCamera.lookAt(0, 0, 0);

  window.addEventListener('resize', updateAspectRatio );
  setupKeyboard();
}

// P5: texturas cargadas desde la carpeta images
function cargarTextura(fichero, repX, repY)
{
    var tex = cargadorTexturas.load(RUTA_IMAGENES + fichero);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX || 1, repY || repX || 1);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

// Textura para una pared de la habitacion. 
function texturaPared(fichero)
{
    var tex = cargadorTexturas.load(RUTA_IMAGENES + fichero);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.x = -1;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
}

// P5, punto 7: habitacion (paredes) + mapa de entorno de la rotula.

function crearHabitacion()
{
   
    var caras = ['posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg'];

    // Mapa de entorno para la rotula
    mapaEntorno = new THREE.CubeTextureLoader().setPath(RUTA_IMAGENES).load(caras);

    var materialesHabitacion = caras.map(function(fichero) {
        return new THREE.MeshBasicMaterial({
            map: texturaPared(fichero),
            side: THREE.BackSide
        });
    });

    var ladoHabitacion = 1000; // mismo tamaño que el suelo (1000 x 1000)
    var geometriaHabitacion = new THREE.BoxGeometry(ladoHabitacion, ladoHabitacion, ladoHabitacion);
    var habitacion = new THREE.Mesh(geometriaHabitacion, materialesHabitacion);
  
    habitacion.position.y = ladoHabitacion / 2 - 1;
    scene.add(habitacion);
}

// P5: luces de la escena. Ambiental + direccional + focal
function crearLuces()
{
    var luzAmbiental = new THREE.AmbientLight(0x606068, 0.7);
    scene.add(luzAmbiental);

    var luzDireccional = new THREE.DirectionalLight(0xfff3e0, 0.7);
    luzDireccional.position.set(300, 400, 200);
    luzDireccional.castShadow = true;
    luzDireccional.shadow.mapSize.set(2048, 2048);
    luzDireccional.shadow.camera.left = -400;
    luzDireccional.shadow.camera.right = 400;
    luzDireccional.shadow.camera.top = 400;
    luzDireccional.shadow.camera.bottom = -400;
    luzDireccional.shadow.camera.near = 50;
    luzDireccional.shadow.camera.far = 1200;
    scene.add(luzDireccional);

    var luzFocal = new THREE.SpotLight(0xffffff, 1.0, 1200, Math.PI / 6, 0.3, 1);
    luzFocal.position.set(-220, 350, 250);
    luzFocal.castShadow = true;
    luzFocal.shadow.mapSize.set(2048, 2048);
    luzFocal.shadow.camera.near = 50;
    luzFocal.shadow.camera.far = 1000;
    luzFocal.target.position.set(0, 50, 0);
    scene.add(luzFocal);
    scene.add(luzFocal.target); // imprescindible para que 'target' surta efecto
}

function loadScene()
{
    // Funcion auxiliar: registra un material para poder alternar su
    // modo alambrico/solido desde la interfaz (P4/P5)
    function registrarMaterial(m)
    {
        materialesRobot.push(m);
        return m;
    }

    // Materiales y texturas de las piezas del robot (P5, puntos 3 y 4) 
   
    var matMetal = registrarMaterial(new THREE.MeshPhongMaterial({
        map: cargarTextura('metal_128.jpg', 2),
        shininess: 90, specular: 0x999999
    })); // brillante (Phong): base, eje, columnas, mano

    var matPintura = registrarMaterial(new THREE.MeshLambertMaterial({
        map: cargarTextura('wood512.jpg', 1)
    })); // mate (Lambert): esparrago, disco

    // Rotula: metal dorado (textura metalica teñida) + reflejo del mapa de
    // entorno 
    var matRotula = registrarMaterial(new THREE.MeshPhongMaterial({
        map: cargarTextura('metal_128.jpg', 1),
        color: 0xffd479,
        envMap: mapaEntorno,
        combine: THREE.MixOperation,
        reflectivity: 0.9,
        shininess: 120,
        specular: 0xffffff
    })); // brillante (Phong) + mapa de entorno obligatorio

    var matPinza = registrarMaterial(new THREE.MeshLambertMaterial({
        map: cargarTextura('burberry_256.jpg', 1)
    })); // mate (Lambert), con textura (P5, punto 5)

    var matSuelo = new THREE.MeshPhongMaterial({
        map: cargarTextura('pisometalico_1024.jpg', 4),
        shininess: 40, specular: 0x555555
    }); // textura del suelo (P5, punto 2); no se alterna a alambrico

    // Funcion auxiliar para construir los dedos de la pinza (grosor total en Z = 4)
    function crearDedo(materialDedo)
    {
        let dedo = new THREE.Object3D();
        // Paralelepípedo
        let caja = new THREE.Mesh(new THREE.BoxGeometry(20, 19, 4), materialDedo);
        caja.position.x = 10;
        caja.castShadow = true;
        caja.receiveShadow = true;
        dedo.add(caja);

        let B0 = [20, -10, -2], B1 = [20,  10, -2], B2 = [20,  10,  2], B3 = [20, -10,  2]; // Vértices base 
        let T0 = [38, -5,   -1], T1 = [38,  5,   -1], T2 = [38,  5,    1], T3 = [38, -5,    1]; // Vértices punta

        let posiciones = [];
        let normales = [];
        let uvs = [];

        function cara(a, b, c, d, n)
        {
            let vertices = [a, b, c, a, c, d];
            let coordUV = [[0,0], [1,0], [1,1], [0,0], [1,1], [0,1]];
            for (let i = 0; i < vertices.length; i++) {
                posiciones.push(vertices[i][0], vertices[i][1], vertices[i][2]);
                normales.push(n[0], n[1], n[2]);
                uvs.push(coordUV[i][0], coordUV[i][1]);
            }
        }

        cara(T0, T1, T2, T3, [1, 0, 0]);               // punta (+X)
        cara(B1, B2, T2, T1, [0.2425,  0.9701, 0]);    // lateral +Y
        cara(B3, B0, T0, T3, [0.2425, -0.9701, 0]);    // lateral -Y
        cara(B2, B3, T3, T2, [0.0555, 0,  0.9985]);    // lateral +Z
        cara(B0, B1, T1, T0, [0.0555, 0, -0.9985]);    // lateral -Z

        let geoPunta = new THREE.BufferGeometry();
        geoPunta.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posiciones), 3));
        geoPunta.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(normales), 3));
        geoPunta.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
        let mallaPunta = new THREE.Mesh(geoPunta, materialDedo);
        mallaPunta.castShadow = true;
        mallaPunta.receiveShadow = true;
        dedo.add(mallaPunta);

        return dedo;
    }

    // Nodo raíz del robot (se mueve sobre el plano XZ)
    robot_brazo = new THREE.Object3D();

    // 1. Base (Cilindro)
    let radioBase = 50, alturaBase = 15;
    base = new THREE.Object3D();
    let geometriaBase = new THREE.CylinderGeometry(radioBase, radioBase, alturaBase, 32);
    let cilindro = new THREE.Mesh(geometriaBase, matMetal);
    cilindro.position.y = alturaBase / 2;
    cilindro.castShadow = true;
    cilindro.receiveShadow = true;
    base.add(cilindro);
    robot_brazo.add(base);

    // 2. Brazo
    brazo = new THREE.Object3D();
    brazo.position.y = alturaBase;
    base.add(brazo);

    // Cilindro tumbado (eje del brazo orientando su eje a lo largo de Z)
    let radioEjeCilindro = 20, alturaEjeCilindro = 18;
    let geometriaEje = new THREE.CylinderGeometry(radioEjeCilindro, radioEjeCilindro, alturaEjeCilindro, 32);
    let eje = new THREE.Mesh(geometriaEje, matMetal);
    eje.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2); // Orientado en el eje Z
    eje.castShadow = true;
    eje.receiveShadow = true;
    brazo.add(eje);

    // Rectángulo (Espárrago)
    let anchoRectangulo = 18, largoRectangulo = 120, fondoRectangulo = 12;
    let geometriaEsparrago = new THREE.BoxGeometry(anchoRectangulo, largoRectangulo, fondoRectangulo);
    let rectangulo = new THREE.Mesh(geometriaEsparrago, matPintura);
    rectangulo.position.y = largoRectangulo / 2;
    rectangulo.castShadow = true;
    rectangulo.receiveShadow = true;
    brazo.add(rectangulo);

    // Esfera (Rótula) en el extremo del brazo -- obligatoriamente con mapa de entorno
    let radioEsfera = 20;
    let geometriaRotula = new THREE.SphereGeometry(radioEsfera, 32, 32);
    let rotula = new THREE.Mesh(geometriaRotula, matRotula);
    rotula.position.y = largoRectangulo;
    rotula.castShadow = true;
    rotula.receiveShadow = true;
    brazo.add(rotula);

    // 3. Antebrazo
    antebrazo = new THREE.Object3D();
    antebrazo.position.y = largoRectangulo;
    brazo.add(antebrazo);

    // Disco base del antebrazo
    let radioDisco = 22, alturaDisco = 6;
    let geometriaDisco = new THREE.CylinderGeometry(radioDisco, radioDisco, alturaDisco, 32);
    let disco = new THREE.Mesh(geometriaDisco, matPintura);
    disco.castShadow = true;
    disco.receiveShadow = true;
    antebrazo.add(disco);

    // 4 Columnas sobre el disco
    let anchoColumna = 4, largoColumna = 80;
    let geometriaColumna = new THREE.BoxGeometry(anchoColumna, largoColumna, anchoColumna);
    let separacion = 8;
    let posColumnas = [
        [separacion, separacion], [-separacion, separacion],
        [separacion, -separacion], [-separacion, -separacion]
    ];
    for (let i = 0; i < posColumnas.length; i++) {
        let columna = new THREE.Mesh(geometriaColumna, matMetal);
        columna.position.set(posColumnas[i][0], largoColumna / 2, posColumnas[i][1]);
        columna.castShadow = true;
        columna.receiveShadow = true;
        antebrazo.add(columna);
    }

    // 4. Mano (Cilindro tumbado)
    let radioMano = 15, alturaMano = 40;
    mano = new THREE.Object3D();
    mano.position.y = largoColumna;
    antebrazo.add(mano);

    let geometriaMano = new THREE.CylinderGeometry(radioMano, radioMano, alturaMano, 32);
    let cilindroMano = new THREE.Mesh(geometriaMano, matMetal);
    cilindroMano.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    cilindroMano.castShadow = true;
    cilindroMano.receiveShadow = true;
    mano.add(cilindroMano);

    // 5. Pinzas / Dedos
    pinzaIz = crearDedo(matPinza);
    pinzaIz.position.z = -12; // -(2 + 10)  
    mano.add(pinzaIz);

    pinzaDe = crearDedo(matPinza);
    pinzaDe.position.z = 12;  // +(2 + 10)
    mano.add(pinzaDe);

    scene.add(robot_brazo);

    // Plano del suelo, con textura de chapa metalica (P5, punto 2)
    let geometriaPiso = new THREE.PlaneGeometry(1000, 1000, 10, 10);
    let piso = new THREE.Mesh(geometriaPiso, matSuelo);
    piso.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    piso.receiveShadow = true;
    scene.add(piso);
}

// Configuración del movimiento con las flechas del teclado
function setupKeyboard()
{
  window.addEventListener('keydown', function(event) {
    const paso = 5;
    switch (event.key) {
      case 'ArrowUp':
      case 'Up':
        robot_brazo.position.z -= paso;
        break;
      case 'ArrowDown':
      case 'Down':
        robot_brazo.position.z += paso;
        break;
      case 'ArrowLeft':
      case 'Left':
        robot_brazo.position.x -= paso;
        break;
      case 'ArrowRight':
      case 'Right':
        robot_brazo.position.x += paso;
        break;
    }
  });
}

// Configuración de la GUI
function setupGUI()
{
  effectController = {
    giroBase: 0.0,
    giroBrazo: 0.0,
    giroAntebrazoY: 0.0,
    giroAntebrazoZ: 0.0,
    giroPinza: 0.0,
    separacionPinza: 10.0,
    alambres: false,
    anima: function() {
      animarRobot();
    }
  };

  const GUIConstructor = window.GUI || (window.lil && window.lil.GUI);
  if (!GUIConstructor) return;

  gui = new GUIConstructor({ title: 'Control Robot' });

  gui.add(effectController, 'giroBase', -180, 180, 1).name('Giro Base').listen().onChange(updateRobot);
  gui.add(effectController, 'giroBrazo', -45, 45, 1).name('Giro Brazo').listen().onChange(updateRobot);
  gui.add(effectController, 'giroAntebrazoY', -180, 180, 1).name('Giro Antebrazo Y').listen().onChange(updateRobot);
  gui.add(effectController, 'giroAntebrazoZ', -90, 90, 1).name('Giro Antebrazo Z').listen().onChange(updateRobot);
  gui.add(effectController, 'giroPinza', -40, 220, 1).name('Giro Pinza').listen().onChange(updateRobot);
  gui.add(effectController, 'separacionPinza', 0, 15, 1).name('Separacion Pinza').listen().onChange(updateRobot);
  gui.add(effectController, 'alambres').name('alambres').onChange(function(val) {
    materialesRobot.forEach(function(m) { m.wireframe = val; });
  });
  gui.add(effectController, 'anima').name('Anima');

  updateRobot();
}

function updateRobot()
{
  if (base) {
    base.rotation.y = THREE.MathUtils.degToRad(effectController.giroBase);
  }
  if (brazo) {
    brazo.rotation.z = -THREE.MathUtils.degToRad(effectController.giroBrazo);
  }
  if (antebrazo) {
    antebrazo.rotation.y = THREE.MathUtils.degToRad(effectController.giroAntebrazoY);
    antebrazo.rotation.z = THREE.MathUtils.degToRad(effectController.giroAntebrazoZ);
  }
  if (mano) {
    mano.rotation.z = THREE.MathUtils.degToRad(effectController.giroPinza);
  }
  if (pinzaIz && pinzaDe) {
    // Offset de 2 unidades (semiancho de cada dedo) para que con separacion 0 se toquen sin solaparse
    const offset = 2;
    pinzaIz.position.z = -(offset + effectController.separacionPinza);
    pinzaDe.position.z = (offset + effectController.separacionPinza);
  }
  materialesRobot.forEach(function(m) { m.wireframe = effectController.alambres; });
}

// Animación mediante secuencia de Tween.js
function animarRobot()
{
  if (typeof TWEEN === 'undefined') return;

  TWEEN.removeAll();

  var p1 = {
    giroBase: 90,
    giroBrazo: -30,
    giroAntebrazoY: 45,
    giroAntebrazoZ: -40,
    giroPinza: 90,
    separacionPinza: 15
  };

  var p2 = {
    giroBase: -90,
    giroBrazo: 25,
    giroAntebrazoY: -90,
    giroAntebrazoZ: 40,
    giroPinza: 180,
    separacionPinza: 0
  };

  var p3 = {
    giroBase: 0,
    giroBrazo: 0,
    giroAntebrazoY: 0,
    giroAntebrazoZ: 0,
    giroPinza: 0,
    separacionPinza: 10
  };

  var duracion = 2000;

  var t1 = new TWEEN.Tween(effectController)
    .to(p1, duracion)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(updateRobot);

  var t2 = new TWEEN.Tween(effectController)
    .to(p2, duracion)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(updateRobot);

  var t3 = new TWEEN.Tween(effectController)
    .to(p3, duracion)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate(updateRobot);

  t1.chain(t2);
  t2.chain(t3);

  t1.start();
}

function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update()
{
  if (typeof TWEEN !== 'undefined') {
    TWEEN.update();
  }
  cameraControls.update();
}

function render()
{
  requestAnimationFrame( render );
  update();

  var width = window.innerWidth;
  var height = window.innerHeight;

  var miniSize = Math.min(width, height) / 4;

  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  renderer.setScissorTest( true );

  // Vista general
  renderer.setViewport( 0, 0, width, height );
  renderer.setScissor( 0, 0, width, height );
  renderer.render( scene, camera );

  // Vista miniatura
  renderer.setViewport( 0, height - miniSize, miniSize, miniSize );
  renderer.setScissor( 0, height - miniSize, miniSize, miniSize );
  renderer.render( scene, miniCamera );

  renderer.setScissorTest( false );
}
