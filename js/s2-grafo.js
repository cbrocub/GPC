
// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;

// 1-inicializa 
init();
// 2-Crea una escena
loadScene();
// 3-renderiza
render();

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 1000 );
  camera.position.set( 40, 25, 5 );

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  window.addEventListener('resize', updateAspectRatio );
}


function loadScene()
{
    let material = new THREE.MeshNormalMaterial();          
        
    // Crear un nodo contenedor para la flecha
    let flecha = new THREE.Object3D();

    // Crear el cuerpo de la flecha (cilindro)
    let geometriaCilindro = new THREE.CylinderGeometry(1, 1, 10, 32); // Radio y altura ajustados
    let cilindro = new THREE.Mesh(geometriaCilindro, material);
    cilindro.position.y = 5; // Posicionar el cilindro sobre el origen
    flecha.add(cilindro); // Añadir el cilindro al nodo flecha

    // Crear la punta de la flecha (cono)
    let geometriaCono = new THREE.ConeGeometry(2, 4, 32); // Radio base y altura ajustados
    let cono = new THREE.Mesh(geometriaCono, material);
    cono.position.y = 10; // Posicionar el cono en la parte superior del cilindro
    flecha.add(cono); // Añadir el cono al nodo flecha

    // Añadir la flecha a la escena
    scene.add(flecha);

    // Añadir el piso a la escena
    let geometriaPiso = new THREE.PlaneGeometry(10, 10, 10, 10);
    let piso = new THREE.Mesh(geometriaPiso,material);
    piso.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 2) ;
    scene.add(piso);

}


function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update()
{
  // Cambios para actualizar la camara segun mvto del raton
  cameraControls.update();
}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}


// =============================================================
// ATREZZO DE LA ISLA: árboles, edificios, puerto, faro y ruinas
// =============================================================
// IMPORTANTE:
// Este bloque se añade AL FINAL de proyecto.js.
// No sustituye ni modifica el código anterior.
//
// No utiliza texturas.
// Todos los objetos utilizan materiales de color.
//
// =============================================================


// =============================================================
// UTILIDADES GENERALES
// =============================================================

// Generador pseudoaleatorio con semilla.
// Hace que la distribución sea diferente pero estable entre recargas.
var semillaAtrezzo = 20240;

function azar() {
  semillaAtrezzo = (semillaAtrezzo + 0x6D2B79F5) | 0;

  var t = Math.imul(
    semillaAtrezzo ^ (semillaAtrezzo >>> 15),
    1 | semillaAtrezzo
  );

  t = (t + Math.imul(
    t ^ (t >>> 7),
    61 | t
  )) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function entre(a, b) {
  return a + (b - a) * azar();
}


// =============================================================
// RUIDO 2D
// Sirve para agrupar árboles en pequeñas zonas/bosquetes.
// =============================================================

function hash2(i, j) {
  var h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function ruido2D(x, z, escala) {

  var u = x / escala;
  var v = z / escala;

  var i = Math.floor(u);
  var j = Math.floor(v);

  var fu = u - i;
  var fv = v - j;

  fu = fu * fu * (3 - 2 * fu);
  fv = fv * fv * (3 - 2 * fv);

  return (
    hash2(i, j) * (1 - fu) +
    hash2(i + 1, j) * fu
  ) * (1 - fv) +

  (
    hash2(i, j + 1) * (1 - fu) +
    hash2(i + 1, j + 1) * fu
  ) * fv;
}


// =============================================================
// ALTURA DEL TERRENO
// =============================================================

function hm_altura(x, z) {

  if (!hm_data || !hm_width || !hm_height) {
    return 0;
  }

  var fx = x / scaleFactorXZ + hm_height / 2;
  var fz = z / scaleFactorXZ + hm_width / 2;

  var ix = Math.floor(fx);
  var iz = Math.floor(fz);

  ix = Math.max(0, Math.min(hm_height - 1, ix));
  iz = Math.max(0, Math.min(hm_width - 1, iz));

  return hm_data[ix * hm_width + iz];
}


// =============================================================
// PENDIENTE DEL TERRENO
// =============================================================

function hm_pendiente(x, z) {

  var d = scaleFactorXZ;

  var dx =
    hm_altura(x + d, z) -
    hm_altura(x - d, z);

  var dz =
    hm_altura(x, z + d) -
    hm_altura(x, z - d);

  return Math.hypot(dx, dz) / (2 * d);
}


// =============================================================
// LÍMITES DE LA ISLA
// =============================================================

var isla = null;

function calcularIsla() {

  var n = 0;

  var sx = 0;
  var sz = 0;

  var xmin = 1e9;
  var xmax = -1e9;

  var zmin = 1e9;
  var zmax = -1e9;

  for (var i = 0; i < hm_height; i++) {

    for (var j = 0; j < hm_width; j++) {

      if (hm_data[i * hm_width + j] > seaLevelY + 0.5) {

        var x =
          (i - hm_height / 2) *
          scaleFactorXZ;

        var z =
          (j - hm_width / 2) *
          scaleFactorXZ;

        n++;

        sx += x;
        sz += z;

        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);

        zmin = Math.min(zmin, z);
        zmax = Math.max(zmax, z);
      }
    }
  }

  if (n === 0) return;

  isla = {
    cx: sx / n,
    cz: sz / n,

    xmin: xmin,
    xmax: xmax,

    zmin: zmin,
    zmax: zmax
  };
}


// =============================================================
// ZONAS RESERVADAS
// Evita poner árboles encima de casas, puerto, caminos...
// =============================================================

var reservas = [];

function reservar(x, z, r) {

  reservas.push({
    x: x,
    z: z,
    r: r
  });
}

function libre(x, z, r) {

  for (var k = 0; k < reservas.length; k++) {

    var q = reservas[k];

    if (
      Math.hypot(
        x - q.x,
        z - q.z
      ) < q.r + r
    ) {
      return false;
    }
  }

  return true;
}


// =============================================================
// MATERIALES SIN TEXTURAS
// =============================================================

function matColor(color, extra) {

  var o = {
    color: color
  };

  if (extra) {

    for (var k in extra) {
      o[k] = extra[k];
    }
  }

  return new THREE.MeshLambertMaterial(o);
}


// =============================================================
// UTILIDADES DE GEOMETRÍA
// =============================================================

var _m = new THREE.Matrix4();

var _q = new THREE.Quaternion();

var _e = new THREE.Euler();

var _p = new THREE.Vector3();

var _s = new THREE.Vector3();


function colocar(geo, p, r, s) {

  p = p || [0, 0, 0];

  r = r || [0, 0, 0];

  s = s || [1, 1, 1];

  _m.compose(
    _p.set(
      p[0],
      p[1],
      p[2]
    ),

    _q.setFromEuler(
      _e.set(
        r[0],
        r[1],
        r[2]
      )
    ),

    _s.set(
      s[0],
      s[1],
      s[2]
    )
  );

  geo.applyMatrix4(_m);

  return geo;
}


// =============================================================
// FUSIONAR GEOMETRÍAS
// =============================================================

function fusionar(lista) {

  var geos = lista.map(function(g) {

    return g.index
      ? g.toNonIndexed()
      : g;

  });

  var n = 0;

  geos.forEach(function(g) {

    n += g.attributes.position.count;

  });

  var pos = new Float32Array(n * 3);

  var nor = new Float32Array(n * 3);

  var uv = new Float32Array(n * 2);

  var o = 0;

  geos.forEach(function(g) {

    var c =
      g.attributes.position.count;

    pos.set(
      g.attributes.position.array,
      o * 3
    );

    nor.set(
      g.attributes.normal.array,
      o * 3
    );

    if (g.attributes.uv) {

      uv.set(
        g.attributes.uv.array,
        o * 2
      );
    }

    o += c;

  });

  var r =
    new THREE.BufferGeometry();

  r.setAttribute(
    'position',
    new THREE.BufferAttribute(
      pos,
      3
    )
  );

  r.setAttribute(
    'normal',
    new THREE.BufferAttribute(
      nor,
      3
    )
  );

  r.setAttribute(
    'uv',
    new THREE.BufferAttribute(
      uv,
      2
    )
  );

  return r;
}


function malla(partes, material, nombre) {

  var m =
    new THREE.Mesh(
      fusionar(partes),
      material
    );

  m.name =
    nombre || '';

  return m;
}


// =============================================================
// UV AUXILIARES
// =============================================================

function uvMundo(geo, tam) {

  var P =
    geo.attributes.position;

  var N =
    geo.attributes.normal;

  var UV =
    geo.attributes.uv;

  for (var i = 0; i < P.count; i++) {

    var ax =
      Math.abs(N.getX(i));

    var ay =
      Math.abs(N.getY(i));

    var az =
      Math.abs(N.getZ(i));

    var u, v;

    if (
      ay >= ax &&
      ay >= az
    ) {

      u = P.getX(i);
      v = P.getZ(i);

    } else if (ax >= az) {

      u = P.getZ(i);
      v = P.getY(i);

    } else {

      u = P.getX(i);
      v = P.getY(i);

    }

    UV.setXY(
      i,
      u / tam,
      v / tam
    );
  }

  return geo;
}


function escalarUV(geo, su, sv) {

  var UV =
    geo.attributes.uv;

  for (var i = 0; i < UV.count; i++) {

    UV.setXY(
      i,
      UV.getX(i) * su,
      UV.getY(i) * sv
    );
  }

  return geo;
}


// =============================================================
// CAJA
// =============================================================

function caja(w, h, d, p, r, tam) {

  return uvMundo(
    colocar(
      new THREE.BoxGeometry(
        w,
        h,
        d
      ),
      p,
      r
    ),
    tam || 2
  );
}


// =============================================================
// SUPERFICIE PARAMÉTRICA
// =============================================================

function superficieParametrica(f, nu, nv) {

  var pos = [];

  var uv = [];

  var idx = [];

  for (var i = 0; i <= nu; i++) {

    for (var j = 0; j <= nv; j++) {

      var u = i / nu;

      var v = j / nv;

      var p = f(u, v);

      pos.push(
        p[0],
        p[1],
        p[2]
      );

      uv.push(
        u,
        v
      );
    }
  }

  for (i = 0; i < nu; i++) {

    for (j = 0; j < nv; j++) {

      var a =
        i * (nv + 1) + j;

      var b =
        (i + 1) * (nv + 1) + j;

      var c =
        b + 1;

      var d =
        a + 1;

      idx.push(
        a,
        b,
        d,

        b,
        c,
        d
      );
    }
  }

  var g =
    new THREE.BufferGeometry();

  g.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array(pos),
      3
    )
  );

  g.setAttribute(
    'uv',
    new THREE.BufferAttribute(
      new Float32Array(uv),
      2
    )
  );

  g.setIndex(idx);

  g.computeVertexNormals();

  return g;
}


