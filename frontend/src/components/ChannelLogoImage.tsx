'use client';

import { useState } from 'react';
import Image from 'next/image';

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

  const initials = alt
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
        <Image
          src={src}
          alt={alt}
          fill
          sizes="64px"
          quality={75}
          className={`object-contain ${className}`}
          onError={handleError}
        />
      )}
    </div>
  );
}
