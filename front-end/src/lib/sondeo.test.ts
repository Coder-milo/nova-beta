import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { intervaloVisible } from './sondeo.ts'

/**
 * Un navegador de mentira, lo justo para gobernar el reloj y la visibilidad.
 *
 * El comportamiento que se prueba aquí sólo se ve con el tiempo pasando y la
 * pestaña cambiando de estado; con el `setInterval` real habría que esperar
 * cuarenta y cinco segundos por caso.
 */
class NavegadorFalso {
  oculto = false
  private tareas = new Map<number, { fn: () => void; cada: number; proxima: number }>()
  private oyentes: Array<() => void> = []
  private siguienteId = 1
  ahora = 1_000_000

  instalar() {
    const self = this
    const g = globalThis as Record<string, unknown>
    g.window = {
      setInterval(fn: () => void, cada: number) {
        const id = self.siguienteId++
        self.tareas.set(id, { fn, cada, proxima: self.ahora + cada })
        return id
      },
      clearInterval(id: number) { self.tareas.delete(id) },
    }
    g.document = {
      get hidden() { return self.oculto },
      addEventListener(evento: string, fn: () => void) {
        if (evento === 'visibilitychange') self.oyentes.push(fn)
      },
      removeEventListener(evento: string, fn: () => void) {
        if (evento === 'visibilitychange') self.oyentes = self.oyentes.filter((o) => o !== fn)
      },
    }
    this.dateOriginal = Date.now
    Date.now = () => self.ahora
  }

  private dateOriginal: () => number = Date.now

  desinstalar() {
    Date.now = this.dateOriginal
    const g = globalThis as Record<string, unknown>
    delete g.window
    delete g.document
  }

  /** Adelanta el reloj y dispara los intervalos que tocaban por el camino. */
  avanzar(milisegundos: number) {
    const destino = this.ahora + milisegundos
    let seguir = true
    while (seguir) {
      seguir = false
      for (const tarea of [...this.tareas.values()]) {
        if (tarea.proxima <= destino) {
          this.ahora = tarea.proxima
          tarea.proxima += tarea.cada
          tarea.fn()
          seguir = true
        }
      }
    }
    this.ahora = destino
  }

  cambiarVisibilidad(oculto: boolean) {
    this.oculto = oculto
    for (const oyente of [...this.oyentes]) oyente()
  }

  get oyentesVivos() { return this.oyentes.length }
}

describe('intervaloVisible', () => {
  let navegador: NavegadorFalso

  beforeEach(() => { navegador = new NavegadorFalso(); navegador.instalar() })
  afterEach(() => { navegador.desinstalar() })

  test('repite la tarea mientras la pestaña se ve', () => {
    let veces = 0
    const detener = intervaloVisible(() => { veces++ }, 45_000)

    navegador.avanzar(45_000 * 3)
    assert.equal(veces, 3)
    detener()
  })

  test('no pide nada mientras la pestaña está oculta', () => {
    let veces = 0
    const detener = intervaloVisible(() => { veces++ }, 45_000)

    navegador.cambiarVisibilidad(true)
    navegador.avanzar(45_000 * 10)

    assert.equal(veces, 0, 'una pestaña olvidada en segundo plano no debe pedir datos')
    detener()
  })

  test('al volver a la pestaña se ejecuta enseguida, sin esperar al ciclo', () => {
    let veces = 0
    const detener = intervaloVisible(() => { veces++ }, 45_000)

    navegador.cambiarVisibilidad(true)
    navegador.avanzar(60_000)
    navegador.cambiarVisibilidad(false)

    assert.equal(veces, 1, 'volver a mirar es justo cuando hacen falta datos al día')
    detener()
  })

  test('ir y venir de pestaña no dispara una petición por cada cambio', () => {
    let veces = 0
    const detener = intervaloVisible(() => { veces++ }, 45_000)

    for (let i = 0; i < 5; i++) {
      navegador.cambiarVisibilidad(true)
      navegador.avanzar(500)
      navegador.cambiarVisibilidad(false)
    }

    assert.equal(veces, 0, 'acaba de ejecutarse: repetirlo cinco veces no aporta nada')
    detener()
  })

  test('detenerlo suelta el intervalo y el oyente', () => {
    let veces = 0
    const detener = intervaloVisible(() => { veces++ }, 45_000)
    detener()

    navegador.avanzar(45_000 * 5)
    navegador.cambiarVisibilidad(true)
    navegador.cambiarVisibilidad(false)

    assert.equal(veces, 0)
    assert.equal(navegador.oyentesVivos, 0, 'un oyente que sobrevive al desmontaje es una fuga')
  })
})