// =============================================================
// DEFORMACIÓN ORGÁNICA
// =============================================================

function deformar(geo, amp, f) {

  var P =
    geo.attributes.position;

  var v =
    new THREE.Vector3();

  for (var i = 0; i < P.count; i++) {

    v.fromBufferAttribute(
      P,
      i
    );

    var n =
      Math.sin(
        v.x * f + 1.3
      ) *
      Math.sin(
        v.y * f * 1.1 + 0.7
      )
      +
      Math.sin(
        v.z * f * 0.9 + 2.1
      ) *
      Math.sin(
        v.x * f * 1.3
      );

    v.multiplyScalar(
      1 + amp * n
    );

    P.setXYZ(
      i,
      v.x,
      v.y,
      v.z
    );
  }

  geo.computeVertexNormals();

  return geo;
}


// =============================================================
// GEOMETRÍA IRREGULAR
// =============================================================

function irregular(geo, amp, k) {

  var P =
    geo.attributes.position;

  for (var i = 0; i < P.count; i++) {

    var x = P.getX(i);

    var y = P.getY(i);

    var z = P.getZ(i);

    var s =
      1 +
      amp *
      Math.sin(
        Math.atan2(z, x) * k +
        y * 2.0
      );

    P.setXYZ(
      i,
      x * s,
      y,
      z * s
    );
  }

  geo.computeVertexNormals();

  return geo;
}


// =============================================================
// VEGETACIÓN
// =============================================================


// -------------------------------------------------------------
// PALMERA
// -------------------------------------------------------------

