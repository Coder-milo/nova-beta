'use client'

/**
 * El zorro asistente en 3D de verdad, portado del generador de Blender.
 *
 * <p>`Fox_Assistant_Blender_Generator.py` arma el personaje con primitivas
 * —esferas, conos truncados, cilindros y cubos— colgadas de una jerarquía de
 * huesos. Eso se traduce a Three.js sin pasar por un `.blend` ni por un GLB: no
 * hay malla esculpida que exportar, sólo geometría paramétrica y una jerarquía
 * de transformaciones. Aquí está la misma construcción, con las mismas
 * coordenadas y los mismos materiales.
 *
 * <p><b>Ejes.</b> Blender es Z-arriba y Three.js es Y-arriba, así que cada
 * posición del script pasa por `(x, y, z) → (x, z, −y)`. Las coordenadas de
 * abajo ya están convertidas; el comentario de cada bloque cita el original.
 *
 * <p><b>Huesos.</b> El script usa `parent_type='BONE'`, que es emparentado
 * rígido y no deformación por pesos: cada pieza cuelga entera de un hueso. Eso
 * se corresponde uno a uno con un árbol de `Group`, sin necesidad de `Skeleton`
 * ni de `SkinnedMesh`.
 *
 * <p>Three.js entra por `import()` dinámico para que no pese en la carga
 * inicial: el asistente es un adorno de una esquina y no puede retrasar la
 * pantalla. Si el navegador no da WebGL o el trozo no llega, se avisa con
 * `onFallo` y quien nos usa pinta el zorro en SVG.
 */

import { useEffect, useRef } from 'react'
import type * as THREE_NS from 'three'

interface Props {
  abierto: boolean
  arrastrando: boolean
  /** Se llama si no hay WebGL o si Three.js no se pudo cargar. */
  onFallo: () => void
  className?: string
}

/** Lo que ocupa el lienzo. El personaje mide unas 4,4 unidades de alto. */
const ANCHO = 72
const ALTO = 78

/**
 * Cuánto se cierran los brazos contra el cuerpo en reposo.
 *
 * El hueso del brazo del script apunta hacia fuera y abajo, unos 36°, que
 * pintado sale en cruz. Girándolo sobre el eje de profundidad los brazos
 * cuelgan al costado, que es la pose de la lámina.
 */
const BRAZO_REPOSO = 0.62

// ── Materiales del script, de lineal a sRGB ─────────────────────────────────
// Blender guarda `diffuse_color` en lineal; el hexadecimal que espera Three es
// sRGB. Convertidos con la fórmula estándar para que el color sea el mismo y no
// uno lavado.
const COLORES = {
  naranja: 0xf98635,      // Fox Orange     (0.95, 0.24, 0.035)
  naranjaOscuro: 0xad4224, // Ear Dark      (0.42, 0.055, 0.018)
  crema: 0xfde6c4,        // Cream Fur      (0.98, 0.78, 0.55)
  blanco: 0xfafafa,       // White          (0.98, 0.98, 0.98)
  negro: 0x1a120c,        // Black          (0.012, 0.008, 0.006)
  marron: 0x76422c,       // Paw Brown      (0.18, 0.055, 0.025)
  azul: 0x3c6fbf,         // Hoodie Blue    (0.045, 0.16, 0.52)
  azulOscuro: 0x2c5090,   // Hoodie Dark    (0.025, 0.08, 0.28)
  zapatilla: 0xf3f5f9,    // Sneaker White  (0.9, 0.92, 0.96)
  zapatillaAzul: 0x3876c8, // Sneaker Blue  (0.04, 0.18, 0.58)
  // El script viste las piernas con Hoodie Dark. La lámina de referencia lleva
  // pantalón cargo gris carbón, que es lo que se ve a este tamaño; el azul muy
  // oscuro se confundía con la sudadera y el personaje salía de una sola pieza.
  pantalon: 0x2b333d,
}

