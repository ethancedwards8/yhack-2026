import Image from "next/image";

type RailImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type VerticalImageRailProps = {
  images: RailImage[];
};

export default function VerticalImageRail({ images }: VerticalImageRailProps) {
  return (
    <aside className="portalImageRail" aria-label="Side images">
      {images.map((image) => (
        <Image
          key={`${image.src}-${image.alt}`}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className="portalImageRailImage"
          priority
        />
      ))}
    </aside>
  );
}