function geoPalmera() {

  var tronco = [];

  var altura = 9;

  var segmentos = 8;

  for (var i = 0; i < segmentos; i++) {

    var y0 =
      i * altura / segmentos;

    var y1 =
      (i + 1) * altura / segmentos;

    var x0 =
      Math.sin(
        i * 0.4
      ) * 0.5;

    var z0 =
      Math.cos(
        i * 0.35
      ) * 0.35;

    var x1 =
      Math.sin(
        (i + 1) * 0.4
      ) * 0.5;

    var z1 =
      Math.cos(
        (i + 1) * 0.35
      ) * 0.35;

    tronco.push(
      colocar(
        new THREE.CylinderGeometry(
          0.32,
          0.42,
          altura / segmentos + 0.1,
          8
        ),
        [
          (x0 + x1) / 2,
          (y0 + y1) / 2,
          (z0 + z1) / 2
        ],
        [
          0,
          0,
          0
        ]
      )
    );
  }

  var copa = [];

  for (var f = 0; f < 10; f++) {

    var a =
      f *
      Math.PI *
      2 /
      10;

    var hoja =
      new THREE.ConeGeometry(
        0.75,
        5.5,
        5
      );

    hoja =
      colocar(
        hoja,
        [
          0,
          9.7,
          0
        ],
        [
          0,
          0,
          Math.PI / 2
        ]
      );

    hoja.rotateY(a);

    hoja.translateX(2.5);

    copa.push(hoja);
  }

  return {
    tronco: fusionar(tronco),
    copa: fusionar(copa)
  };
}


// -------------------------------------------------------------
// ÁRBOL FRONDOSO
// -------------------------------------------------------------

function geoFrondoso() {

  var tronco = [];

  tronco.push(
    colocar(
      new THREE.CylinderGeometry(
        0.45,
        0.65,
        6,
        8
      ),
      [
        0,
        3,
        0
      ]
    )
  );

  var copa = [];

  copa.push(
    colocar(
      deformar(
        new THREE.IcosahedronGeometry(
          2.7,
          1
        ),
        0.15,
        1.8
      ),
      [
        0,
        6.5,
        0
      ]
    )
  );

  copa.push(
    colocar(
      deformar(
        new THREE.IcosahedronGeometry(
          2.2,
          1
        ),
        0.15,
        2.1
      ),
      [
        -1.6,
        6,
        0.5
      ]
    )
  );

  copa.push(
    colocar(
      deformar(
        new THREE.IcosahedronGeometry(
          2.1,
          1
        ),
        0.15,
        2.2
      ),
      [
        1.5,
        6.1,
        -0.3
      ]
    )
  );

  return {
    tronco: fusionar(tronco),
    copa: fusionar(copa)
  };
}


// -------------------------------------------------------------
// PINO
// -------------------------------------------------------------

function geoPino() {

  var tronco = [];

  tronco.push(
    colocar(
      new THREE.CylinderGeometry(
        0.38,
        0.55,
        5,
        8
      ),
      [
        0,
        2.5,
        0
      ]
    )
  );

  var copa = [];

  copa.push(
    colocar(
      new THREE.ConeGeometry(
        2.8,
        5,
        8
      ),
      [
        0,
        6,
        0
      ]
    )
  );

  copa.push(
    colocar(
      new THREE.ConeGeometry(
        2.3,
        4,
        8
      ),
      [
        0,
        8,
        0
      ]
    )
  );

  copa.push(
    colocar(
      new THREE.ConeGeometry(
        1.7,
        3.2,
        8
      ),
      [
        0,
        10,
        0
      ]
    )
  );

  return {
    tronco: fusionar(tronco),
    copa: fusionar(copa)
  };
}


// -------------------------------------------------------------
// ARBUSTO
// -------------------------------------------------------------

function geoArbusto() {

  return escalarUV(
    colocar(
      deformar(
        new THREE.IcosahedronGeometry(
          1,
          1
        ),
        0.2,
        2.0
      ),
      [
        0,
        0.7,
        0
      ],
      [
        0,
        0,
        0
      ],
      [
        1.5,
        0.9,
        1.5
      ]
    ),
    2,
    2
  );
}


// -------------------------------------------------------------
// ROCA
// -------------------------------------------------------------

function geoRoca() {

  return colocar(
    deformar(
      new THREE.DodecahedronGeometry(
        1.2,
        0
      ),
      0.22,
      2.2
    ),
    [
      0,
      0.5,
      0
    ],
    [
      0,
      0,
      0
    ],
    [
      1.2,
      0.8,
      1
    ]
  );
}


// =============================================================
// INSTANCING
// =============================================================

function instanciar(
  geo,
  material,
  matrices,
  nombre
) {

  var im =
    new THREE.InstancedMesh(
      geo,
      material,
      matrices.length
    );

  for (
    var i = 0;
    i < matrices.length;
    i++
  ) {

    im.setMatrixAt(
      i,
      matrices[i]
    );
  }

  im.instanceMatrix.needsUpdate = true;

  im.frustumCulled = false;

  im.name = nombre;

  scene.add(im);

  return im;
}


// =============================================================
// VEGETACIÓN
// =============================================================

