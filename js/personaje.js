// ============================================================================
//  personaje.js  -  Jugador en 3ª persona con animaciones de Mixamo (FBX)
//
//  Requiere (ya los usáis en clase): three.js + FBXLoader (THREE.FBXLoader)
//  Cargad este fichero DESPUÉS de FBXLoader y ANTES de vuestro fichero principal.
//
//  Controles:  W/A/S/D o flechas = mover (relativo a la cámara)
//              Shift = correr        Espacio = saltar
//              Arrastrar con el ratón = girar cámara     Rueda = zoom
// ============================================================================

const PERSONAJE_CFG = {

    // ------------------------------------------------------------------------
    //  RUTAS A LOS ARCHIVOS DE MIXAMO  -->  SOLO HAY QUE CAMBIAR ESTAS LÍNEAS
    // ------------------------------------------------------------------------
    modelo: 'models/personaje/personaje.fbx',     // <<< CAMBIAR: personaje (FBX "With Skin")
    anim: {
        idle:   'models/personaje/idle.fbx',      // <<< CAMBIAR: animación parado
        andar:  'models/personaje/walk.fbx',      // <<< CAMBIAR: animación andar
        correr: 'models/personaje/run.fbx',       // <<< CAMBIAR: animación correr (o null)
        saltar: 'models/personaje/jump.fbx'       // <<< CAMBIAR: animación saltar (o null)
    },
    // Poned null en una animación si no la tenéis; el juego sigue funcionando.
    // ------------------------------------------------------------------------

    // ----- Escala y movimiento (ajustar a la escala de vuestra isla) -----
    alturaPersonaje: 1.8,    // altura final del personaje en unidades de escena (se auto-escala)
    velAndar:  4.0,          // unidades / segundo
    velCorrer: 8.0,
    velGiro:   12,           // rapidez con la que el personaje se orienta hacia donde camina
    gravedad:  25,
    velSalto:  8,            // impulso vertical inicial
    retrasoSalto: 0.15,      // segundos de "agacharse" antes del impulso (0 = inmediato)
    umbralCaida: 0.5,        // desnivel a partir del cual empieza a caer en vez de pegarse al suelo
    posicionInicial: { x: 0, z: 0 },
    fundido: 0.2,            // segundos de transición entre animaciones

    // Si descargáis las animaciones SIN marcar "In Place", poned true:
    // fija el X/Z de la cadera para que el personaje no se desplace solo.
    anclarRaiz: true,

    // ----- Cámara 3ª persona -----
    camDistancia: 3,
    camDistMin: 2,
    camDistMax: 3,
    camAlturaObjetivo: 1.5,  // punto al que mira la cámara (a la altura de la cabeza)
    camPitchInicial: 0.35,   // radianes
    camPitchMin: -0.2,
    camPitchMax: 1.3,
    camSensibilidad: 0.005,
    camSuavizado: 10,        // más alto = cámara más pegada al personaje

    // ----- Suelo -----
    // Opción A: malla del terreno para raycast hacia abajo (como en s3-colisiones):
    //           Jugador.cfg.terreno = meshTerreno;   (mesh o grupo)
    // Opción B (más rápida con heightmap grande): función propia (x,z) -> altura:
    //           Jugador.cfg.funcionAltura = function(x, z) { return ...; };
    // Si no se define ninguna, el suelo está en y = 0.
    terreno: null,
    funcionAltura: null,

    // ----- Colisiones -----
    // Función opcional: resolverColision(pos, xAnterior, zAnterior, radio)
    // Se llama tras cada movimiento y puede corregir pos.x / pos.z.
    radioJugador: 0.4,
    resolverColision: null
};


const Jugador = {

    cfg: PERSONAJE_CFG,

    // Estado interno
    raiz: null,          // Object3D que se mueve por la escena (pies en raiz.position)
    modelo: null,        // el FBX de Mixamo (hijo de raiz)
    mixer: null,
    acciones: {},
    accionActual: null,
    listo: false,

    vy: 0,
    enSuelo: true,
    saltando: false,
    _temporizadorSalto: -1,

    yawCam: 0,
    pitchCam: 0,
    distCam: 0,

    teclas: { adelante: false, atras: false, izquierda: false, derecha: false, correr: false, saltar: false },

    _rayo: new THREE.Raycaster(),
    _origenRayo: new THREE.Vector3(),
    _abajo: new THREE.Vector3(0, -1, 0)
};


