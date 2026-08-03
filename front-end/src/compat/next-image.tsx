import {
  forwardRef,
  type CSSProperties,
  type ImgHTMLAttributes,
} from 'react'

type ImageSource = string | { src: string }

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: ImageSource
  alt: string
  fill?: boolean
  priority?: boolean
  quality?: number
}

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
    alt,
    fill = false,
    priority = false,
    quality: _quality,
    style,
    loading,
    ...props
  },
  ref,
) {
  const resolvedSrc = typeof src === 'string' ? src : src.src
  const fillStyle: CSSProperties | undefined = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        ...style,
      }
    : style

  return (
    <img
      ref={ref}
      src={resolvedSrc}
      alt={alt}
      style={fillStyle}
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      fetchPriority={priority ? 'high' : undefined}
      {...props}
    />
  )
})

export default Image