function repartirVegetacion() {

  var cuota = {

    palma: 75,

    frondoso: 170,

    pino: 130,

    arbusto: 240,

    roca: 150

  };

  var radio = {

    palma: 2.4,

    frondoso: 3.8,

    pino: 3.0,

    arbusto: 1.3,

    roca: 1.6

  };

  var mats = {

    palma: [],

    frondoso: [],

    pino: [],

    arbusto: [],

    roca: []

  };

  var cuenta = {

    palma: 0,

    frondoso: 0,

    pino: 0,

    arbusto: 0,

    roca: 0

  };

  var rejilla = {};

  var celda = 10;


  function hueco(x, z, r) {

    var ci =
      Math.floor(x / celda);

    var cj =
      Math.floor(z / celda);

    for (
      var di = -1;
      di <= 1;
      di++
    ) {

      for (
        var dj = -1;
        dj <= 1;
        dj++
      ) {

        var l =
          rejilla[
            (ci + di) +
            ',' +
            (cj + dj)
          ];

        if (!l) continue;

        for (
          var q = 0;
          q < l.length;
          q++
        ) {

          if (
            Math.hypot(
              x - l[q].x,
              z - l[q].z
            ) <
            r + l[q].r
          ) {

            return false;
          }
        }
      }
    }

    return true;
  }


  function anotar(x, z, r) {

    var ci =
      Math.floor(x / celda);

    var cj =
      Math.floor(z / celda);

    var clave =
      ci + ',' + cj;

    if (!rejilla[clave]) {

      rejilla[clave] = [];
    }

    rejilla[clave].push({
      x: x,
      z: z,
      r: r
    });
  }


  var intentosMax =
    50000;

  for (
    var intento = 0;
    intento < intentosMax;
    intento++
  ) {

    if (
      cuenta.palma >= cuota.palma &&
      cuenta.frondoso >= cuota.frondoso &&
      cuenta.pino >= cuota.pino &&
      cuenta.arbusto >= cuota.arbusto &&
      cuenta.roca >= cuota.roca
    ) {

      break;
    }


    var x =
      entre(
        isla.xmin + 10,
        isla.xmax - 10
      );

    var z =
      entre(
        isla.zmin + 10,
        isla.zmax - 10
      );


    var y =
      hm_altura(x, z);


    if (
      y <=
      seaLevelY + 0.8
    ) {

      continue;
    }


    var pendiente =
      hm_pendiente(x, z);


    if (pendiente > 1.1) {

      continue;
    }


    if (
      !libre(
        x,
        z,
        2
      )
    ) {

      continue;
    }


    var ruido =
      ruido2D(
        x,
        z,
        80
      );


    var tipo;


    if (
      y < seaLevelY + 15 &&
      ruido > 0.55
    ) {

      tipo = 'palma';

    } else if (
      y > 80 &&
      ruido > 0.5
    ) {

      tipo = 'pino';

    } else if (
      ruido > 0.65
    ) {

      tipo = 'frondoso';

    } else if (
      ruido > 0.40
    ) {

      tipo = 'arbusto';

    } else {

      tipo = 'roca';
    }


    if (
      cuenta[tipo] >= cuota[tipo]
    ) {

      continue;
    }


    if (
      tipo === 'palma' &&
      pendiente > 0.45
    ) {

      continue;
    }


    if (
      tipo === 'pino' &&
      pendiente > 0.65
    ) {

      continue;
    }


    var yaw =
      azar() *
      Math.PI *
      2;

    var s;

    var sy;


    switch (tipo) {

      case 'palma':

        s =
          entre(
            0.8,
            1.2
          );

        sy =
          s *
          entre(
            0.9,
            1.15
          );

        break;


      case 'frondoso':

        s =
          entre(
            0.75,
            1.2
          );

        sy =
          s *
          entre(
            0.9,
            1.2
          );

        break;


      case 'pino':

        s =
          entre(
            0.7,
            1.1
          );

        sy =
          s *
          entre(
            0.9,
            1.2
          );

        break;


      case 'arbusto':

        s =
          entre(
            0.6,
            1.3
          );

        sy =
          s *
          entre(
            0.8,
            1.1
          );

        break;


      default:

        s =
          entre(
            0.6,
            2.6
          );

        sy =
          s *
          entre(
            0.7,
            1.1
          );

        break;
    }


    var tilt =
      tipo === 'roca'
        ? entre(-0.4, 0.4)
        : entre(-0.04, 0.04);


    var E =
      new THREE.Euler(
        tilt,
        yaw,
        tipo === 'roca'
          ? entre(-0.4, 0.4)
          : entre(-0.04, 0.04)
      );


    var M =
      new THREE.Matrix4();


    M.compose(

      new THREE.Vector3(
        x,
        y -
        (
          tipo === 'roca'
            ? 0.25 * s
            : 0.3
        ),
        z
      ),

      new THREE.Quaternion()
        .setFromEuler(E),

      new THREE.Vector3(
        s,
        sy,
        s
      )
    );


    mats[tipo].push(
      M.clone()
    );


    cuenta[tipo]++;

    anotar(
      x,
      z,
      radio[tipo]
    );
  }


  var pal =
    geoPalmera();

  var fro =
    geoFrondoso();

  var pin =
    geoPino();


  instanciar(
    pal.tronco,
    matColor(0x7a5534),
    mats.palma,
    'palmeras_tronco'
  );

  instanciar(
    pal.copa,
    matColor(0x3f7f32),
    mats.palma,
    'palmeras_copa'
  );


  instanciar(
    fro.tronco,
    matColor(0x65452f),
    mats.frondoso,
    'arboles_tronco'
  );

  instanciar(
    fro.copa,
    matColor(0x3f7d35),
    mats.frondoso,
    'arboles_copa'
  );


  instanciar(
    pin.tronco,
    matColor(0x5a3e2b),
    mats.pino,
    'pinos_tronco'
  );

  instanciar(
    pin.copa,
    matColor(0x285c34),
    mats.pino,
    'pinos_copa'
  );


  instanciar(
    geoArbusto(),
    matColor(0x5c8a3c),
    mats.arbusto,
    'arbustos'
  );


  instanciar(
    geoRoca(),
    matColor(0x777777),
    mats.roca,
    'rocas'
  );


  console.log(
    'Vegetación:',
    JSON.stringify(cuenta)
  );
}


// =============================================================
// EDIFICIOS
// =============================================================


// -------------------------------------------------------------
// CASA
// -------------------------------------------------------------

function crearCasa(o, prof) {

  var g =
    new THREE.Group();

  var w = o.w;

  var d = o.d;

  var h = o.h;

  var rh = o.rh;


  g.name =
    'casa';


  // Muros

  g.add(
    malla(
      [
        caja(
          w,
          h,
          d,
          [
            0,
            h / 2,
            0
          ],
          null,
          2.6
        )
      ],

      matColor(
        o.tinte ||
        0xd8c7a8
      ),

      'muros'
    )
  );


  // Zócalo

  g.add(
    malla(
      [
        caja(
          w + 0.3,
          prof + 0.9,
          d + 0.3,
          [
            0,
            (0.9 - prof) / 2,
            0
          ],
          null,
          2.2
        )
      ],

      matColor(
        0x77726a
      ),

      'zocalo'
    )
  );


  // Tejado a dos aguas

  var tejado =
    geoTejado(
      w,
      d,
      h,
      rh,
      0.55,
      o.tamTejado || 4
    );


  g.add(
    new THREE.Mesh(
      tejado.losas,
      matColor(
        o.colorTejado ||
        0x9b4935,
        {
          side:
            THREE.DoubleSide
        }
      )
    )
  );


  g.add(
    new THREE.Mesh(
      tejado.hastiales,
      matColor(
        o.tinte ||
        0xd8c7a8
      )
    )
  );


  // Puerta

  g.add(
    malla(
      [
        caja(
          1.3,
          2.3,
          0.14,
          [
            -w * 0.18,
            1.15,
            d / 2 + 0.05
          ],
          null,
          1.6
        )
      ],

      matColor(
        0x6b4a32
      ),

      'puerta'
    )
  );


  // Ventanas

  var ventanas = [];


  [
    -w * 0.18,
    w * 0.28
  ].forEach(function(x) {

    ventanas.push(
      caja(
        1.0,
        0.9,
        0.12,
        [
          x,
          2.8,
          d / 2 + 0.07
        ],
        null,
        1.5
      )
    );

  });


  g.add(
    malla(
      ventanas,

      matColor(
        0x6d9bc4
      ),

      'ventanas'
    )
  );


  // Chimenea

  g.add(
    malla(
      [
        caja(
          0.65,
          1.6,
          0.65,
          [
            w * 0.22,
            h + 0.8,
            0
          ],
          null,
          1
        )
      ],

      matColor(
        0x6d5140
      ),

      'chimenea'
    )
  );


  return g;
}


