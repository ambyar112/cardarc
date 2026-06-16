import { useState, useRef, useEffect } from 'react'

/**
 * LazyImage — performant image component with:
 * - Native lazy loading (loading="lazy")
 * - Async decoding (decoding="async")
 * - IntersectionObserver fallback for older browsers
 * - Smooth fade-in opacity transition (no layout shift)
 * - Fixed aspect ratio to prevent CLS
 * - Error fallback handling
 */
export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
  sizes = '(max-width: 640px) 240px, (max-width: 1024px) 350px, 400px',
  priority = false,
  onLoad,
  ...rest
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [inView, setInView] = useState(priority)
  const imgRef = useRef(null)

  useEffect(() => {
    if (priority || inView) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin: '200px', threshold: 0.01 }
    )

    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [priority, inView])

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
        background: 'rgba(255,255,255,0.04)',
        ...style,
      }}
    >
      {inView && !error && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => {
            setLoaded(true)
            onLoad?.()
          }}
          onError={() => setError(true)}
          className="w-full h-full object-contain p-3"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          {...rest}
        />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-cyan-400/40">
          {alt || 'Image unavailable'}
        </div>
      )}
    </div>
  )
}