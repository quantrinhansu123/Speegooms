"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function RequirementImageSlider({ images, showTitle = true }: { images: string[]; showTitle?: boolean }) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, images.length - 1);

  if (images.length === 0) return null;

  const previous = () => setIndex(Math.max(0, current - 1));
  const next = () => setIndex(Math.min(images.length - 1, current + 1));
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowLeft") previous();
      else next();
    }
  };

  const controls = (
    <div className="flex items-center justify-center gap-4">
      <Button type="button" variant="outline" size="icon" aria-label="Ảnh trước" disabled={current === 0} onClick={previous}>
        <ChevronLeft aria-hidden />
      </Button>
      <span className="min-w-16 text-center text-sm tabular-nums" aria-live="polite" aria-atomic="true">
        {current + 1} / {images.length}
      </span>
      <Button type="button" variant="outline" size="icon" aria-label="Ảnh tiếp theo" disabled={current === images.length - 1} onClick={next}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );

  return (
    <Dialog>
      <section aria-label="Ảnh yêu cầu" aria-roledescription="trình chiếu" onKeyDown={onKeyDown} className="space-y-3">
        {showTitle ? <p className="text-sm font-medium">Ảnh yêu cầu</p> : null}
        <DialogTrigger
          type="button"
          aria-label={`Phóng to ảnh yêu cầu ${current + 1}`}
          className="group relative flex h-[clamp(10rem,32dvh,20rem)] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Uploaded images may use external URLs or data URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[current]} alt={`Ảnh yêu cầu ${current + 1}`} className="h-full w-full object-contain" />
          <span className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 text-xs text-white">
            <Expand aria-hidden className="size-3.5" /> Phóng to
          </span>
        </DialogTrigger>
        {controls}
      </section>
      <DialogContent onKeyDown={onKeyDown} className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col rounded-none p-4 sm:max-w-none">
        <DialogTitle className="pr-8">Ảnh yêu cầu</DialogTitle>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[current]} alt={`Ảnh yêu cầu ${current + 1}`} className="h-full w-full object-contain" />
        </div>
        {controls}
      </DialogContent>
    </Dialog>
  );
}
