import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, {
  PixelCrop,
  PercentCrop,
  convertToPixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type ImageCropResult = {
  crop: PixelCrop;
  image: HTMLImageElement;
};

type ImageCropDialogProps = {
  title: string;
  imageSrc: string;
  isOpen: boolean;
  aspect: number;
  onClose: () => void;
  onApply: (result: ImageCropResult) => void | Promise<void>;
  onCancel?: () => void;
  getInitialCrop?: (image: HTMLImageElement) => PercentCrop;
  circular?: boolean;
  minWidth?: number;
  minHeight?: number;
  keepSelection?: boolean;
  ruleOfThirds?: boolean;
};

const ImageCropDialog: React.FC<ImageCropDialogProps> = React.memo(
  ({
    title,
    imageSrc,
    isOpen,
    aspect,
    onClose,
    onApply,
    onCancel,
    getInitialCrop,
    circular,
    minWidth,
    minHeight,
    keepSelection,
    ruleOfThirds,
  }) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [crop, setCrop] = useState<PercentCrop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

    useEffect(() => {
      if (!isOpen) {
        setCrop(undefined);
        setCompletedCrop(undefined);
      }
    }, [isOpen]);

    useEffect(() => {
      if (isOpen) {
        setCrop(undefined);
        setCompletedCrop(undefined);
      }
    }, [imageSrc, isOpen]);

    const handleImageLoad = useCallback(
      (event: React.SyntheticEvent<HTMLImageElement>) => {
        const image = event.currentTarget;
        imgRef.current = image;
        if (getInitialCrop) {
          const initialCrop = getInitialCrop(image);
          setCrop(initialCrop);
          if (initialCrop.width && initialCrop.height) {
            setCompletedCrop(
              convertToPixelCrop(
                initialCrop,
                image.naturalWidth,
                image.naturalHeight
              )
            );
          }
        }
      },
      [getInitialCrop]
    );

    useEffect(() => {
      if (imgRef.current && crop?.width && crop?.height) {
        setCompletedCrop(
          convertToPixelCrop(
            crop,
            imgRef.current.naturalWidth,
            imgRef.current.naturalHeight
          )
        );
      }
    }, [crop]);

    const handleApply = useCallback(async () => {
      if (!imgRef.current || !completedCrop?.width || !completedCrop?.height) {
        return;
      }

      await Promise.resolve(
        onApply({ crop: completedCrop, image: imgRef.current })
      );
      onClose();
    }, [completedCrop, onApply, onClose]);

    const handleCancel = useCallback(() => {
      if (onCancel) {
        onCancel();
      } else {
        onClose();
      }
    }, [onCancel, onClose]);

    if (!isOpen) {
      return null;
    }

    return (
      <dialog className="modal modal-open">
        <div className="modal-box max-w-4xl">
          <h3 className="font-bold text-lg mb-4">{title}</h3>
          <div className="flex justify-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              aspect={aspect}
              minWidth={minWidth}
              minHeight={minHeight}
              keepSelection={keepSelection}
              ruleOfThirds={ruleOfThirds}
              circularCrop={circular}
            >
              <img
                src={imageSrc}
                alt={title}
                onLoad={handleImageLoad}
                className="max-h-96"
              />
            </ReactCrop>
          </div>
          <div className="modal-action">
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={!completedCrop?.width || !completedCrop?.height}
            >
              Apply Crop
            </button>
            <button className="btn btn-outline" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      </dialog>
    );
  }
);

ImageCropDialog.displayName = 'ImageCropDialog';

export type { ImageCropDialogProps, ImageCropResult };
export default ImageCropDialog;
