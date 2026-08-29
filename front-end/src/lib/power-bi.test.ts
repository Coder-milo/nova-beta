import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extraerUrlEmbedPowerBi } from './power-bi-util.ts'

describe('extraerUrlEmbedPowerBi', () => {
  it('devuelve la URL directa sin modificar cuando se pega solo el enlace', () => {
    const url = 'https://app.powerbi.com/view?r=eyJrIjoiMTIzNCIsImMiOjF9'
    assert.equal(extraerUrlEmbedPowerBi(url), url)
  })

  it('limpia espacios en blanco alrededor de una URL directa', () => {
    const url = '  https://app.powerbi.com/view?r=eyJrIjoiMTIzNCIsImMiOjF9  \n'
    assert.equal(extraerUrlEmbedPowerBi(url), 'https://app.powerbi.com/view?r=eyJrIjoiMTIzNCIsImMiOjF9')
  })

  it('extrae automáticamente el src cuando se pega un fragmento <iframe> con comillas dobles', () => {
    const iframeSnippet =
      '<iframe title="Reporte Empleabilidad" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiMTIzNCIsImMiOjF9" frameborder="0" allowFullScreen="true"></iframe>'
    assert.equal(
      extraerUrlEmbedPowerBi(iframeSnippet),
      'https://app.powerbi.com/view?r=eyJrIjoiMTIzNCIsImMiOjF9',
    )
  })

  it('extrae el src cuando se usan comillas simples en el iframe', () => {
    const iframeSnippet =
      "<iframe title='Reporte' src='https://app.powerbi.com/reportEmbed?reportId=abc-123' allowFullScreen></iframe>"
    assert.equal(
      extraerUrlEmbedPowerBi(iframeSnippet),
      'https://app.powerbi.com/reportEmbed?reportId=abc-123',
    )
  })

  it('soporta enlaces corporativos reportEmbed de Microsoft Fabric / Power BI', () => {
    const url = 'https://app.powerbi.com/reportEmbed?reportId=8f7e6d5c&autoAuth=true&ctid=123'
    assert.equal(extraerUrlEmbedPowerBi(url), url)
  })

  it('retorna cadena vacía para entradas nulas o vacías', () => {
    assert.equal(extraerUrlEmbedPowerBi(''), '')
    assert.equal(extraerUrlEmbedPowerBi('   '), '')
  })
})