/** Un hueso: su origen en coordenadas de mundo y de quién cuelga. */
const HUESOS: Record<string, { padre: string | null; origen: [number, number, number] }> = {
  Root: { padre: null, origen: [0, 0, 0] },
  Spine: { padre: 'Root', origen: [0, 0.5, 0] },
  Chest: { padre: 'Spine', origen: [0, 2.35, 0] },
  Neck: { padre: 'Chest', origen: [0, 3.15, 0] },
  Head: { padre: 'Neck', origen: [0, 3.55, 0] },
  'UpperArm.L': { padre: 'Chest', origen: [0.38, 2.95, 0] },
  'Forearm.L': { padre: 'UpperArm.L', origen: [0.92, 2.55, 0] },
  'Hand.L': { padre: 'Forearm.L', origen: [1.18, 2.1, 0] },
  'UpperArm.R': { padre: 'Chest', origen: [-0.38, 2.95, 0] },
  'Forearm.R': { padre: 'UpperArm.R', origen: [-0.92, 2.55, 0] },
  'Hand.R': { padre: 'Forearm.R', origen: [-1.18, 2.1, 0] },
  'Thigh.L': { padre: 'Spine', origen: [0.27, 1.0, 0] },
  'Shin.L': { padre: 'Thigh.L', origen: [0.32, 0.42, 0] },
  'Foot.L': { padre: 'Shin.L', origen: [0.32, 0.1, 0] },
  'Thigh.R': { padre: 'Spine', origen: [-0.27, 1.0, 0] },
  'Shin.R': { padre: 'Thigh.R', origen: [-0.32, 0.42, 0] },
  'Foot.R': { padre: 'Shin.R', origen: [-0.32, 0.1, 0] },
  Tail: { padre: 'Spine', origen: [0, 1.55, -0.18] },
  'Tail.01': { padre: 'Tail', origen: [0.55, 1.75, -0.3] },
  'Tail.02': { padre: 'Tail.01', origen: [1.0, 1.85, -0.42] },
}

