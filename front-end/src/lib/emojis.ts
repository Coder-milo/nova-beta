/**
 * Catálogo de emojis del chat, por categorías y con palabras para buscarlos.
 *
 * <p>Es una selección y no el juego completo de Unicode a propósito. Un
 * catálogo completo con sus sinónimos son cientos de kilobytes que se descargan
 * para abrir un chat, y nadie busca «U+1FAE0». Aquí están los que se usan
 * escribiendo con compañeros, que es de lo que va esta pantalla.
 *
 * <p>Las palabras van en español y en inglés porque el portal tiene los dos
 * idiomas, y sin tildes porque la búsqueda normaliza: quien escribe rápido no
 * pone la tilde de «corazón».
 */
export interface CategoriaEmoji {
  id: string
  etiqueta: { es: string; en: string }
  icono: string
  emojis: { char: string; claves: string }[]
}

/** Quita tildes y pasa a minúsculas, para que «corazon» encuentre «corazón». */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export const CATEGORIAS_EMOJI: CategoriaEmoji[] = [
  {
    id: 'caras',
    etiqueta: { es: 'Caras y personas', en: 'Smileys & people' },
    icono: '😀',
    emojis: [
      { char: '😀', claves: 'sonrisa feliz contento smile happy' },
      { char: '😃', claves: 'sonrisa alegre smile joy' },
      { char: '😄', claves: 'risa feliz laugh happy' },
      { char: '😁', claves: 'sonrisa dientes grin' },
      { char: '😂', claves: 'risa llorando lagrimas laugh crying funny' },
      { char: '🤣', claves: 'risa suelo rolling laughing' },
      { char: '😊', claves: 'sonrisa timida sonrojo blush smile' },
      { char: '😇', claves: 'angel inocente halo innocent' },
      { char: '🙂', claves: 'sonrisa leve slight smile' },
      { char: '😉', claves: 'guino wink' },
      { char: '😍', claves: 'enamorado corazones ojos love eyes' },
      { char: '🥰', claves: 'enamorado carino love hearts' },
      { char: '😘', claves: 'beso kiss' },
      { char: '😎', claves: 'gafas sol genial cool sunglasses' },
      { char: '🤔', claves: 'pensando duda thinking' },
      { char: '😐', claves: 'neutral serio neutral' },
      { char: '😴', claves: 'dormido sueno sleeping' },
      { char: '😢', claves: 'triste llorar sad cry' },
      { char: '😭', claves: 'llorando mucho crying' },
      { char: '😅', claves: 'nervioso sudor sweat nervous' },
      { char: '😳', claves: 'sorpresa verguenza flushed' },
      { char: '😱', claves: 'susto miedo scream fear' },
      { char: '😡', claves: 'enfadado rabia angry' },
      { char: '🤝', claves: 'acuerdo trato manos handshake deal' },
      { char: '🙏', claves: 'gracias favor por favor please thanks pray' },
      { char: '👏', claves: 'aplauso felicidades clap' },
      { char: '👍', claves: 'bien vale ok pulgar thumbs up' },
      { char: '👎', claves: 'mal no pulgar thumbs down' },
      { char: '💪', claves: 'fuerza animo strong muscle' },
      { char: '🙌', claves: 'celebrar manos arriba celebrate' },
      { char: '👋', claves: 'hola adios saludo wave hello' },
      { char: '🫡', claves: 'saludo entendido salute' },
    ],
  },
  {
    id: 'animales',
    etiqueta: { es: 'Animales y naturaleza', en: 'Animals & nature' },
    icono: '🐶',
    emojis: [
      { char: '🐶', claves: 'perro dog' },
      { char: '🐱', claves: 'gato cat' },
      { char: '🐭', claves: 'raton mouse' },
      { char: '🐰', claves: 'conejo rabbit' },
      { char: '🦊', claves: 'zorro fox' },
      { char: '🐻', claves: 'oso bear' },
      { char: '🐼', claves: 'panda' },
      { char: '🦁', claves: 'leon lion' },
      { char: '🐮', claves: 'vaca cow' },
      { char: '🐷', claves: 'cerdo pig' },
      { char: '🐸', claves: 'rana frog' },
      { char: '🐵', claves: 'mono monkey' },
      { char: '🐔', claves: 'gallina pollo chicken' },
      { char: '🦄', claves: 'unicornio unicorn' },
      { char: '🐝', claves: 'abeja bee' },
      { char: '🦋', claves: 'mariposa butterfly' },
      { char: '🌸', claves: 'flor cerezo flower' },
      { char: '🌻', claves: 'girasol sunflower' },
      { char: '🌹', claves: 'rosa rose' },
      { char: '🌳', claves: 'arbol tree' },
      { char: '🌵', claves: 'cactus' },
      { char: '☀️', claves: 'sol soleado sun' },
      { char: '🌙', claves: 'luna noche moon' },
      { char: '⭐', claves: 'estrella star' },
      { char: '🌈', claves: 'arcoiris rainbow' },
      { char: '⚡', claves: 'rayo energia lightning' },
      { char: '🔥', claves: 'fuego genial fire hot' },
      { char: '❄️', claves: 'nieve frio snow cold' },
    ],
  },
  {
    id: 'comida',
    etiqueta: { es: 'Comida y bebida', en: 'Food & drink' },
    icono: '🍔',
    emojis: [
      { char: '🍎', claves: 'manzana apple' },
      { char: '🍌', claves: 'banano platano banana' },
      { char: '🍓', claves: 'fresa strawberry' },
      { char: '🍉', claves: 'sandia watermelon' },
      { char: '🥑', claves: 'aguacate avocado' },
      { char: '🍞', claves: 'pan bread' },
      { char: '🧀', claves: 'queso cheese' },
      { char: '🍗', claves: 'pollo chicken' },
      { char: '🍔', claves: 'hamburguesa burger' },
      { char: '🍟', claves: 'papas fritas fries' },
      { char: '🍕', claves: 'pizza' },
      { char: '🌮', claves: 'taco' },
      { char: '🍚', claves: 'arroz rice' },
      { char: '🍜', claves: 'sopa fideos noodles soup' },
      { char: '🍰', claves: 'pastel torta cake' },
      { char: '🍫', claves: 'chocolate' },
      { char: '🍪', claves: 'galleta cookie' },
      { char: '☕', claves: 'cafe tinto coffee' },
      { char: '🧉', claves: 'mate infusion' },
      { char: '🥤', claves: 'gaseosa refresco soda drink' },
      { char: '🍺', claves: 'cerveza beer' },
      { char: '🥂', claves: 'brindis celebrar cheers' },
    ],
  },
  {
    id: 'actividad',
    etiqueta: { es: 'Actividad y deporte', en: 'Activity & sports' },
    icono: '⚽',
    emojis: [
      { char: '⚽', claves: 'futbol balon soccer football' },
      { char: '🏀', claves: 'baloncesto basket' },
      { char: '🏈', claves: 'futbol americano football' },
      { char: '🎾', claves: 'tenis tennis' },
      { char: '🏐', claves: 'voleibol volleyball' },
      { char: '🥊', claves: 'boxeo boxing' },
      { char: '🏃', claves: 'correr running' },
      { char: '🚴', claves: 'bicicleta ciclismo bike' },
      { char: '🏊', claves: 'nadar natacion swim' },
      { char: '🧘', claves: 'yoga meditar calma' },
      { char: '🎯', claves: 'objetivo meta diana target goal' },
      { char: '🏆', claves: 'trofeo ganar premio trophy win' },
      { char: '🥇', claves: 'oro primero medalla gold first' },
      { char: '🎉', claves: 'fiesta celebrar party celebrate' },
      { char: '🎊', claves: 'confeti celebrar confetti' },
      { char: '🎁', claves: 'regalo gift' },
      { char: '🎵', claves: 'musica nota music' },
      { char: '🎧', claves: 'auriculares audifonos headphones' },
      { char: '🎤', claves: 'microfono cantar mic sing' },
      { char: '🎬', claves: 'cine pelicula movie' },
      { char: '🎮', claves: 'videojuego juego game' },
      { char: '📚', claves: 'libros estudiar books study' },
    ],
  },
  {
    id: 'viajes',
    etiqueta: { es: 'Viajes y lugares', en: 'Travel & places' },
    icono: '🚗',
    emojis: [
      { char: '🚗', claves: 'carro coche auto car' },
      { char: '🚌', claves: 'bus buseta autobus' },
      { char: '🚕', claves: 'taxi' },
      { char: '🏍️', claves: 'moto motocicleta motorcycle' },
      { char: '🚲', claves: 'bicicleta bike' },
      { char: '✈️', claves: 'avion viaje plane travel' },
      { char: '🚆', claves: 'tren train' },
      { char: '🚢', claves: 'barco ship' },
      { char: '🏠', claves: 'casa hogar home house' },
      { char: '🏢', claves: 'oficina edificio empresa office building' },
      { char: '🏥', claves: 'hospital salud' },
      { char: '🏫', claves: 'colegio escuela school' },
      { char: '🌆', claves: 'ciudad city' },
      { char: '🏖️', claves: 'playa beach' },
      { char: '⛰️', claves: 'montana mountain' },
      { char: '🗺️', claves: 'mapa map' },
      { char: '📍', claves: 'ubicacion lugar location pin' },
    ],
  },
  {
    id: 'objetos',
    etiqueta: { es: 'Objetos', en: 'Objects' },
    icono: '💼',
    emojis: [
      { char: '💼', claves: 'trabajo maletin empleo work briefcase job' },
      { char: '💻', claves: 'computador portatil laptop computer' },
      { char: '📱', claves: 'celular telefono phone mobile' },
      { char: '⌨️', claves: 'teclado keyboard' },
      { char: '🖨️', claves: 'impresora printer' },
      { char: '📷', claves: 'camara foto camera photo' },
      { char: '🔋', claves: 'bateria battery' },
      { char: '💡', claves: 'idea bombillo idea light' },
      { char: '🔑', claves: 'llave key' },
      { char: '🔒', claves: 'candado seguro lock' },
      { char: '📄', claves: 'documento hoja papel document paper' },
      { char: '📋', claves: 'portapapeles lista clipboard' },
      { char: '📝', claves: 'escribir nota anotar write note' },
      { char: '📎', claves: 'clip adjunto attachment' },
      { char: '📅', claves: 'calendario fecha calendar date' },
      { char: '⏰', claves: 'reloj alarma hora clock alarm' },
      { char: '💰', claves: 'dinero plata salario money' },
      { char: '✉️', claves: 'correo carta mail email' },
      { char: '📞', claves: 'llamada telefono call phone' },
      { char: '🔍', claves: 'buscar lupa search' },
    ],
  },
  {
    id: 'simbolos',
    etiqueta: { es: 'Símbolos', en: 'Symbols' },
    icono: '❤️',
    emojis: [
      { char: '❤️', claves: 'corazon amor rojo heart love' },
      { char: '🧡', claves: 'corazon naranja heart orange' },
      { char: '💛', claves: 'corazon amarillo heart yellow' },
      { char: '💚', claves: 'corazon verde heart green' },
      { char: '💙', claves: 'corazon azul heart blue' },
      { char: '💜', claves: 'corazon morado heart purple' },
      { char: '🖤', claves: 'corazon negro heart black' },
      { char: '💔', claves: 'corazon roto broken heart' },
      { char: '✅', claves: 'listo hecho correcto check done ok' },
      { char: '❌', claves: 'no error mal cross wrong' },
      { char: '⚠️', claves: 'cuidado alerta atencion warning' },
      { char: '❓', claves: 'pregunta duda question' },
      { char: '❗', claves: 'importante exclamacion important' },
      { char: '💯', claves: 'cien perfecto hundred perfect' },
      { char: '🔔', claves: 'campana aviso bell notification' },
      { char: '➕', claves: 'mas sumar plus' },
      { char: '➖', claves: 'menos restar minus' },
      { char: '🔁', claves: 'repetir repeat' },
    ],
  },
  {
    id: 'banderas',
    etiqueta: { es: 'Banderas', en: 'Flags' },
    icono: '🇨🇴',
    emojis: [
      { char: '🇨🇴', claves: 'colombia' },
      { char: '🇺🇸', claves: 'estados unidos usa america' },
      { char: '🇬🇧', claves: 'reino unido inglaterra uk england' },
      { char: '🇪🇸', claves: 'espana spain' },
      { char: '🇲🇽', claves: 'mexico' },
      { char: '🇨🇦', claves: 'canada' },
      { char: '🇧🇷', claves: 'brasil brazil' },
      { char: '🇦🇷', claves: 'argentina' },
      { char: '🇨🇱', claves: 'chile' },
      { char: '🇵🇪', claves: 'peru' },
      { char: '🏳️', claves: 'bandera blanca flag' },
      { char: '🏁', claves: 'meta final finish' },
    ],
  },
]

/** Todos los emojis del catálogo, para buscar sin importar la categoría. */
export const TODOS_LOS_EMOJIS = CATEGORIAS_EMOJI.flatMap((c) => c.emojis)

/**
 * Los que coinciden con lo escrito.
 *
 * <p>Busca en las palabras y también en el propio carácter, para que pegar un
 * emoji en el buscador lo encuentre.
 */
export function buscarEmojis(termino: string): { char: string; claves: string }[] {
  const q = normalizarBusqueda(termino)
  if (!q) return []
  return TODOS_LOS_EMOJIS.filter((e) => e.char === termino.trim() || normalizarBusqueda(e.claves).includes(q))
}
