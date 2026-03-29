"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type RailImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type VerticalImageRailProps = {
  images: RailImage[];
  cycleMs?: number;
};

export default function VerticalImageRail({ images, cycleMs = 9500 }: VerticalImageRailProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length]);

  useEffect(() => {
    if (images.length < 2) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, cycleMs);

    return () => window.clearInterval(intervalId);
  }, [images.length, cycleMs]);

  const activeImage = images[activeIndex];

  if (!activeImage) {
    return <aside className="portalImageRail" aria-label="Side images" />;
  }

  return (
    <aside className="portalImageRail" aria-label="Side images">
      <Image
        key={`${activeImage.src}-${activeIndex}`}
        src={activeImage.src}
        alt={activeImage.alt}
        width={activeImage.width}
        height={activeImage.height}
        className="portalImageRailImage"
        priority
      />
    </aside>
  );
}
