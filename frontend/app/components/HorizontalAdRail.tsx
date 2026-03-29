"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type AdImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type HorizontalAdRailProps = {
  images: AdImage[];
  cycleMs?: number;
};

export default function HorizontalAdRail({ images, cycleMs = 12000 }: HorizontalAdRailProps) {
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

  return (
    <div className="y2kLonelyReposWrap" aria-label="Rotating banner ad">
      {activeImage ? (
        <Image
          key={`${activeImage.src}-${activeIndex}`}
          src={activeImage.src}
          alt={activeImage.alt}
          width={activeImage.width}
          height={activeImage.height}
          className="y2kLonelyReposImage"
          priority
        />
      ) : null}
    </div>
  );
}
