// Variables globales
var renderer, scene, camera;
var cameraTop;

var angulo = -0.01;
var speed = 0.1;
// Posición del jugador (Y=3 para que repose justo encima del piso Y=0)
var p_pos = new THREE.Vector3(0, 3, 0);

// Objeto que representa al personaje
var player_obj;

const controls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    speed: 0.35
};

// Event listeners para controles
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            controls.moveForward = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            controls.moveBackward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            controls.moveLeft = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            controls.moveRight = true;
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            controls.moveForward = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            controls.moveBackward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            controls.moveLeft = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            controls.moveRight = false;
            break;
    }
});


// 1- Inicializa 
init();
// 2- Crea una escena
loadScene();
// 3- Renderiza
render();

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0xFFFFFF));
    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();

    var aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(50, aspectRatio, 1, 10000);

    // Vista de planta
    cameraTop = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 1000);
    cameraTop.position.set(0, 500, 0);
    cameraTop.lookAt(0, 0, 0);
    cameraTop.up.set(0, 0, 1);
    cameraTop.updateProjectionMatrix();

    window.addEventListener('resize', updateAspectRatio);
}



function loadScene() {
    // Ayudante de ejes
    scene.add(new THREE.AxesHelper(15));

    // Suelo
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    scene.add(plane);

    // Edificios
    for (let i = 0; i < 100; i++) {
        const width = 3 + Math.random() * 5;
        const depth = 3 + Math.random() * 5;
        const height = Math.random() * 15 + 5;

        const boxGeometry = new THREE.BoxGeometry(width, height, depth);
        const boxMaterial = new THREE.MeshNormalMaterial();

        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = Math.random() * 100 - 50;
        box.position.z = Math.random() * 100 - 50;
        box.position.y = height / 2;

        scene.add(box);
    }

    // Objeto del personaje (Radio = 3, resting on Y=0)
    const playerGeo = new THREE.SphereGeometry(3, 3, 3);
    playerGeo.rotateY(Math.PI / 2); // Orientar la punta hacia adelante

    const playerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    player_obj = new THREE.Mesh(playerGeo, playerMat);
    scene.add(player_obj);
}


function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function update() {
    // Rotación
    if (controls.moveLeft) angulo += 0.05;
    if (controls.moveRight) angulo -= 0.05;

    // Vector de dirección de movimiento
    let velocity = new THREE.Vector3(Math.sin(angulo), 0, Math.cos(angulo));

    // Traslación del personaje
    if (controls.moveForward) {
        p_pos.add(velocity.clone().multiplyScalar(controls.speed));
    }
    if (controls.moveBackward) {
        p_pos.sub(velocity.clone().multiplyScalar(controls.speed));
    }

    // Actualizar posición y rotación del modelo del personaje
    player_obj.position.copy(p_pos);
    player_obj.rotation.y = angulo;

    // --- CÁMARA EN TERCERA PERSONA ---
    // Colocamos la cámara detrás del jugador (restando dirección) y ligeramente elevada
    var distanciaDetras = 15;
    var alturaCamara = 8;

    var camPos = p_pos.clone()
        .sub(velocity.clone().multiplyScalar(distanciaDetras))
        .add(new THREE.Vector3(0, alturaCamara, 0));

    camera.position.copy(camPos);
    camera.lookAt(p_pos); // Apuntar hacia la posición del personaje
}



function render() {
    requestAnimationFrame(render);
    update();

    // 1. Vista 3D Perspectiva (En 3ª persona el personaje DEBE ser visible)
    player_obj.visible = true;
    renderer.autoClear = false;
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0xa2a2f2));
    renderer.clear();
    renderer.render(scene, camera);

    // 2. Vista de Planta (vista superior)
    var ds = Math.min(window.innerHeight, window.innerWidth) / 4;
    renderer.setViewport(0, 0, ds, ds);
    renderer.setScissor(0, 0, ds, ds);
    renderer.setScissorTest(true);
    renderer.setClearColor(new THREE.Color(0x00ffff));
    renderer.clear();
    renderer.setScissorTest(false);
    renderer.render(scene, cameraTop);
}