// ----------------------------------------------------------------------------
//  Carga del personaje y las animaciones
//  scene, camera: los de vuestro proyecto.  domElement: renderer.domElement
//  alTerminar (opcional): función que se llama cuando todo está cargado
// ----------------------------------------------------------------------------
Jugador.cargar = function (scene, camera, domElement, alTerminar)
{
    const cfg = this.cfg;
    const self = this;
    this.scene = scene;
    this.camera = camera;

    this.pitchCam = cfg.camPitchInicial; this.yawCam = Math.PI; 
    this.distCam = cfg.camDistancia;

    this._iniciarEntrada(domElement);

    const loader = new THREE.FBXLoader();

    loader.load(cfg.modelo, function (obj) {

        // Ajustes de mallas y materiales
        obj.traverse(function (hijo) {
            if (hijo.isMesh) {
                hijo.castShadow = true;
                hijo.receiveShadow = true;
                hijo.frustumCulled = false;   // evita que el personaje desaparezca al animarse
                const mats = Array.isArray(hijo.material) ? hijo.material : [hijo.material];
                mats.forEach(function (m) {
                    if (m) { m.transparent = false; m.opacity = 1.0; }  // evita transparencias raras de Mixamo
                });
            }
        });

        // Auto-escala: Mixamo exporta en centímetros (~180 unidades de alto)
        const caja = new THREE.Box3().setFromObject(obj);
        const alto = caja.max.y - caja.min.y;
        obj.scale.setScalar(cfg.alturaPersonaje / alto);
        // Colocar los pies en y = 0
        const caja2 = new THREE.Box3().setFromObject(obj);
        obj.position.y -= caja2.min.y;

        self.modelo = obj;
        self.raiz = new THREE.Object3D();
        self.raiz.add(obj);
        scene.add(self.raiz);

        self.mixer = new THREE.AnimationMixer(obj);

        self._cargarAnimaciones(loader, function () {

            // Posición inicial sobre el suelo
            const x = cfg.posicionInicial.x, z = cfg.posicionInicial.z;
            self.raiz.position.set(x, self.alturaEn(x, z), z);

            // Colocar la cámara de golpe detrás del personaje
            self._actualizarCamara(1000, true);

            self._reproducir('idle');
            self.listo = true;
            if (alTerminar) alTerminar(self);
        });

    }, undefined, function (error) {
        console.error('Jugador: no se pudo cargar el modelo "' + cfg.modelo + '"', error);
    });
};


Jugador._cargarAnimaciones = function (loader, alTerminar)
{
    const cfg = this.cfg;
    const self = this;
    const nombres = Object.keys(cfg.anim).filter(function (n) { return cfg.anim[n]; });
    let pendientes = nombres.length;

    if (pendientes === 0) { alTerminar(); return; }

    nombres.forEach(function (nombre) {
        loader.load(cfg.anim[nombre], function (fbx) {

            if (!fbx.animations || fbx.animations.length === 0) {
                console.warn('Jugador: "' + cfg.anim[nombre] + '" no contiene animaciones');
            } else {
                const clip = fbx.animations[0];
                clip.name = nombre;

                if (cfg.anclarRaiz) self._anclarCadera(clip);

                const accion = self.mixer.clipAction(clip);
                if (nombre === 'saltar') {
                    accion.setLoop(THREE.LoopOnce, 1);
                    accion.clampWhenFinished = true;
                }
                self.acciones[nombre] = accion;
            }

            if (--pendientes === 0) alTerminar();

        }, undefined, function (error) {
            console.error('Jugador: no se pudo cargar la animación "' + cfg.anim[nombre] + '"', error);
            if (--pendientes === 0) alTerminar();
        });
    });
};


// Fija el desplazamiento horizontal (X,Z) de la cadera al de su primer fotograma
Jugador._anclarCadera = function (clip)
{
    clip.tracks.forEach(function (track) {
        if (track.name.toLowerCase().indexOf('hips.position') !== -1) {
            const v = track.values;
            const x0 = v[0], z0 = v[2];
            for (let i = 0; i < v.length; i += 3) {
                v[i] = x0;
                v[i + 2] = z0;
            }
        }
    });
};