// =============================================================
// TEJADO
// =============================================================

function geoTejado(
  w,
  d,
  h,
  rh,
  margen,
  tam
) {

  var vertices = [

    -w / 2 - margen,
    h,
    -d / 2 - margen,

    w / 2 + margen,
    h,
    -d / 2 - margen,

    0,
    h + rh,
    -d / 2 - margen,

    -w / 2 - margen,
    h,
    d / 2 + margen,

    w / 2 + margen,
    h,
    d / 2 + margen,

    0,
    h + rh,
    d / 2 + margen

  ];


  var posiciones =
    new Float32Array(
      vertices
    );


  var indices = [

    0, 1, 2,

    3, 5, 4

  ];


  var g =
    new THREE.BufferGeometry();


  g.setAttribute(
    'position',
    new THREE.BufferAttribute(
      posiciones,
      3
    )
  );


  g.setIndex(indices);

  g.computeVertexNormals();


  var hastiales =
    new THREE.BufferGeometry();


  hastiales.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        -w / 2,
        h,
        -d / 2,

        w / 2,
        h,
        -d / 2,

        0,
        h + rh,
        -d / 2,

        -w / 2,
        h,
        d / 2,

        w / 2,
        h,
        d / 2,

        0,
        h + rh,
        d / 2
      ]),
      3
    )
  );


  hastiales.setIndex([
    0, 1, 2,
    3, 5, 4
  ]);

  hastiales.computeVertexNormals();


  return {
    losas: g,
    hastiales: hastiales
  };
}


// =============================================================
// CABAÑA
// =============================================================

function crearCabana(o, prof) {

  var g =
    new THREE.Group();

  var w = o.w;

  var d = o.d;

  var h = o.h;


  g.name =
    'cabana';


  // Cuerpo

  g.add(
    malla(
      [
        caja(
          w,
          h,
          d,
          [
            0,
            h / 2,
            0
          ],
          null,
          2
        )
      ],

      matColor(
        0x9a734e
      ),

      'paredes'
    )
  );


  // Tejado

  var t =
    geoTejado(
      w,
      d,
      h,
      o.rh || 2,
      0.35,
      3
    );


  g.add(
    new THREE.Mesh(
      t.losas,
      matColor(
        0x5c4637,
        {
          side:
            THREE.DoubleSide
        }
      )
    )
  );


  g.add(
    new THREE.Mesh(
      t.hastiales,
      matColor(
        0x9a734e
      )
    )
  );


  // Puerta

  g.add(
    malla(
      [
        caja(
          1.1,
          2,
          0.12,
          [
            0,
            1,
            d / 2 + 0.07
          ],
          null,
          1.5
        )
      ],

      matColor(
        0x513723
      ),

      'puerta'
    )
  );


  return g;
}


// =============================================================
// FARO
// =============================================================

function crearFaro(o, prof) {

  var g =
    new THREE.Group();

  g.name =
    'faro';


  var altura =
    18;


  // Torre

  g.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        2.8,
        3.5,
        altura,
        16
      ),

      matColor(
        0xe0ded5
      )
    )
  );


  // Franjas

  for (
    var i = 0;
    i < 3;
    i++
  ) {

    var franja =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          2.9,
          3.6,
          1.2,
          16
        ),

        matColor(
          0xb53b32
        )
      );

    franja.position.y =
      3 + i * 6;

    g.add(franja);
  }


  // Plataforma

  var plataforma =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        4.2,
        4.2,
        0.5,
        16
      ),

      matColor(
        0x555555
      )
    );

  plataforma.position.y =
    altura / 2 + 0.5;

  g.add(
    plataforma
  );


  // Barandilla

  var postes = [];


  for (
    var i = 0;
    i < 12;
    i++
  ) {

    var a =
      i *
      Math.PI *
      2 /
      12;

    postes.push(
      colocar(
        new THREE.CylinderGeometry(
          0.08,
          0.08,
          1.2,
          6
        ),

        [
          Math.cos(a) * 3.7,
          altura / 2 + 1,
          Math.sin(a) * 3.7
        ]
      )
    );
  }


  g.add(
    malla(
      postes,

      matColor(
        0x303030
      ),

      'barandilla'
    )
  );


  // Sala superior

  var sala =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        2.7,
        2.7,
        2.8,
        16
      ),

      matColor(
        0x9bb7c4,
        {
          transparent: true,
          opacity: 0.8
        }
      )
    );

  sala.position.y =
    altura / 2 + 2;

  g.add(
    sala
  );


  // Techo

  var techo =
    new THREE.Mesh(
      new THREE.ConeGeometry(
        3.5,
        2.4,
        8
      ),

      matColor(
        0x444444
      )
    );

  techo.position.y =
    altura / 2 + 4.5;

  g.add(
    techo
  );


  // Luz del faro

  var luz =
    new THREE.PointLight(
      0xffffcc,
      4,
      120
    );

  luz.position.set(
    0,
    altura / 2 + 2,
    0
  );

  g.add(
    luz
  );


  return g;
}


// =============================================================
// RUINAS
// =============================================================

function crearRuinas(o, prof) {

  var g =
    new THREE.Group();

  g.name =
    'ruinas';


  var piedra =
    matColor(
      0x77756e
    );


  var altura =
    5;


  // Muros rotos

  for (
    var i = 0;
    i < 5;
    i++
  ) {

    var muro =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          entre(2, 5),
          entre(2, altura),
          0.7
        ),
        piedra
      );


    muro.position.set(
      entre(-6, 6),
      muro.geometry.parameters.height / 2,
      entre(-5, 5)
    );


    muro.rotation.y =
      azar() *
      Math.PI;


    g.add(
      muro
    );
  }


  // Columnas

  for (
    var j = 0;
    j < 4;
    j++
  ) {

    var col =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.45,
          0.6,
          entre(3, 6),
          8
        ),
        piedra
      );


    col.position.set(
      entre(-5, 5),
      col.geometry.parameters.height / 2,
      entre(-5, 5)
    );


    g.add(
      col
    );
  }


  return g;
}


// =============================================================
// BOTE
// =============================================================

