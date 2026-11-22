import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { apiClient, trackApiActivity } from '../../lib/apiClient';

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
  const [imageSource, setImageSource] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setHasError(false);
    setImageSource('');

    if (!src) {
      setImageSource('');
      return () => {
        active = false;
      };
    }

    if (!/(?:\/api)?\/files\/download\//.test(src)) {
      setImageSource(src);
      return () => {
        active = false;
      };
    }

    const loadProtectedImage = () => trackApiActivity(async () => {
      const token = apiClient.getToken();
      const response = await fetch(apiClient.resolveUrl(src), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        throw new Error(`Profile photo request failed (${response.status}).`);
      }

      const responseBlob = await response.blob();
      const extension = src.split('?')[0].split('.').pop()?.toLowerCase();
      const imageType = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        avif: 'image/avif'
      }[extension] || responseBlob.type;
      objectUrl = URL.createObjectURL(new Blob([responseBlob], { type: imageType }));
      if (active) setImageSource(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }, { endpoint: apiClient.resolveUrl(src) });

    loadProtectedImage().catch((error) => {
      if (active) {
        console.error('Failed to load profile photo:', error);
        setHasError(true);
      }
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const shapeClass = shape === 'rounded' ? 'rounded-lg' : 'rounded-full';
  const hasValidImage = Boolean(imageSource && !hasError);

  return (
    <div
      className={`${sizeClass} ${shapeClass} shrink-0 overflow-hidden border border-[#c9c7b6] bg-[#faf8f0] flex items-center justify-center ${className}`}
      title={name}
    >
      {hasValidImage ? (
        <img
          src={imageSource}
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
