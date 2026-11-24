import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialog, useEscapeLayer } from "./useDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Dialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog({ open, onClose, ref });
  if (!open) return null;
  return (
    <div ref={ref} tabIndex={-1} role="dialog" id={id}>
      <button id={`${id}-a`}>a</button>
      <button id={`${id}-b`}>b</button>
    </div>
  );
}

function Popover({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEscapeLayer(open, onClose);
  return null;
}

const press = (key: string, shiftKey = false) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));

describe("useDialog", () => {
  let host: HTMLElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    document.body.style.overflow = "";
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("verrouille le scroll, piège le focus, restaure le focus", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const close = vi.fn();
    act(() => root.render(<Dialog id="x" open onClose={close} />));
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement?.id).toBe("x-a");
    (document.getElementById("x-b") as HTMLElement).focus();
    act(() => press("Tab"));
    expect(document.activeElement?.id).toBe("x-a");
    act(() => press("Tab", true));
    expect(document.activeElement?.id).toBe("x-b");
    act(() => press("Escape"));
    expect(close).toHaveBeenCalledTimes(1);
    act(() => root.render(<Dialog id="x" open={false} onClose={close} />));
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("Échap ne ferme que la modale du dessus et le scroll reste bloqué jusqu'à la dernière", () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    act(() =>
      root.render(
        <>
          <Dialog id="a" open onClose={closeA} />
          <Dialog id="b" open onClose={closeB} />
        </>
      )
    );
    act(() => press("Escape"));
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
    // A se ferme avant B (ordre inversé) : la page reste bloquée par B.
    act(() =>
      root.render(
        <>
          <Dialog id="a" open={false} onClose={closeA} />
          <Dialog id="b" open onClose={closeB} />
        </>
      )
    );
    expect(document.body.style.overflow).toBe("hidden");
    act(() =>
      root.render(
        <>
          <Dialog id="a" open={false} onClose={closeA} />
          <Dialog id="b" open={false} onClose={closeB} />
        </>
      )
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("un popover (useEscapeLayer) absorbe Échap avant la modale", () => {
    const closeDialog = vi.fn();
    const closePopover = vi.fn();
    act(() =>
      root.render(
        <>
          <Dialog id="d" open onClose={closeDialog} />
          <Popover open onClose={closePopover} />
        </>
      )
    );
    act(() => press("Escape"));
    expect(closePopover).toHaveBeenCalledTimes(1);
    expect(closeDialog).not.toHaveBeenCalled();
  });
});
