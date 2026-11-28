// Thin wrappers over tokens/components.css (.cc-*) and tokens/theme.css shell classes; no styles of
// their own beyond layout passed in by the caller.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type BtnVariant = 'pri' | 'sec' | 'red' | 'ok' | 'ghost' | 'glass';
export function Button({
  variant = 'sec',
  size,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'xs' | 'sm' | 'lg' }) {
  return (
    <button
      type="button"
      className={`cc-btn cc-btn-${variant}${size ? ` cc-btn-${size}` : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
}

/** Segmented control (.cc-seg). */
export function Seg<K extends string>(p: {
  items: { key: K; label: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
  size?: 'xs' | 'sm' | 'lg';
}) {
  return (
    <div className={`cc-seg${p.size ? ` cc-seg-${p.size}` : ''}`} role="tablist">
      {p.items.map((i) => (
        <span
          key={i.key}
          role="tab"
          aria-selected={p.value === i.key}
          className={p.value === i.key ? 'on' : undefined}
          onClick={() => p.onChange(i.key)}
        >
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Panel tabs (.tab2): core tabs plus enabled extension tabs. */
export function Tabs<K extends string>(p: {
  items: { key: K; label: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="tab2" role="tablist">
      {p.items.map((i) => (
        <span
          key={i.key}
          role="tab"
          aria-selected={p.value === i.key}
          className={p.value === i.key ? 'on' : undefined}
          onClick={() => p.onChange(i.key)}
        >
          {i.label}
        </span>
      ))}
    </div>
  );
}

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'teal';
export const Pill = (p: { tone: Tone; children: ReactNode; style?: CSSProperties }) => (
  <span className={`pill p-${p.tone}`} style={{ flex: 'none', ...p.style }}>
    {p.children}
  </span>
);

export const Card = (p: { children: ReactNode; style?: CSSProperties; className?: string }) => (
  <div className={`card${p.className ? ` ${p.className}` : ''}`} style={p.style}>
    {p.children}
  </div>
);

/** One of eight soft gradients, picked from the name so a person keeps their colour. */
export function avatarTone(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 6;
}

export function Avatar(p: {
  name: string;
  label: string;
  size?: number;
  /** fixed tone index, or 'sys' for system accounts */
  tone?: number | 'sys';
  fontSize?: number;
  className?: string;
}) {
  const tone = p.tone ?? avatarTone(p.name);
  const size = p.size ?? 24;
  return (
    <span
      className={`av cc-av-${tone}${p.className ? ` ${p.className}` : ''}`}
      title={p.name}
      style={{ width: size, height: size, fontSize: p.fontSize ?? 11 }}
    >
      {p.label}
    </span>
  );
}
