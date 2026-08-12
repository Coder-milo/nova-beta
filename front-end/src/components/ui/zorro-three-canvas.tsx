'use client'

/**
 * El zorro asistente en 3D, cargado del modelo esculpido en Blender.
 *
 * <p>Antes el personaje se armaba aquí a mano con primitivas —esferas, conos y
 * cajas colgadas de una jerarquía de huesos, portadas del generador de
 * Blender—. Ahora se carga `fox-character-suavizado.glb`, que es el mismo
 * personaje ya modelado y suavizado: la malla la decide el archivo y no una
 * lista de coordenadas en el código.
 *
 * <p><b>Qué se pierde y qué se gana.</b> El GLB llega sin esqueleto y sin
 * clips: son 17 mallas agrupadas por material —`furOrange`, `hoodieBlue`,
 * `eyeIris`…— y no por parte del cuerpo, así que no hay brazo que levantar ni
 * cola que menear por separado. La animación pasa a ser del conjunto: respira,
 * se balancea, se inclina al arrastrarlo y gira hacia el cursor. A cambio la
 * silueta es la del modelo real y no una aproximación con esferas.
 *
 * <p>Three.js y el GLB entran por `import()` dinámico y `fetch` para que no
 * pesen en la carga inicial: el asistente es un adorno de una esquina y no
 * puede retrasar la pantalla. Si no hay WebGL, si el trozo no llega o si el
 * modelo no se puede leer, se avisa con `onFallo` y quien nos usa pinta el
 * zorro en SVG.
 */

import { useEffect, useRef } from 'react'
import type * as THREE_NS from 'three'

interface Props {
  abierto: boolean
  arrastrando: boolean
  /** Se llama si no hay WebGL, si Three.js no carga o si el modelo no se puede leer. */
  onFallo: () => void
  className?: string
}

/** Lo que ocupa el lienzo. */
const ANCHO = 72
const ALTO = 78

/** Dónde vive el modelo. Se sirve estático desde `public/`. */
const MODELO = '/modelos/fox-character-suavizado.glb'

/**
 * Alto en unidades de escena al que se ajusta el personaje.
 *
 * El GLB puede venir en cualquier escala —depende de las unidades del archivo—,
 * así que en vez de confiar en ella se mide la caja envolvente y se escala a
 * esta altura. Así el encuadre no depende de cómo se exportara el modelo.
 */
const ALTO_OBJETIVO = 4.4

/**
 * El archivo, descargado una sola vez por pestaña.
 *
 * Son diez megas y el componente se monta más de una vez —React monta y
 * desmonta en desarrollo, y el zorro se recrea al cambiar de pantalla—, así que
 * sin esto la misma descarga salía tres veces. Se guarda el binario y no la
 * escena ya montada: cada instancia parsea su copia y es dueña de sus mallas,
 * que es lo que permite liberarlas al desmontar sin dejar a otra sin modelo.
 */
let binarioDelModelo: Promise<ArrayBuffer> | null = null

function descargarModelo(): Promise<ArrayBuffer> {
  binarioDelModelo ??= fetch(MODELO).then((respuesta) => {
    if (!respuesta.ok) {
      // Sin esto, una respuesta 404 se parsearía como si fuera un GLB y el
      // fallo saldría mucho después, como un error de formato.
      binarioDelModelo = null
      throw new Error(`El modelo respondió ${respuesta.status}`)
    }
    return respuesta.arrayBuffer()
  }).catch((error) => {
    binarioDelModelo = null
    throw error
  })
  return binarioDelModelo
}

