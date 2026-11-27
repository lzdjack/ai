// <ScrollArea> (01 §2.6): zero-width overlay scrollbar on Radix ScrollArea; the native bar is hidden,
// the 5px thumb fades in on hover or scroll (180ms) and out 800ms after.
import * as Radix from '@radix-ui/react-scroll-area';
import type { CSSProperties, ReactNode } from 'react';

export function ScrollArea(p: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  viewportClassName?: string;
  viewportStyle?: CSSProperties;
}) {
  return (
    <Radix.Root
      type="hover"
      scrollHideDelay={800}
      className={`cc-scroll ${p.className ?? ''}`}
      style={p.style}
    >
      <Radix.Viewport
        className={`scroll-viewport ${p.viewportClassName ?? ''}`}
        style={p.viewportStyle}
      >
        {p.children}
      </Radix.Viewport>
      <Radix.Scrollbar orientation="vertical" className="cc-scrollbar">
        <Radix.Thumb className="scroll-thumb" />
      </Radix.Scrollbar>
    </Radix.Root>
  );
}
