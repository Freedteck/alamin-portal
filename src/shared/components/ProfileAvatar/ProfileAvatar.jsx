import React, { useState } from 'react';
import { User } from 'lucide-react';

const SIZE_CLASSES = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  '2xl': 'w-14 h-14',
};

const ICON_SIZES = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  '2xl': 24,
};

export const ProfileAvatar = ({
  src,
  name = 'Profile photo',
  size = 'sm',
  shape = 'circle',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const shapeClass = shape === 'rounded' ? 'rounded-lg' : 'rounded-full';
  const hasValidImage = Boolean(src && !hasError);

  return (
    <div
      className={`${sizeClass} ${shapeClass} shrink-0 overflow-hidden border border-[#c9c7b6] bg-[#faf8f0] flex items-center justify-center ${className}`}
      title={name}
    >
      {hasValidImage ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <User size={ICON_SIZES[size] || 14} className="text-[#616218]" />
      )}
    </div>
  );
};
