import { useEffect, useState } from 'react';

import { getDisplayImageUrls } from '../../utils/googleDriveImage';

export const NO_INVENTORY_IMAGE = '/no-inventory-image.svg';

const InventoryImage = ({
  src,
  alt,
  className = '',
  displaySize = 1600,
}: {
  src?: string;
  alt: string;
  className?: string;
  displaySize?: number;
}) => {
  const [sourceIndex, setSourceIndex] = useState(0);
  const imageSources = getDisplayImageUrls(src, displaySize);
  const imageSource = imageSources[sourceIndex] || NO_INVENTORY_IMAGE;
  const hasImageSource = Boolean(imageSources[sourceIndex]);

  useEffect(() => {
    setSourceIndex(0);
  }, [displaySize, src]);

  return (
    <img
      src={imageSource}
      alt={hasImageSource ? alt : 'No inventory image available'}
      onError={() => setSourceIndex((current) => current + 1)}
      className={className}
    />
  );
};

export default InventoryImage;