function crearBote() {

  var g =
    new THREE.Group();

  g.name =
    'bote';


  // Casco

  var casco =
    superficieParametrica(
      function(u, v) {

        var x =
          (u - 0.5) * 8;

        var ancho =
          Math.sin(
            Math.PI * u
          ) * 1.8;

        var z =
          (v - 0.5) *
          ancho;

        var y =
          0.4 -
          (1 - v) *
          1.2;

        return [
          x,
          y,
          z
        ];
      },

      16,
      8
    );


  g.add(
    new THREE.Mesh(
      casco,
      matColor(
        0x704a32,
        {
          side:
            THREE.DoubleSide
        }
      )
    )
  );


  // Mástil

  g.add(
    colocar(
      new THREE.CylinderGeometry(
        0.12,
        0.16,
        5,
        8
      ),
      [
        0,
        2.5,
        0
      ]
    )
  );


  // Vela

  var vela =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        3,
        4
      ),

      matColor(
        0xf1e5c8,
        {
          side:
            THREE.DoubleSide
        }
      )
    );


  vela.position.set(
    0,
    3,
    0
  );


  g.add(
    vela
  );


  return g;
}


// =============================================================
// PUERTO
// =============================================================

function crearPuerto(p) {

  var g =
    new THREE.Group();

  g.name =
    'puerto';


  var L =
    p.longitud ||
    55;

  var ancho =
    p.ancho ||
    8;

  var deckY =
    p.y ||
    0;


  // Plataforma

  g.add(
    malla(
      [
        caja(
          L,
          0.5,
          ancho,
          [
            L / 2,
            deckY,
            0
          ],
          null,
          3
        )
      ],

      matColor(
        0x8b6a48
      ),

      'muelle'
    )
  );


  // Pilotes

  var pil =
    [];


  for (
    var x = 3;
    x <= L;
    x += 4
  ) {

    [-1, 1].forEach(
      function(lado) {

        pil.push(
          colocar(
            new THREE.CylinderGeometry(
              0.35,
              0.45,
              4,
              8
            ),

            [
              x,
              deckY - 2,
              lado *
              (ancho / 2 - 0.3)
            ]
          )
        );

      }
    );
  }


  g.add(
    malla(
      pil,

      matColor(
        0x65462f
      ),

      'pilotes'
    )
  );


  // Barandilla

  var bar =
    [];


  for (
    var x = 4;
    x <= L - 0.5;
    x += 4
  ) {

    [-1, 1].forEach(
      function(lado) {

        bar.push(
          caja(
            0.13,
            1.0,
            0.13,
            [
              x,
              deckY + 0.5,
              lado *
              (ancho / 2 - 0.12)
            ],
            null,
            1.2
          )
        );


        if (
          x + 4 <=
          L - 0.5
        ) {

          bar.push(
            caja(
              4,
              0.08,
              0.1,
              [
                x + 2,
                deckY + 0.95,
                lado *
                (ancho / 2 - 0.12)
              ],
              null,
              1.2
            )
          );


          bar.push(
            caja(
              4,
              0.07,
              0.08,
              [
                x + 2,
                deckY + 0.5,
                lado *
                (ancho / 2 - 0.12)
              ],
              null,
              1.2
            )
          );
        }

      }
    );
  }


  g.add(
    malla(
      bar,

      matColor(
        0xc4a27c
      ),

      'barandilla'
    )
  );


  // Bolardos

  var bol =
    [];


  for (
    var x = 12;
    x < L;
    x += 8
  ) {

    [-1, 1].forEach(
      function(lado) {

        var z =
          lado *
          (ancho / 2 - 0.1);


        bol.push(
          colocar(
            new THREE.CylinderGeometry(
              0.13,
              0.18,
              0.55,
              10
            ),
            [
              x,
              deckY + 0.27,
              z
            ]
          )
        );


        bol.push(
          colocar(
            new THREE.SphereGeometry(
              0.17,
              8,
              6
            ),
            [
              x,
              deckY + 0.58,
              z
            ]
          )
        );

      }
    );
  }


  g.add(
    malla(
      bol,

      matColor(
        0x2c2c32
      ),

      'bolardos'
    )
  );


  // Farolas

  var postes = [];


  [10, L - 1].forEach(
    function(x) {

      var z =
        -(ancho / 2 - 0.2);


      postes.push(
        colocar(
          new THREE.CylinderGeometry(
            0.07,
            0.1,
            3.2,
            8
          ),
          [
            x,
            deckY + 1.6,
            z
          ]
        )
      );


      postes.push(
        caja(
          0.7,
          0.07,
          0.07,
          [
            x + 0.3,
            deckY + 3.15,
            z
          ],
          null,
          1
        )
      );

    }
  );


  g.add(
    malla(
      postes,

      matColor(
        0x3a2c22
      ),

      'farolas'
    )
  );


  return g;
}


// =============================================================
// COBERTIZO
// =============================================================

function crearCobertizo(pu) {

  var g =
    new THREE.Group();

  g.name =
    'cobertizo';


  g.add(
    malla(
      [
        caja(
          5,
          3,
          4,
          [
            0,
            1.5,
            0
          ],
          null,
          2
        )
      ],

      matColor(
        0x765336
      ),

      'estructura'
    )
  );


  var t =
    geoTejado(
      5,
      4,
      3,
      1.5,
      0.3,
      3
    );


  g.add(
    new THREE.Mesh(
      t.losas,
      matColor(
        0x4c3c30,
        {
          side:
            THREE.DoubleSide
        }
      )
    )
  );


  return g;
}


// =============================================================
// CAMINOS
// =============================================================

function crearCamino(
  ax,
  az,
  bx,
  bz,
  matrices
) {

  var dx =
    bx - ax;

  var dz =
    bz - az;

  var dist =
    Math.hypot(
      dx,
      dz
    );


  var pasos =
    Math.floor(
      dist / 2.5
    );


  for (
    var i = 0;
    i <= pasos;
    i++
  ) {

    var t =
      i / pasos;


    var x =
      ax + dx * t;

    var z =
      az + dz * t;


    var y =
      hm_altura(
        x,
        z
      );


    if (
      y <=
      seaLevelY
    ) {

      continue;
    }


    var M =
      new THREE.Matrix4();


    M.compose(

      new THREE.Vector3(
        x,
        y + 0.08,
        z
      ),

      new THREE.Quaternion()
        .setFromEuler(
          new THREE.Euler(
            0,
            Math.atan2(
              dz,
              dx
            ),
            0
          )
        ),

      new THREE.Vector3(
        1,
        1,
        1
      )
    );


    matrices.push(
      M
    );
  }
}


// =============================================================
// COLOCACIÓN DE OBJETOS
// =============================================================

