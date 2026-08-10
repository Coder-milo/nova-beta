import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Ninguna imagen puede pintar `fotoUrl` tal cual.
 *
 * El campo se llama `fotoUrl` y no es una dirección: es la clave con la que el
 * archivo está guardado en el almacenamiento. Puesto en un `<img src>` da una
 * imagen rota siempre, y el fallo no se ve, porque lo único que aparece bien es
 * la inicial de quien no tiene foto — justo el caso en el que no se intenta
 * cargar nada. La pantalla parece correcta hasta que alguien sube su cara.
 *
 * Pasó dos veces en dos días: seis sitios entre el chat del estudiante y la
 * cabecera. El nombre del campo invita al error, así que hasta que se llame
 * como lo que es, esto lo detiene.
 *
 * Lo que sí vale: pasar por un ayudante (`fotoDe(...)`) o construir la ruta a
 * mano con `/api/`. Lo que no: el campo pelado.
 */

const RAIZ = 'src'

function ficherosDePantalla(carpeta: string): string[] {
  const encontrados: string[] = []
  for (const entrada of readdirSync(carpeta)) {
    const ruta = join(carpeta, entrada)
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...ficherosDePantalla(ruta))
    } else if (ruta.endsWith('.tsx')) {
      encontrados.push(ruta)
    }
  }
  return encontrados
}

describe('fotos de perfil', () => {
  test('ninguna imagen usa la clave de almacenamiento como dirección', () => {
    const sospechosos: string[] = []

    for (const fichero of ficherosDePantalla(RAIZ)) {
      const lineas = readFileSync(fichero, 'utf8').split('\n')
      lineas.forEach((linea, i) => {
        const usoDeSrc = linea.match(/src=\{([^}]*)\}/g)
        if (!usoDeSrc) return
        for (const uso of usoDeSrc) {
          if (!/foto/i.test(uso)) continue
          // Las dos formas correctas: llamar a un ayudante que componga la
          // ruta —cualquiera que se llame `foto…(`, no uno concreto: hay uno
          // por tipo de foto y habrá más— o construirla a mano con `/api/`.
          if (/\bfoto\w*\(/.test(uso) || uso.includes('/api/')) continue
          sospechosos.push(`${fichero}:${i + 1}  ${uso.trim()}`)
        }
      })
    }

    assert.deepEqual(
      sospechosos,
      [],
      'Estas imágenes pintan la clave de almacenamiento como si fuera una ' +
        'dirección, así que no cargan nunca. Pásalas por un ayudante que ' +
        'componga la ruta del endpoint que corresponda a quien mira:\n' +
        sospechosos.join('\n'),
    )
  })
})