export function ZorroThreeCanvas({ abierto, arrastrando, onFallo, className }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)

  // El bucle lee el estado por referencia: volver a montar la escena en cada
  // clic significaría recargar el modelo y perder la pose.
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
      let GLTFLoader: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader
      try {
        const [tres, loaders] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
        ])
        THREE = tres
        GLTFLoader = loaders.GLTFLoader
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

      // ── Luces: clave cálida, relleno frío y contraluz ─────────────────────
      escena.add(new THREE.AmbientLight(0xffffff, 1.1))
      const clave = new THREE.DirectionalLight(0xffd7a8, 2.4)
      clave.position.set(4, 7, 4)
      escena.add(clave)
      const relleno = new THREE.DirectionalLight(0xa8c8ff, 1.1)
      relleno.position.set(-4, 4.5, 2)
      escena.add(relleno)
      const contra = new THREE.DirectionalLight(0xffffff, 1.6)
      contra.position.set(0, 5.5, -4)
      escena.add(contra)

      // ── El modelo ─────────────────────────────────────────────────────────
      // `raiz` es lo que mueve el bucle; el GLB cuelga dentro ya centrado y
      // escalado, para que la animación no dependa de sus unidades ni de dónde
      // tenga el origen.
      const raiz = new THREE.Group()
      escena.add(raiz)

      let gltf: Awaited<ReturnType<InstanceType<typeof GLTFLoader>['parseAsync']>>
      try {
        const binario = await descargarModelo()
        // Una copia por instancia: el parseo puede quedarse con el búfer, y el
        // que está en caché tiene que seguir sirviendo para la siguiente.
        gltf = await new GLTFLoader().parseAsync(binario.slice(0), '')
      } catch {
        if (!cancelado) {
          renderer.dispose()
          renderer.forceContextLoss()
          if (lienzo.parentNode) lienzo.parentNode.removeChild(lienzo)
          onFalloRef.current()
        }
        return
      }
      if (cancelado || !contenedorRef.current) {
        renderer.dispose()
        renderer.forceContextLoss()
        return
      }

      const modelo = gltf.scene
      const caja = new THREE.Box3().setFromObject(modelo)
      const tamano = caja.getSize(new THREE.Vector3())
      const centro = caja.getCenter(new THREE.Vector3())
      const escala = tamano.y > 0 ? ALTO_OBJETIVO / tamano.y : 1
      modelo.scale.setScalar(escala)
      // Centrado en X y Z, y apoyado en y=0: el bucle sube y baja `raiz` desde
      // el suelo, no desde donde cayera el origen del archivo.
      modelo.position.set(
        -centro.x * escala,
        -caja.min.y * escala,
        -centro.z * escala,
      )
      raiz.add(modelo)

      // El pivote de giro está a la altura del pecho: rotar sobre los pies
      // hacía que la cabeza barriera media pantalla al seguir al cursor.
      raiz.position.y = 0

      /**
       * Clips del archivo, si los trae.
       *
       * Este GLB no tiene ninguno y la animación de abajo es del conjunto. Si
       * un día se exporta con «Idle» o «Wave», se reproducen sin tocar nada
       * más: se prefiere el clip a la animación de reserva.
       */
      const mezclador = gltf.animations.length > 0 ? new THREE.AnimationMixer(modelo) : null
      if (mezclador) {
        for (const clip of gltf.animations) mezclador.clipAction(clip).play()
      }

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
      const arranque = performance.now()
      let ultimo = arranque
      let idFrame = 0
      let visible = !document.hidden
      let enPantalla = true

      // Estado físico: posición y velocidad de cada muelle. Vive fuera del
      // bucle porque la gracia está justo en que un fotograma se acuerde del
      // anterior; recalcularlo desde cero sería otra vez una animación por
      // fórmula, sin inercia.
      let inclinacion = 0
      let velInclinacion = 0
      let altura = 0
      let velAltura = 0
      let giro = 0
      let velGiro = 0
      let cabeceo = 0
      let velCabeceo = 0
      let ratonPrevioX = 0

      const dibujar = () => {
        const ahora = performance.now()
        const t = (ahora - arranque) / 1000
        const dt = Math.min((ahora - ultimo) / 1000, 0.05)
        ultimo = ahora
        mezclador?.update(dt)

        const { abierto: estaAbierto, arrastrando: estaArrastrando } = estadoRef.current

        if (sinMovimiento) {
          raiz.position.set(0, 0, 0)
          raiz.rotation.set(0, 0, 0)
          raiz.scale.set(1, 1, 1)
          renderer.render(escena, camara)
          return
        }

        // ── Objetivos ─────────────────────────────────────────────────────
        // Nadie mueve el personaje a mano: se le dice dónde debería estar y
        // los muelles de abajo lo llevan. De ahí el peso: acelera, se pasa de
        // largo y vuelve, en vez de aparecer ya colocado.
        let inclinacionObjetivo = 0
        let alturaObjetivo = 0
        let giroObjetivo = ratonX * 0.5
        let cabeceoObjetivo = -ratonY * 0.16

        if (estaArrastrando) {
          // Colgando del puntero: se inclina hacia donde va y se estira.
          const velocidad = (ratonX - ratonPrevioX) / Math.max(dt, 0.001)
          inclinacionObjetivo = Math.max(Math.min(velocidad * 0.045, 0.5), -0.5)
          alturaObjetivo = -0.12
          giroObjetivo = ratonX * 0.25
          cabeceoObjetivo = 0.1
        } else if (estaAbierto) {
          // Atento a la conversación: peso de un pie al otro.
          inclinacionObjetivo = Math.sin(t * 2.2) * 0.09
          alturaObjetivo = Math.abs(Math.sin(t * 2.2)) * 0.06
        } else {
          // Reposo: respira y se balancea muy despacio.
          inclinacionObjetivo = Math.sin(t * 0.9) * 0.045
          alturaObjetivo = Math.sin(t * 1.6) * 0.035
        }
        ratonPrevioX = ratonX

        // ── Muelles ───────────────────────────────────────────────────────
        // Muelle amortiguado: a = k·(objetivo − x) − c·v. Con `k` alta y `c`
        // baja rebota; al revés llega y se queda. Los tres ejes usan el mismo
        // integrador con constantes distintas, que es lo que hace que la
        // inclinación tenga más recorrido que el giro.
        const muelle = (
          valor: number, velocidad: number, objetivo: number, k: number, c: number,
        ): [number, number] => {
          const aceleracion = (objetivo - valor) * k - velocidad * c
          const nuevaVelocidad = velocidad + aceleracion * dt
          return [valor + nuevaVelocidad * dt, nuevaVelocidad]
        }

        ;[inclinacion, velInclinacion] = muelle(
          inclinacion, velInclinacion, inclinacionObjetivo,
          estaArrastrando ? 90 : 42, estaArrastrando ? 7 : 6,
        )
        ;[altura, velAltura] = muelle(altura, velAltura, alturaObjetivo, 55, 7)
        ;[giro, velGiro] = muelle(giro, velGiro, giroObjetivo, 26, 8)
        ;[cabeceo, velCabeceo] = muelle(cabeceo, velCabeceo, cabeceoObjetivo, 26, 8)

        raiz.rotation.z = inclinacion
        raiz.rotation.y = giro
        raiz.rotation.x = cabeceo
        raiz.position.y = altura

        // ── Aplastar y estirar ────────────────────────────────────────────
        // El truco de animación de toda la vida: al subir se estira y al caer
        // se achata, conservando el volumen. Es lo que separa «una figura que
        // sube y baja» de «algo que pesa». Sale de la velocidad vertical, así
        // que no hay que sincronizar nada a mano.
        const estiramiento = Math.max(Math.min(velAltura * 0.18, 0.12), -0.12)
        raiz.scale.set(1 - estiramiento * 0.5, 1 + estiramiento, 1 - estiramiento * 0.5)

        renderer.render(escena, camara)
      }

      const bucle = () => {
        idFrame = requestAnimationFrame(bucle)
        dibujar()
      }
      const arrancar = () => {
        if (idFrame === 0 && visible && enPantalla) {
          ultimo = performance.now()
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
        mezclador?.stopAllAction()
        // Lo que trae el GLB lo liberamos nosotros: el cargador no guarda
        // ninguna referencia y sin esto la malla y sus materiales se quedan en
        // memoria de la GPU al cambiar de pantalla.
        modelo.traverse((objeto) => {
          const malla = objeto as THREE_NS.Mesh
          if (!malla.isMesh) return
          malla.geometry?.dispose()
          const material = malla.material
          if (Array.isArray(material)) material.forEach((m) => m.dispose())
          else material?.dispose()
        })
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