// ----------------------------------------------------------------------------
//  Entrada: teclado y ratón
// ----------------------------------------------------------------------------
Jugador._iniciarEntrada = function (domElement)
{
    const self = this;
    const t = this.teclas;

    function cambiar(codigo, valor) {
        switch (codigo) {
            case 'KeyW': case 'ArrowUp':    t.adelante  = valor; return true;
            case 'KeyS': case 'ArrowDown':  t.atras     = valor; return true;
            case 'KeyA': case 'ArrowLeft':  t.izquierda = valor; return true;
            case 'KeyD': case 'ArrowRight': t.derecha   = valor; return true;
            case 'ShiftLeft': case 'ShiftRight': t.correr = valor; return true;
            case 'Space': t.saltar = valor; return true;
        }
        return false;
    }

    window.addEventListener('keydown', function (e) { if (cambiar(e.code, true))  e.preventDefault(); });
    window.addEventListener('keyup',   function (e) { if (cambiar(e.code, false)) e.preventDefault(); });
    window.addEventListener('blur', function () {
        for (const k in t) t[k] = false;   // evita teclas "atascadas" al perder el foco
    });

    // Cámara: arrastrar para girar, rueda para zoom
    let arrastrando = false;
    domElement.addEventListener('pointerdown', function (e) {
        arrastrando = true;
        domElement.setPointerCapture(e.pointerId);
    });
    domElement.addEventListener('pointerup', function () { arrastrando = false; });
    domElement.addEventListener('pointermove', function (e) {
        if (!arrastrando) return;
        const cfg = self.cfg;
        self.yawCam   -= e.movementX * cfg.camSensibilidad;
        self.pitchCam += e.movementY * cfg.camSensibilidad;
        self.pitchCam = Math.max(cfg.camPitchMin, Math.min(cfg.camPitchMax, self.pitchCam));
    });
    domElement.addEventListener('wheel', function (e) {
        const cfg = self.cfg;
        self.distCam += e.deltaY * 0.005;
        self.distCam = Math.max(cfg.camDistMin, Math.min(cfg.camDistMax, self.distCam));
        e.preventDefault();
    }, { passive: false });
};


// ----------------------------------------------------------------------------
//  Altura del suelo en (x,z)
// ----------------------------------------------------------------------------
Jugador.alturaEn = function (x, z)
{
    const cfg = this.cfg;

    if (typeof cfg.funcionAltura === 'function') return cfg.funcionAltura(x, z);

    if (cfg.terreno) {
        this._origenRayo.set(x, 1000, z);
        this._rayo.set(this._origenRayo, this._abajo);
        const impactos = this._rayo.intersectObject(cfg.terreno, true);
        if (impactos.length > 0) return impactos[0].point.y;
    }
    return 0;
};


// ----------------------------------------------------------------------------
//  Cambio de animación con fundido
// ----------------------------------------------------------------------------
Jugador._reproducir = function (nombre)
{
    let nueva = this.acciones[nombre];
    // Alternativas si falta alguna animación
    if (!nueva && nombre === 'correr') nueva = this.acciones['andar'];
    if (!nueva && nombre !== 'idle')   nueva = this.acciones['idle'];
    if (!nueva || nueva === this.accionActual) return;

    const f = this.cfg.fundido;
    nueva.reset().setEffectiveWeight(1).fadeIn(f).play();
    if (this.accionActual) this.accionActual.fadeOut(f);
    this.accionActual = nueva;
};