function ubicar(
  creador,
  opciones,
  x,
  z,
  radio,
  rotacion
) {

  var y =
    hm_altura(
      x,
      z
    );


  if (
    y <=
    seaLevelY + 0.5
  ) {

    return null;
  }


  var pendiente =
    hm_pendiente(
      x,
      z
    );


  if (
    pendiente > 0.8
  ) {

    return null;
  }


  if (
    !libre(
      x,
      z,
      radio
    )
  ) {

    return null;
  }


  var objeto =
    creador(
      opciones || {},
      1
    );


  objeto.position.set(
    x,
    y,
    z
  );


  objeto.rotation.y =
    rotacion || 0;


  scene.add(
    objeto
  );


  reservar(
    x,
    z,
    radio
  );


  return objeto;
}


// =============================================================
// PARCELA FLEXIBLE
// Busca una zona relativamente llana.
// =============================================================

function parcelaFlexible(
  cx,
  cz,
  rMin,
  rMax,
  radio,
  maxPendiente,
  maxAltura,
  direccion
) {

  for (
    var intento = 0;
    intento < 5000;
    intento++
  ) {

    var a =
      azar() *
      Math.PI *
      2;


    var r =
      entre(
        rMin,
        rMax
      );


    var x =
      cx +
      Math.cos(a) *
      r;

    var z =
      cz +
      Math.sin(a) *
      r;


    var y =
      hm_altura(
        x,
        z
      );


    if (
      y <=
      seaLevelY + 1
    ) {

      continue;
    }


    var pendiente =
      hm_pendiente(
        x,
        z
      );


    if (
      pendiente >
      maxPendiente
    ) {

      continue;
    }


    if (
      maxAltura &&
      y >
      maxAltura
    ) {

      continue;
    }


    if (
      !libre(
        x,
        z,
        radio
      )
    ) {

      continue;
    }


    return {
      x: x,
      z: z,
      y: y
    };
  }


  return null;
}


// =============================================================
// CÁLCULO DE RELIEVE
// =============================================================

function relieve(
  x,
  z,
  r
) {

  var min = 1e9;

  var max = -1e9;


  for (
    var i = 0;
    i < 8;
    i++
  ) {

    var a =
      i *
      Math.PI *
      2 /
      8;


    var xx =
      x +
      Math.cos(a) *
      r;

    var zz =
      z +
      Math.sin(a) *
      r;


    var h =
      hm_altura(
        xx,
        zz
      );


    min =
      Math.min(
        min,
        h
      );

    max =
      Math.max(
        max,
        h
      );
  }


  return {
    min: min,
    max: max,
    rel: max - min
  };
}


// =============================================================
// ORIENTACIÓN HACIA EL MAR
// =============================================================

function haciaElMar(
  x,
  z
) {

  var dx =
    x - isla.cx;

  var dz =
    z - isla.cz;


  var l =
    Math.hypot(
      dx,
      dz
    );


  if (l === 0) {

    return {
      x: 0,
      z: 1
    };
  }


  return {
    x: dx / l,
    z: dz / l
  };
}


function yawHacia(
  v
) {

  return Math.atan2(
    v.x,
    v.z
  );
}


// =============================================================
// ATREZZO COMPLETO
// =============================================================

