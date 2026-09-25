/** Pilha de camadas (Esc fecha só a do topo) e trava de rolagem do body. */
const layers: symbol[] = [];
let locks = 0;
let previousOverflow = '';

export function pushLayer(): symbol {
  const id = Symbol('layer');
  layers.push(id);
  return id;
}

export function popLayer(id: symbol): void {
  const i = layers.lastIndexOf(id);
  if (i >= 0) layers.splice(i, 1);
}

export function isTopLayer(id: symbol): boolean {
  return layers[layers.length - 1] === id;
}

export function lockScroll(): void {
  if (typeof document === 'undefined') return;
  if (locks++ === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return;
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.body.style.overflow = previousOverflow;
}
