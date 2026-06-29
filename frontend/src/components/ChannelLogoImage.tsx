'use client';

import { useState, useRef, useEffect } from 'react';

interface ChannelLogoImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  containerClassName?: string;
}

export default function ChannelLogoImage({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  containerClassName = '',
}: ChannelLogoImageProps) {
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const initials = alt
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    // If the image already completed loading and failed, set error state
    if (img.complete && img.naturalWidth === 0) {
      setError(true);
    }
  }, [src]);

  const handleError = () => {
    setError(true);
  };

  return (
    <div className={`relative flex items-center justify-center ${containerClassName}`}>
      {/* Always show initials as the fallback */}
      {(error || !src) && (
        <span className={`font-bold text-white/40 ${fallbackClassName}`}>
          {initials}
        </span>
      )}
      {/* Show image when src exists and no error */}
      {src && !error && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={className}
          onError={handleError}
        />
      )}
    </div>
  );
}
