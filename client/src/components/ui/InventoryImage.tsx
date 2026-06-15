import { useEffect, useState } from 'react';

export const NO_INVENTORY_IMAGE = '/no-inventory-image.svg';

const InventoryImage = ({
  src,
  alt,
  className = '',
}: {
  src?: string;
  alt: string;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);
  const imageSource = src && !failed ? src : NO_INVENTORY_IMAGE;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <img
      src={imageSource}
      alt={src && !failed ? alt : 'No inventory image available'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export default InventoryImage;