function crearAtrezzo() {

  if (
    !hm_data ||
    !hm_width ||
    !hm_height
  ) {

    console.warn(
      'El heightmap todavía no está preparado.'
    );

    return;
  }


  calcularIsla();


  if (!isla) {

    console.warn(
      'No se pudo calcular la isla.'
    );

    return;
  }


  // -----------------------------------------------------------
  // 1. PUERTO
  // -----------------------------------------------------------

  var mejorPuerto =
    null;


  var mejorScore =
    -1e9;


  for (
    var aDeg = 0;
    aDeg < 360;
    aDeg += 5
  ) {

    var a =
      aDeg *
      Math.PI /
      180;


    var dx =
      Math.cos(a);

    var dz =
      Math.sin(a);


    var rC =
      -1;


    for (
      var r = 800;
      r > 0;
      r--
    ) {

      var xx =
        isla.cx +
        dx * r;

      var zz =
        isla.cz +
        dz * r;


      if (
        hm_altura(
          xx,
          zz
        ) >
        seaLevelY + 0.4
      ) {

        rC = r;

        break;
      }
    }


    if (
      rC < 0
    ) {

      continue;
    }


    var px =
      isla.cx +
      dx *
      (rC - 25);

    var pz =
      isla.cz +
      dz *
      (rC - 25);


    var inf =
      relieve(
        px,
        pz,
        12
      );


    var score =
      (
        inf.max -
        seaLevelY
      )
      -
      inf.rel * 10;


    if (
      score >
      mejorScore
    ) {

      mejorScore =
        score;


      mejorPuerto = {

        x: px,

        z: pz,

        dx: dx,

        dz: dz
      };
    }
  }


  var puerto =
    null;


  if (
    mejorPuerto
  ) {

    var py =
      hm_altura(
        mejorPuerto.x,
        mejorPuerto.z
      );


    puerto = {

      x:
        mejorPuerto.x,

      z:
        mejorPuerto.z,

      dx:
        mejorPuerto.dx,

      dz:
        mejorPuerto.dz,

      longitud:
        55,

      ancho:
        8,

      y:
        py + 0.5,

      aMundo:
        function(
          lx,
          lz
        ) {

          return [

            this.x +
            lx * this.dz +
            lz * this.dx,

            this.z +
            lx * this.dz +
            lz * this.dx
          ];
        }
    };


    var pg =
      crearPuerto(
        puerto
      );


    pg.position.set(
      puerto.x,
      puerto.y,
      puerto.z
    );


    pg.rotation.y =
      Math.atan2(
        puerto.dz,
        puerto.dx
      );


    scene.add(
      pg
    );


    reservar(
      puerto.x,
      puerto.z,
      35
    );


    // Bote

    var bote =
      crearBote();


    bote.position.set(
      puerto.x +
      puerto.dx * 20,
      puerto.y - 1.2,
      puerto.z +
      puerto.dz * 20
    );


    bote.rotation.y =
      Math.atan2(
        puerto.dz,
        puerto.dx
      );


    scene.add(
      bote
    );
  }


  // -----------------------------------------------------------
  // 2. CASAS
  // -----------------------------------------------------------

  var casas =
    0;

  var puertas =
    [];


  for (
    var c = 0;
    c < 8;
    c++
  ) {

    var ang =
      azar() *
      Math.PI *
      2;


    var dist =
      entre(
        130,
        280
      );


    var cx =
      isla.cx +
      Math.cos(ang) *
      dist;

    var cz =
      isla.cz +
      Math.sin(ang) *
      dist;


    var p =
      parcelaFlexible(
        cx,
        cz,
        0,
        50,
        12,
        0.35,
        100
      );


    if (
      !p
    ) {

      continue;
    }


    var o = {

      w:
        entre(
          7,
          11
        ),

      d:
        entre(
          6,
          9
        ),

      h:
        entre(
          4,
          6
        ),

      rh:
        entre(
          2.5,
          4
        ),

      tinte:
        azar() > 0.5
          ? 0xd7c6a5
          : 0xcbbd9f,

      colorTejado:
        azar() > 0.5
          ? 0x9b4935
          : 0x7d5540
    };


    var casa =
      ubicar(
        crearCasa,
        o,
        p.x,
        p.z,
        12,
        azar() *
        Math.PI *
        2
      );


    if (
      casa
    ) {

      casas++;


      puertas.push([
        p.x,
        p.z
      ]);
    }
  }


  // -----------------------------------------------------------
  // 3. CABAÑAS
  // -----------------------------------------------------------

  for (
    var cb = 0;
    cb < 5;
    cb++
  ) {

    var ca =
      azar() *
      Math.PI *
      2;


    var cd =
      entre(
        180,
        330
      );


    var ccx =
      isla.cx +
      Math.cos(ca) *
      cd;

    var ccz =
      isla.cz +
      Math.sin(ca) *
      cd;


    var cp =
      parcelaFlexible(
        ccx,
        ccz,
        0,
        40,
        9,
        0.45,
        120
      );


    if (
      !cp
    ) {

      continue;
    }


    ubicar(
      crearCabana,

      {
        w:
          entre(
            5,
            7
          ),

        d:
          entre(
            4,
            6
          ),

        h:
          entre(
            3,
            4
          ),

        rh:
          entre(
            1.5,
            2.5
          )
      },

      cp.x,
      cp.z,

      9,

      azar() *
      Math.PI *
      2
    );
  }


  // -----------------------------------------------------------
  // 4. FARO
  // -----------------------------------------------------------

  var mejorF =
    null;


  for (
    var gr = 0;
    gr < 360;
    gr += 5
  ) {

    var fa =
      gr *
      Math.PI /
      180;


    var fdx =
      Math.cos(fa);

    var fdz =
      Math.sin(fa);


    if (
      mejorPuerto &&
      fdx *
      mejorPuerto.dx +
      fdz *
      mejorPuerto.dz >
      0.3
    ) {

      continue;
    }


    var rF =
      -1;


    for (
      var fr = 800;
      fr > 0;
      fr--
    ) {

      var fx =
        isla.cx +
        fdx * fr;

      var fz =
        isla.cz +
        fdz * fr;


      if (
        hm_altura(
          fx,
          fz
        ) >
        seaLevelY + 0.4
      ) {

        rF = fr;

        break;
      }
    }


    if (
      rF < 0
    ) {

      continue;
    }


    var fx =
      isla.cx +
      fdx *
      (rF - 16);

    var fz =
      isla.cz +
      fdz *
      (rF - 16);


    var infF =
      relieve(
        fx,
        fz,
        6
      );


    var alt =
      infF.max -
      seaLevelY;


    if (
      infF.min <
      seaLevelY + 3
    ) {

      continue;
    }


    if (
      alt > 70
    ) {

      continue;
    }


    if (
      Math.hypot(
        fx -
        peakWorldX,
        fz -
        peakWorldZ
      ) < 180
    ) {

      continue;
    }


    var sc =
      alt -
      infF.rel * 6;


    if (
      mejorF === null ||
      sc > mejorF.sc
    ) {

      mejorF = {

        sc: sc,

        x: fx,

        z: fz,

        dx: fdx,

        dz: fdz
      };
    }
  }


  if (
    mejorF
  ) {

    var faro =
      ubicar(
        crearFaro,
        null,
        mejorF.x,
        mejorF.z,
        8,
        0
      );


    reservar(
      mejorF.x,
      mejorF.z,
      15
    );
  }


  // -----------------------------------------------------------
  // 5. RUINAS
  // -----------------------------------------------------------

  var pr =
    parcelaFlexible(
      peakWorldX,
      peakWorldZ,
      150,
      330,
      11,
      0.6,
      90
    );


  if (
    pr
  ) {

    ubicar(
      crearRuinas,
      null,
      pr.x,
      pr.z,
      11,
      azar() *
      6.28
    );
  }


  // -----------------------------------------------------------
  // 6. COBERTIZO CERCA DEL PUERTO
  // -----------------------------------------------------------

  if (
    puerto
  ) {

    var pc =
      parcelaFlexible(
        puerto.x +
        puerto.dx * 45,

        puerto.z +
        puerto.dz * 45,

        0,
        20,

        8,

        0.4,

        100
      );


    if (
      pc
    ) {

      ubicar(
        crearCobertizo,
        null,
        pc.x,
        pc.z,
        8,
        Math.atan2(
          puerto.dz,
          puerto.dx
        )
      );
    }
  }


  // -----------------------------------------------------------
  // 7. CAMINOS
  // -----------------------------------------------------------

  var losas =
    [];


  if (
    puerto
  ) {

    puertas.forEach(
      function(d) {

        crearCamino(
          puerto.x,
          puerto.z,
          d[0],
          d[1],
          losas
        );
      }
    );
  }


  if (
    losas.length
  ) {

    instanciar(
      escalarUV(
        colocar(
          new THREE.CylinderGeometry(
            0.55,
            0.6,
            0.16,
            7
          ),
          [
            0,
            0.08,
            0
          ]
        ),
        1,
        1
      ),

      matColor(
        0x77736b
      ),

      losas,

      'camino'
    );
  }


  // -----------------------------------------------------------
  // 8. VEGETACIÓN
  // -----------------------------------------------------------

  repartirVegetacion();


  console.log(
    'Atrezzo generado: ' +
    casas +
    ' casas.'
  );
}


// =============================================================
// ESPERAR A QUE CARGUE EL HEIGHTMAP
// =============================================================
//
// Tu proyecto carga el heightmap de forma asíncrona.
// Por eso no podemos ejecutar crearAtrezzo() inmediatamente.
// Esperamos hasta que hm_data esté disponible.
// =============================================================

var atrezzoComprobado =
  false;


function esperarYCrearAtrezzo() {

  if (
    atrezzoComprobado
  ) {

    return;
  }


  if (
    hm_data &&
    hm_width &&
    hm_height
  ) {

    atrezzoComprobado =
      true;

    crearAtrezzo();

    return;
  }


  setTimeout(
    esperarYCrearAtrezzo,
    500
  );
}


// =============================================================
// INICIAR ATREZZO
// =============================================================

esperarYCrearAtrezzo();