// ----------------------------------------------------------------------------
//  Actualización por fotograma: llamar desde update() con el delta del reloj
// ----------------------------------------------------------------------------
Jugador.actualizar = function (delta)
{
    if (!this.listo) return;
    delta = Math.min(delta, 0.1);   // evita saltos enormes si la pestaña estuvo en segundo plano

    const cfg = this.cfg;
    const t = this.teclas;
    const pos = this.raiz.position;
    const xAnt = pos.x, zAnt = pos.z;   // posición antes de mover (para colisiones)

    // --- Dirección de movimiento relativa a la cámara ---
    const f = (t.adelante ? 1 : 0) - (t.atras ? 1 : 0);
    const d = (t.derecha ? 1 : 0) - (t.izquierda ? 1 : 0);
    const hayMovimiento = (f !== 0 || d !== 0);

    if (hayMovimiento) {
        // La cámara mira hacia -(sin yaw, cos yaw); la derecha es (-fz, fx)
        const fx = -Math.sin(this.yawCam), fz = -Math.cos(this.yawCam);
        let dx = fx * f + (-fz) * d;
        let dz = fz * f + fx * d;
        const len = Math.hypot(dx, dz);
        dx /= len; dz /= len;

        const vel = t.correr ? cfg.velCorrer : cfg.velAndar;
        pos.x += dx * vel * delta;
        pos.z += dz * vel * delta;

        // Girar suavemente el personaje hacia donde camina (Mixamo mira hacia +Z)
        const objetivo = Math.atan2(dx, dz);
        let dif = objetivo - this.raiz.rotation.y;
        dif = Math.atan2(Math.sin(dif), Math.cos(dif));   // camino más corto
        this.raiz.rotation.y += dif * Math.min(1, cfg.velGiro * delta);

        // Colisiones: el resolvedor puede empujar al jugador fuera de obstáculos
        if (cfg.resolverColision) cfg.resolverColision(pos, xAnt, zAnt, cfg.radioJugador);
    }

    // --- Salto ---
    if (t.saltar && this.enSuelo && !this.saltando) {
        this.saltando = true;
        this._temporizadorSalto = cfg.retrasoSalto;
        if (this.acciones['saltar']) this._reproducir('saltar');
    }
    if (this._temporizadorSalto >= 0) {
        this._temporizadorSalto -= delta;
        if (this._temporizadorSalto < 0) {
            this.vy = cfg.velSalto;
            this.enSuelo = false;
        }
    }

    // --- Gravedad y contacto con el suelo ---
    const suelo = this.alturaEn(pos.x, pos.z);

    if (this.enSuelo && this._temporizadorSalto < 0) {
        if (pos.y - suelo > cfg.umbralCaida) {
            this.enSuelo = false;          // el terreno baja de golpe: empieza a caer
        } else {
            pos.y = suelo;                 // pegado al terreno (sube/baja pendientes)
            this.vy = 0;
        }
    }
    if (!this.enSuelo) {
        this.vy -= cfg.gravedad * delta;
        pos.y += this.vy * delta;
        if (pos.y <= suelo && this.vy <= 0) {
            pos.y = suelo;
            this.vy = 0;
            this.enSuelo = true;
            this.saltando = false;
            this._temporizadorSalto = -1;
        }
    }

    // --- Animación según el estado ---
    if (this.saltando && this.acciones['saltar']) this._reproducir('saltar');
    else if (hayMovimiento)                        this._reproducir(t.correr ? 'correr' : 'andar');
    else                                           this._reproducir('idle');

    this.mixer.update(delta);

    this._actualizarCamara(delta, false);
};


// ----------------------------------------------------------------------------
//  Cámara en 3ª persona (orbita alrededor del personaje)
// ----------------------------------------------------------------------------
Jugador._actualizarCamara = function (delta, inmediato)
{
    const cfg = this.cfg;
    const p = this.raiz.position;
    const cam = this.camera;

    const objetivo = new THREE.Vector3(p.x, p.y + cfg.camAlturaObjetivo, p.z);

    const cp = Math.cos(this.pitchCam), sp = Math.sin(this.pitchCam);
    const deseada = new THREE.Vector3(
        objetivo.x + Math.sin(this.yawCam) * cp * this.distCam,
        objetivo.y + sp * this.distCam,
        objetivo.z + Math.cos(this.yawCam) * cp * this.distCam
    );

    if (inmediato) cam.position.copy(deseada);
    else cam.position.lerp(deseada, 1 - Math.exp(-cfg.camSuavizado * delta));

    // La cámara nunca se mete bajo el terreno
    const sueloCam = this.alturaEn(cam.position.x, cam.position.z) + 0.4;
    if (cam.position.y < sueloCam) cam.position.y = sueloCam;

    cam.lookAt(objetivo);
};