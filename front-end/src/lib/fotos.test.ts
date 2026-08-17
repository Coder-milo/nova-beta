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
      const contenido = readFileSync(fichero, 'utf8')
      const lineas = contenido.split('\n')

      /**
       * Variables del fichero que ya salen de un ayudante.
       *
       * Sin esto, el guardián marcaba como rota una imagen correcta: en el chat
       * la ruta se compone una vez —`const fotoChat = enGrupos ? fotoDeGrupo(…)
       * : fotoDe(…)`— y se pinta en dos sitios. Exigir ver la llamada dentro
       * del propio `src` obligaría a repetir el ternario en los dos, que es
       * peor código para contentar a una comprobación.
       *
       * Lo que se sigue exigiendo es lo mismo: que la ruta haya pasado por un
       * ayudante. Solo se admite verlo una línea más arriba en vez de dentro
       * del atributo.
       */
      const yaCompuestas = new Set<string>()
      for (const coincidencia of contenido.matchAll(/(?:const|let)\s+(\w+)\s*=/g)) {
        // La asignación puede ocupar varias líneas —en el chat es un ternario
        // de tres—, así que se mira una ventana desde el `=` hasta la primera
        // línea en blanco, que es donde acaba la sentencia en la práctica.
        const desde = coincidencia.index + coincidencia[0].length
        const resto = contenido.slice(desde, desde + 400)
        const expresion = resto.split('\n\n')[0]
        if (/\bfoto\w*\(/.test(expresion) || expresion.includes('/api/')) {
          yaCompuestas.add(coincidencia[1])
        }
      }

      lineas.forEach((linea, i) => {
        const usoDeSrc = linea.match(/src=\{([^}]*)\}/g)
        if (!usoDeSrc) return
        for (const uso of usoDeSrc) {
          if (!/foto/i.test(uso)) continue
          // Las dos formas correctas: llamar a un ayudante que componga la
          // ruta —cualquiera que se llame `foto…(`, no uno concreto: hay uno
          // por tipo de foto y habrá más— o construirla a mano con `/api/`.
          if (/\bfoto\w*\(/.test(uso) || uso.includes('/api/')) continue
          // O pintar una variable que ya se compuso así en este mismo fichero.
          const nombre = uso.replace(/^src=\{|\}$/g, '').trim()
          if (yaCompuestas.has(nombre)) continue
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
