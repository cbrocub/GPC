// Variables globales
var renderer, scene, camera;
var cameraControls;
var caja1, caja2, caja3;
var bisagra1, bisagra2;

// --- CLASE/OBJETO BISAGRA ---
class Bisagra extends THREE.Object3D {
  constructor(radio = 0.35, largo = 3.2) {
    super();

    // Aspecto visual de la junta/bisagra (eje cilindrico)
    var geo = new THREE.CylinderGeometry(radio, radio, largo, 16);
    var mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    this.pasador = new THREE.Mesh(geo, mat);
    this.pasador.rotation.x = Math.PI / 2; // Alineado horizontalmente en el eje Z
    this.add(this.pasador);
  }

  // Pega la bisagra en un punto concreto del elemento padre
  conectarAPadre(piezaPadre, posicionJunta) {
    this.position.copy(posicionJunta);
    piezaPadre.add(this);
  }

  // Pega la pieza hija a la bisagra ajustando el desplazamiento
  conectarHijo(piezaHija, offsetHijo) {
    piezaHija.position.copy(offsetHijo);
    this.add(piezaHija);
  }

  // Rota la bisagra sobre el eje de la junta
  rotar(angulo) {
    this.rotation.z = angulo;
  }
}


// 1- Inicializa 
init();
// 2- Crea la escena
loadScene();
// 3- Renderiza
render();

function init()
{
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 100 );
  camera.position.set( 5, 10, 20 );

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  window.addEventListener('resize', updateAspectRatio );
}


function loadScene() {
    var materialCajas = new THREE.MeshNormalMaterial();

    // 1. Pieza base (Caja 1)
    caja1 = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), materialCajas);
    scene.add(caja1);

    // 2. PRIMERA BISAGRA (Pega Caja 1 con Caja 2)
    bisagra1 = new Bisagra();
    // Pegamos la bisagra a la junta superior derecha de la Caja 1
    bisagra1.conectarAPadre(caja1, new THREE.Vector3(2.5, 0.5, 0));

    caja2 = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 3), materialCajas);
    // Pegamos la Caja 2 a la Bisagra 1
    bisagra1.conectarHijo(caja2, new THREE.Vector3(0.5, 2.5, 0));

    // 3. SEGUNDA BISAGRA (Pega Caja 2 con Caja 3)
    bisagra2 = new Bisagra();
    // Pegamos la segunda bisagra al extremo superior de la Caja 2
    bisagra2.conectarAPadre(caja2, new THREE.Vector3(0, 2.5, 0));

    caja3 = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 3), materialCajas);
    // Pegamos la Caja 3 a la Bisagra 2
    bisagra2.conectarHijo(caja3, new THREE.Vector3(2.5, 0.5, 0));

    scene.add( new THREE.AxesHelper(15) );
}


function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

var time = 0;
function update()
{
  time += 0.02;
  cameraControls.update();

  // Movimiento suave de la base
  caja1.rotation.z = Math.sin(time * 0.5) * 0.15;

  // Al rotar el objeto Bisagra, la junta rota y mueve todo lo que tenga unido
  bisagra1.rotar(Math.sin(time) * 0.8);
  bisagra2.rotar(Math.cos(time * 1.3) * 0.6);
}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}