export function ZorroThreeCanvas({ abierto, arrastrando, onFallo, className }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)

  // El bucle lee el estado por referencia: volver a montar la escena en cada
  // clic significaría recompilar los materiales y perder la pose.
  const estadoRef = useRef({ abierto, arrastrando })
  useEffect(() => {
    estadoRef.current = { abierto, arrastrando }
  }, [abierto, arrastrando])

  const onFalloRef = useRef(onFallo)
  useEffect(() => {
    onFalloRef.current = onFallo
  }, [onFallo])

  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return

    let cancelado = false
    let limpiar: (() => void) | undefined

    void (async () => {
      let THREE: typeof THREE_NS
      try {
        THREE = await import('three')
      } catch {
        if (!cancelado) onFalloRef.current()
        return
      }
      if (cancelado || !contenedorRef.current) return

      let renderer: THREE_NS.WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      } catch {
        // Sin WebGL —máquina vieja, driver en lista negra, aceleración
        // apagada— no hay nada que hacer aquí. El SVG cubre ese caso.
        onFalloRef.current()
        return
      }

      renderer.setSize(ANCHO, ALTO)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      const lienzo = renderer.domElement
      lienzo.style.width = '100%'
      lienzo.style.height = '100%'
      lienzo.style.display = 'block'
      contenedorRef.current.appendChild(lienzo)

      const escena = new THREE.Scene()
      const camara = new THREE.PerspectiveCamera(32, ANCHO / ALTO, 0.5, 60)
      camara.position.set(1.1, 2.6, 10.5)
      camara.lookAt(0, 2.1, 0)

      // ── Luces del script: clave cálida, relleno frío y contraluz ──────────
      escena.add(new THREE.AmbientLight(0xffffff, 1.1))
      const clave = new THREE.DirectionalLight(0xffd7a8, 2.4)
      clave.position.set(4, 7, 4) // Blender (4, -4, 7)
      escena.add(clave)
      const relleno = new THREE.DirectionalLight(0xa8c8ff, 1.1)
      relleno.position.set(-4, 4.5, 2) // Blender (-4, -2, 4.5)
      escena.add(relleno)
      const contra = new THREE.DirectionalLight(0xffffff, 1.6)
      contra.position.set(0, 5.5, -4) // Blender (0, 4, 5.5)
      escena.add(contra)

      // ── Cachés, para poder liberar todo al desmontar ──────────────────────
      const geometrias: THREE_NS.BufferGeometry[] = []
      const materiales = new Map<number, THREE_NS.MeshStandardMaterial>()

      const material = (color: number, rugosidad = 0.55) => {
        const existente = materiales.get(color)
        if (existente) return existente
        const nuevo = new THREE.MeshStandardMaterial({ color, roughness: rugosidad, metalness: 0.02 })
        materiales.set(color, nuevo)
        return nuevo
      }

      // ── El esqueleto, como árbol de grupos ────────────────────────────────
      const huesos = new Map<string, THREE_NS.Group>()
      const raiz = new THREE.Group()
      for (const [nombre, def] of Object.entries(HUESOS)) {
        const grupo = new THREE.Group()
        grupo.name = nombre
        const padre = def.padre ? huesos.get(def.padre) : undefined
        const origenPadre = def.padre ? HUESOS[def.padre].origen : [0, 0, 0]
        grupo.position.set(
          def.origen[0] - origenPadre[0],
          def.origen[1] - origenPadre[1],
          def.origen[2] - origenPadre[2],
        )
        ;(padre ?? raiz).add(grupo)
        huesos.set(nombre, grupo)
      }
      escena.add(raiz)

      /** Cuelga una pieza de un hueso indicando su posición de mundo, como el script. */
      const colgar = (hueso: string, malla: THREE_NS.Mesh, mundo: [number, number, number]) => {
        const origen = HUESOS[hueso].origen
        malla.position.set(mundo[0] - origen[0], mundo[1] - origen[1], mundo[2] - origen[2])
        huesos.get(hueso)!.add(malla)
        return malla
      }

      /** Esfera escalada. En Blender la primitiva tiene radio 1, así que la escala son los radios. */
      const esfera = (radios: [number, number, number], color: number, rugosidad?: number) => {
        const geo = new THREE.SphereGeometry(1, 20, 14)
        geo.scale(radios[0], radios[1], radios[2])
        geometrias.push(geo)
        return new THREE.Mesh(geo, material(color, rugosidad))
      }

      /** Cono truncado. El eje de la primitiva es Z en Blender e Y en Three, que es el mismo. */
      const cono = (abajo: number, arriba: number, alto: number, color: number) => {
        const geo = new THREE.CylinderGeometry(arriba, abajo, alto, 18)
        geometrias.push(geo)
        return new THREE.Mesh(geo, material(color))
      }

      /** Caja. La primitiva de Blender mide 2×2×2, así que su escala son medias aristas. */
      const caja = (medias: [number, number, number], color: number) => {
        const geo = new THREE.BoxGeometry(medias[0] * 2, medias[1] * 2, medias[2] * 2)
        geometrias.push(geo)
        return new THREE.Mesh(geo, material(color))
      }

      /** Cilindro entre dos puntos, como `cylinder_between` del script. */
      const cilindroEntre = (
        hueso: string,
        a: [number, number, number],
        b: [number, number, number],
        radio: number,
        color: number,
      ) => {
        const va = new THREE.Vector3(...a)
        const vb = new THREE.Vector3(...b)
        const direccion = new THREE.Vector3().subVectors(vb, va)
        const largo = direccion.length()
        const geo = new THREE.CylinderGeometry(radio, radio, largo, 14)
        geometrias.push(geo)
        const malla = new THREE.Mesh(geo, material(color))
        malla.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direccion.clone().normalize(),
        )
        const medio = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5)
        return colgar(hueso, malla, [medio.x, medio.y, medio.z])
      }

      // ── Cuerpo ────────────────────────────────────────────────────────────
      // La sudadera del script llega hasta y≈0,8 y se comía las piernas: el
      // personaje salía como un saco azul con zapatillas. Aquí termina en la
      // cadera, que es lo que enseña la lámina, y el pantalón se ve entero.
      colgar('Spine', esfera([0.68, 0.86, 0.44], COLORES.azul, 0.72), [0, 2.32, 0])
      // Cadera, para que no quede un hueco entre la sudadera y los muslos.
      colgar('Spine', esfera([0.5, 0.34, 0.38], COLORES.pantalon, 0.7), [0, 1.5, 0])
      // Bolsillo canguro. En el script era un panel de 0,62 de alto que a esta
      // distancia se leía como un óvalo pegado al pecho.
      colgar('Spine', esfera([0.36, 0.2, 0.07], COLORES.azulOscuro, 0.75), [0, 1.86, 0.42])
      // Pecho crema asomando por el cuello de la sudadera.
      colgar('Chest', esfera([0.24, 0.2, 0.12], COLORES.crema, 0.55), [0, 2.92, 0.34])
      // Capucha caída sobre la espalda.
      colgar('Chest', esfera([0.52, 0.4, 0.38], COLORES.azul, 0.72), [0, 3.0, -0.3])

      // Cordones de la capucha
      for (const x of [-0.12, 0.12]) {
        cilindroEntre('Chest', [x, 3.02, 0.4], [x, 2.6, 0.44], 0.028, COLORES.blanco)
      }

      // ── Cabeza ────────────────────────────────────────────────────────────
      colgar('Head', esfera([0.7, 0.72, 0.55], COLORES.naranja, 0.48), [0, 3.82, 0.01])
      colgar('Head', esfera([0.43, 0.31, 0.22], COLORES.crema, 0.52), [0, 3.65, 0.54])
      colgar('Head', esfera([0.16, 0.12, 0.11], COLORES.negro, 0.22), [0, 3.72, 0.72])
      for (const x of [-0.4, 0.4]) {
        colgar('Head', esfera([0.28, 0.27, 0.16], COLORES.crema, 0.52), [x, 3.55, 0.47])
      }

      // Ojos, con las pupilas sueltas para que sigan al cursor. Son mayores que
      // en el script: a 72 píxeles los del original quedaban en dos puntos y la
      // cara no expresaba nada, que es justo para lo que está el personaje.
      const pupilas: { malla: THREE_NS.Mesh; base: THREE_NS.Vector3 }[] = []
      for (const x of [0.28, -0.28]) {
        colgar('Head', esfera([0.21, 0.25, 0.12], COLORES.blanco, 0.2), [x, 3.98, 0.48])
        const pupila = colgar('Head', esfera([0.115, 0.145, 0.06], COLORES.negro, 0.18), [x, 3.96, 0.56])
        const brillo = colgar('Head', esfera([0.04, 0.05, 0.02], COLORES.blanco, 0.1), [x - 0.05, 4.05, 0.6])
        pupilas.push({ malla: pupila, base: pupila.position.clone() })
        pupilas.push({ malla: brillo, base: brillo.position.clone() })
      }

      // Cejas. El script las gira sobre el eje vertical, que de frente no se
      // nota; se inclinan sobre el eje de profundidad para que se lean, y bajan
      // de 4,27 a la altura de los ojos, porque arriba caían fuera de la vista.
      for (const x of [0.29, -0.29]) {
        const ceja = colgar('Head', caja([0.17, 0.045, 0.03], COLORES.marron), [x, 4.24, 0.46])
        ceja.rotation.z = x > 0 ? -0.28 : 0.28
      }

      // Orejas. El interior va en Ear Dark y no en Cream: es lo que enseña la
      // lámina de referencia, y en crema se perdía contra el resto de la cara.
      const orejas: THREE_NS.Group[] = []
      for (const x of [0.42, -0.42]) {
        const oreja = new THREE.Group()
        const exterior = cono(0.3, 0.05, 0.8, COLORES.naranja)
        exterior.position.set(0, 0, 0)
        const interior = cono(0.17, 0.025, 0.58, COLORES.naranjaOscuro)
        interior.position.set(0, -0.02, 0.05)
        oreja.add(exterior, interior)
        colgar('Head', oreja as unknown as THREE_NS.Mesh, [x, 4.45, 0])
        orejas.push(oreja)
      }

      // ── Brazos ────────────────────────────────────────────────────────────
      for (const [lado, sx] of [['L', 1], ['R', -1]] as const) {
        cilindroEntre(`UpperArm.${lado}`, [0.45 * sx, 2.92, 0], [0.92 * sx, 2.55, 0], 0.2, COLORES.azul)
        cilindroEntre(`Forearm.${lado}`, [0.92 * sx, 2.55, 0], [1.18 * sx, 2.1, 0], 0.17, COLORES.marron)
        colgar(`Hand.${lado}`, esfera([0.21, 0.25, 0.16], COLORES.marron, 0.58), [1.23 * sx, 2.0, 0.01])
      }

      // ── Piernas y zapatillas ──────────────────────────────────────────────
      for (const [lado, sx] of [['L', 1], ['R', -1]] as const) {
        cilindroEntre(`Thigh.${lado}`, [0.27 * sx, 1.45, 0], [0.32 * sx, 0.42, 0], 0.25, COLORES.pantalon)
        cilindroEntre(`Shin.${lado}`, [0.32 * sx, 0.42, 0], [0.32 * sx, 0.12, 0], 0.2, COLORES.marron)
        colgar(`Foot.${lado}`, caja([0.27, 0.15, 0.43], COLORES.zapatilla), [0.32 * sx, 0.1, 0.22])
        colgar(`Foot.${lado}`, caja([0.29, 0.055, 0.45], COLORES.zapatillaAzul), [0.32 * sx, 0.01, 0.25])
      }

      // ── Cola ──────────────────────────────────────────────────────────────
      colgar('Tail', esfera([0.52, 0.42, 0.34], COLORES.naranja, 0.48), [0.3, 1.63, -0.3])
      colgar('Tail.01', esfera([0.48, 0.36, 0.31], COLORES.naranja, 0.48), [0.76, 1.79, -0.39])
      colgar('Tail.02', esfera([0.43, 0.32, 0.27], COLORES.naranja, 0.48), [1.18, 1.78, -0.46])
      colgar('Tail.02', esfera([0.3, 0.24, 0.21], COLORES.crema, 0.52), [1.47, 1.7, -0.49])

      // ── Referencias que mueve el bucle ────────────────────────────────────
      const gRaiz = raiz
      const gSpine = huesos.get('Spine')!
      const gCabeza = huesos.get('Head')!
      const gCola = huesos.get('Tail')!
      const gCola1 = huesos.get('Tail.01')!
      const gCola2 = huesos.get('Tail.02')!
      const gBrazoD = huesos.get('UpperArm.R')!
      const gAntebrazoD = huesos.get('Forearm.R')!
      const gBrazoI = huesos.get('UpperArm.L')!

      // ── Cursor ────────────────────────────────────────────────────────────
      let ratonX = 0
      let ratonY = 0
      const alMoverRaton = (e: MouseEvent) => {
        ratonX = Math.min(Math.max((e.clientX / window.innerWidth) * 2 - 1, -1), 1)
        ratonY = Math.min(Math.max(-(e.clientY / window.innerHeight) * 2 + 1, -1), 1)
      }
      window.addEventListener('mousemove', alMoverRaton, { passive: true })

      // Con el movimiento reducido activado el personaje se queda quieto, pero
      // sigue siendo 3D: se ve el volumen y las luces, no una foto.
      const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // ── Bucle ─────────────────────────────────────────────────────────────
      // Se para cuando la pestaña no está a la vista o el zorro sale de
      // pantalla: es un bucle permanente en una esquina, y en un portátil eso
      // se nota en la batería.
      // `THREE.Clock` está obsoleto desde la r180; el tiempo sale del reloj del
      // navegador, que es lo único que necesitaba.
      const arranque = performance.now()
      let idFrame = 0
      let visible = !document.hidden
      let enPantalla = true

      const dibujar = () => {
        const t = (performance.now() - arranque) / 1000
        const { abierto: estaAbierto, arrastrando: estaArrastrando } = estadoRef.current

        if (sinMovimiento) {
          gRaiz.position.y = 0
          gRaiz.rotation.z = 0
        } else if (estaArrastrando) {
          // Colgando del puntero: se balancea, se inclina y sube los brazos.
          gRaiz.position.y = Math.sin(t * 12) * 0.09
          gRaiz.rotation.z = Math.sin(t * 8) * 0.22 + 0.12
          gCabeza.rotation.x = -0.12
          gBrazoD.rotation.z = -0.75
          gBrazoI.rotation.z = 0.75
        } else if (estaAbierto) {
          // Saludo, con los tiempos de la acción «Wave» del script.
          const fase = (t % 2.1) / 2.1
          const saludo = Math.sin(fase * Math.PI * 4) * 0.55
          gRaiz.position.y = Math.sin(t * 5) * 0.05
          gRaiz.rotation.z = 0
          gBrazoD.rotation.z = -1.75 + saludo * 0.35
          gBrazoD.rotation.x = 0.25
          gAntebrazoD.rotation.z = saludo * 0.5
          gBrazoI.rotation.z = -BRAZO_REPOSO
          gCabeza.rotation.z = Math.sin(t * 4) * 0.1
        } else {
          // Reposo: la acción «Idle», respiración y coleteo.
          gRaiz.position.y = Math.sin(t * 2.5) * 0.045
          gRaiz.rotation.z += (0 - gRaiz.rotation.z) * 0.12
          gSpine.rotation.y = Math.sin(t * 2.5) * 0.05
          gBrazoD.rotation.z += (BRAZO_REPOSO - gBrazoD.rotation.z) * 0.12
          gBrazoD.rotation.x += (0 - gBrazoD.rotation.x) * 0.12
          gAntebrazoD.rotation.z += (0 - gAntebrazoD.rotation.z) * 0.12
          gBrazoI.rotation.z += (-BRAZO_REPOSO - gBrazoI.rotation.z) * 0.12
          gCabeza.rotation.z += (0 - gCabeza.rotation.z) * 0.12
        }

        if (!sinMovimiento) {
          gCola.rotation.y = Math.sin(t * 3.5) * 0.3
          gCola1.rotation.y = Math.sin(t * 3.5 - 0.5) * 0.24
          gCola2.rotation.y = Math.sin(t * 3.5 - 1.0) * 0.2
          orejas[0].rotation.z = Math.sin(t * 3) * 0.06
          orejas[1].rotation.z = -Math.sin(t * 3) * 0.06
        }

        if (!estaArrastrando) {
          // La cabeza y las pupilas siguen al cursor.
          const objetivoY = ratonX * 0.4
          const objetivoX = -ratonY * 0.22
          gCabeza.rotation.y += (objetivoY - gCabeza.rotation.y) * 0.09
          gCabeza.rotation.x += (objetivoX - gCabeza.rotation.x) * 0.09
          for (const { malla, base } of pupilas) {
            malla.position.x += (base.x + ratonX * 0.035 - malla.position.x) * 0.12
            malla.position.y += (base.y + ratonY * 0.03 - malla.position.y) * 0.12
          }
        }

        renderer.render(escena, camara)
      }

      const bucle = () => {
        idFrame = requestAnimationFrame(bucle)
        dibujar()
      }
      const arrancar = () => {
        if (idFrame === 0 && visible && enPantalla) {
          idFrame = requestAnimationFrame(bucle)
        }
      }
      const parar = () => {
        if (idFrame !== 0) {
          cancelAnimationFrame(idFrame)
          idFrame = 0
        }
      }

      const alCambiarVisibilidad = () => {
        visible = !document.hidden
        if (visible) arrancar()
        else parar()
      }
      document.addEventListener('visibilitychange', alCambiarVisibilidad)

      const observador = new IntersectionObserver(([entrada]) => {
        enPantalla = entrada.isIntersecting
        if (enPantalla) arrancar()
        else parar()
      })
      observador.observe(contenedorRef.current)

      // Un fotograma inmediato: sin esto el hueco se ve vacío hasta el primer
      // requestAnimationFrame, que con la pestaña en segundo plano no llega.
      dibujar()
      arrancar()

      limpiar = () => {
        parar()
        observador.disconnect()
        document.removeEventListener('visibilitychange', alCambiarVisibilidad)
        window.removeEventListener('mousemove', alMoverRaton)
        for (const geo of geometrias) geo.dispose()
        for (const mat of materiales.values()) mat.dispose()
        renderer.dispose()
        // Sin esto el contexto WebGL sobrevive al desmontaje y el navegador
        // acaba tirando los más viejos cuando se pasa del límite.
        renderer.forceContextLoss()
        if (lienzo.parentNode) lienzo.parentNode.removeChild(lienzo)
      }
    })()

    return () => {
      cancelado = true
      limpiar?.()
    }
  }, [])

  return <div ref={contenedorRef} className={className ?? 'h-[78px] w-[72px] transform-gpu'} />
}
