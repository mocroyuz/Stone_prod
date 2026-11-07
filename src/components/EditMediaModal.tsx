import { useEffect, useRef, useState } from "react";
import {
  X, Crop, Image as ImageIcon, RectangleHorizontal, RectangleVertical,
  Square, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Crosshair,
} from "lucide-react";

export interface EditableMediaItem {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
}

interface EditMediaModalProps {
  isOpen: boolean;
  mediaItem: EditableMediaItem | null;
  isDark: boolean;
  onClose: () => void;
  onApply: (id: string, newFile: File, newUrl: string) => void;
}

type AspectId = "freeform" | "original" | "4:3" | "16:9" | "9:16" | "1:1";
type FilterId = "original" | "vivid" | "mono" | "sepia";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_FRAC = 0.08;

const PRESET_RATIOS: Record<Exclude<AspectId, "freeform" | "original">, number> = {
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
};

const ASPECT_OPTIONS: { id: AspectId; icon: any }[] = [
  { id: "freeform", icon: Crop },
  { id: "original", icon: ImageIcon },
  { id: "4:3", icon: RectangleHorizontal },
  { id: "16:9", icon: RectangleHorizontal },
  { id: "9:16", icon: RectangleVertical },
  { id: "1:1", icon: Square },
];

const FILTER_PRESETS: { id: FilterId; css: string }[] = [
  { id: "original", css: "" },
  { id: "vivid", css: "saturate(1.45) contrast(1.12)" },
  { id: "mono", css: "grayscale(1) contrast(1.05)" },
  { id: "sepia", css: "sepia(0.65) saturate(1.1)" },
];

/* ──────────────────────────────────────────────────────────────
   Language (partagé avec Settings via localStorage)
   ────────────────────────────────────────────────────────────── */

type Lang = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "stone:language";
const LANGUAGE_CHANGED_EVENT = "stone:language-changed";

function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* stockage indisponible */
  }
  return "en";
}

function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(() => detectLanguage());

  useEffect(() => {
    const refresh = () => setLang(detectLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    };
  }, []);

  return lang;
}

/* ──────────────────────────────────────────────────────────────
   Copy (traductions du modal)
   ────────────────────────────────────────────────────────────── */

type EditCopy = {
  title: string;
  tabCrop: string;
  tabAppearance: string;
  cropTransform: string;
  aspects: Record<AspectId, { label: string; description: string }>;
  rotateFlip: string;
  straighten: string;
  center: string;
  reset: string;
  filters: string;
  filterLabels: Record<FilterId, string>;
  adjust: string;
  brightness: string;
  contrast: string;
  saturation: string;
  warmth: string;
  resetAppearance: string;
  cancel: string;
  applying: string;
  applyChanges: string;
};

const COPY: Record<Lang, EditCopy> = {
  en: {
    title: "Edit Media",
    tabCrop: "Crop",
    tabAppearance: "Appearance",
    cropTransform: "Crop & Transform",
    aspects: {
      freeform: { label: "Freeform", description: "Any size" },
      original: { label: "Original", description: "Full image" },
      "4:3": { label: "4:3", description: "Landscape" },
      "16:9": { label: "16:9", description: "Landscape" },
      "9:16": { label: "9:16", description: "Portrait" },
      "1:1": { label: "1:1", description: "Square" },
    },
    rotateFlip: "Rotate & Flip",
    straighten: "Straighten",
    center: "Center",
    reset: "Reset",
    filters: "Filters",
    filterLabels: {
      original: "Original",
      vivid: "Vivid",
      mono: "Mono",
      sepia: "Sepia",
    },
    adjust: "Adjust",
    brightness: "Brightness",
    contrast: "Contrast",
    saturation: "Saturation",
    warmth: "Warmth",
    resetAppearance: "Reset appearance",
    cancel: "Cancel",
    applying: "Applying…",
    applyChanges: "Apply Changes to 1 Item",
  },
  fr: {
    title: "Modifier le média",
    tabCrop: "Recadrer",
    tabAppearance: "Apparence",
    cropTransform: "Recadrer et transformer",
    aspects: {
      freeform: { label: "Libre", description: "Toute taille" },
      original: { label: "Original", description: "Image complète" },
      "4:3": { label: "4:3", description: "Paysage" },
      "16:9": { label: "16:9", description: "Paysage" },
      "9:16": { label: "9:16", description: "Portrait" },
      "1:1": { label: "1:1", description: "Carré" },
    },
    rotateFlip: "Pivoter et retourner",
    straighten: "Redresser",
    center: "Centrer",
    reset: "Réinitialiser",
    filters: "Filtres",
    filterLabels: {
      original: "Original",
      vivid: "Vif",
      mono: "Mono",
      sepia: "Sépia",
    },
    adjust: "Ajustements",
    brightness: "Luminosité",
    contrast: "Contraste",
    saturation: "Saturation",
    warmth: "Chaleur",
    resetAppearance: "Réinitialiser l'apparence",
    cancel: "Annuler",
    applying: "Application…",
    applyChanges: "Appliquer les modifications à 1 élément",
  },
};

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildAdjustFilter(brightness: number, contrast: number, saturation: number, warmth: number): string {
  const parts = [
    `brightness(${100 + brightness}%)`,
    `contrast(${100 + contrast}%)`,
    `saturate(${100 + saturation}%)`,
  ];
  if (warmth > 0) {
    parts.push(`sepia(${(warmth / 100) * 0.5})`);
  } else if (warmth < 0) {
    parts.push(`hue-rotate(${(warmth / 100) * 20}deg)`, `saturate(${100 + Math.abs(warmth) / 3}%)`);
  }
  return parts.join(" ");
}

/* ──────────────────────────────────────────────────────────────
   Slider bipolaire
   ────────────────────────────────────────────────────────────── */

function BipolarSlider({
  label,
  value,
  onChange,
  min = -100,
  max = 100,
  unit = "%",
  accent,
  trackColor,
  panelBg,
  textPrimary,
  textSecondary,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  accent: string;
  trackColor: string;
  panelBg: string;
  textPrimary: string;
  textSecondary: string;
  disabled?: boolean;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  const center = ((0 - min) / (max - min)) * 100;
  const lower = Math.min(center, percent);
  const upper = Math.max(center, percent);
  const gradient = `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${lower}%, ${accent} ${lower}%, ${accent} ${upper}%, ${trackColor} ${upper}%, ${trackColor} 100%)`;
  const displayValue = value > 0 ? `+${value}` : `${value}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className={["text-[13px] font-semibold", textPrimary].join(" ")}>{label}</p>
        <span className={["text-[12px]", textSecondary].join(" ")}>{displayValue}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: gradient,
          ["--thumb-border" as any]: accent,
          ["--thumb-bg" as any]: panelBg,
        }}
        className={[
          "h-[3px] w-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-40",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[color:var(--thumb-border)] [&::-webkit-slider-thumb]:bg-[color:var(--thumb-bg)] [&::-webkit-slider-thumb]:shadow-none",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[color:var(--thumb-border)] [&::-moz-range-thumb]:bg-[color:var(--thumb-bg)]",
        ].join(" ")}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Composant principal
   ────────────────────────────────────────────────────────────── */

export default function EditMediaModal({
  isOpen,
  mediaItem,
  isDark,
  onClose,
  onApply,
}: EditMediaModalProps) {
  const lang = useLanguage();
  const c = COPY[lang];

  const [tab, setTab] = useState<"crop" | "appearance">("crop");
  const [aspect, setAspect] = useState<AspectId>("freeform");
  const [rotation, setRotation] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });

  const [filterPreset, setFilterPreset] = useState<FilterId>("original");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [warmth, setWarmth] = useState(0);

  const [isApplying, setIsApplying] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen && mediaItem) {
      setTab("crop");
      setAspect("freeform");
      setRotation(0);
      setStraighten(0);
      setFlipH(false);
      setFlipV(false);
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
      setFilterPreset("original");
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
      setWarmth(0);
      setIsApplying(false);
    }
  }, [isOpen, mediaItem?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mediaItem) return null;

  const isVideo = mediaItem.kind === "video";

  const presetCss = FILTER_PRESETS.find((f) => f.id === filterPreset)?.css ?? "";
  const adjustCss = buildAdjustFilter(brightness, contrast, saturation, warmth);
  const fullFilter = [presetCss, adjustCss].filter(Boolean).join(" ");

  const naturalAspect = (): number => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return 1;
    const rot = ((rotation % 360) + 360) % 360;
    const swapped = rot === 90 || rot === 270;
    const w = swapped ? img.naturalHeight : img.naturalWidth;
    const h = swapped ? img.naturalWidth : img.naturalHeight;
    return w / h;
  };

  const getRatioValue = (): number => {
    if (aspect === "original") return naturalAspect();
    if (aspect === "freeform") return 1;
    return PRESET_RATIOS[aspect];
  };

  const applyAspectPreset = (id: AspectId) => {
    setAspect(id);
    const stage = stageRef.current;
    if (!stage) return;
    if (id === "freeform") return;
    if (id === "original") {
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
      return;
    }
    const rect = stage.getBoundingClientRect();
    const ratio = PRESET_RATIOS[id];
    const margin = 0.08;
    const maxW = 1 - margin * 2;
    const maxH = 1 - margin * 2;
    let w = maxW;
    let h = (w * rect.width) / (ratio * rect.height);
    if (h > maxH) {
      h = maxH;
      w = (h * rect.height * ratio) / rect.width;
    }
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  const startMove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...crop };

    const onMove = (ev: MouseEvent) => {
      const dxFrac = (ev.clientX - startX) / rect.width;
      const dyFrac = (ev.clientY - startY) / rect.height;
      const x = clamp(startCrop.x + dxFrac, 0, 1 - startCrop.w);
      const y = clamp(startCrop.y + dyFrac, 0, 1 - startCrop.h);
      setCrop((prev) => ({ ...prev, x, y }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResize = (handle: "n" | "s" | "e" | "w") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...crop };
    const locked = aspect !== "freeform";
    const ratio = getRatioValue();

    const wToH = (wFrac: number) => (wFrac * rect.width) / ratio / rect.height;
    const hToW = (hFrac: number) => (hFrac * rect.height * ratio) / rect.width;

    const onMove = (ev: MouseEvent) => {
      const dxFrac = (ev.clientX - startX) / rect.width;
      const dyFrac = (ev.clientY - startY) / rect.height;
      let { x, y, w, h } = startCrop;

      if (handle === "e") {
        w = clamp(startCrop.w + dxFrac, MIN_FRAC, 1 - startCrop.x);
        if (locked) {
          h = wToH(w);
          if (y + h > 1) { h = 1 - y; w = hToW(h); }
        }
      } else if (handle === "w") {
        const newX = clamp(startCrop.x + dxFrac, 0, startCrop.x + startCrop.w - MIN_FRAC);
        w = startCrop.x + startCrop.w - newX;
        x = newX;
        if (locked) {
          h = wToH(w);
          if (y + h > 1) {
            h = 1 - y;
            w = hToW(h);
            x = startCrop.x + startCrop.w - w;
          }
        }
      } else if (handle === "s") {
        h = clamp(startCrop.h + dyFrac, MIN_FRAC, 1 - startCrop.y);
        if (locked) {
          w = hToW(h);
          if (x + w > 1) { w = 1 - x; h = wToH(w); }
        }
      } else if (handle === "n") {
        const newY = clamp(startCrop.y + dyFrac, 0, startCrop.y + startCrop.h - MIN_FRAC);
        h = startCrop.y + startCrop.h - newY;
        y = newY;
        if (locked) {
          w = hToW(h);
          if (x + w > 1) {
            w = 1 - x;
            h = wToH(w);
            y = startCrop.y + startCrop.h - h;
          }
        }
      }

      setCrop({ x, y, w, h });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleCenter = () => {
    setCrop((prev) => ({ ...prev, x: (1 - prev.w) / 2, y: (1 - prev.h) / 2 }));
  };

  const handleReset = () => {
    setAspect("freeform");
    setRotation(0);
    setStraighten(0);
    setFlipH(false);
    setFlipV(false);
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
  };

  const handleResetAppearance = () => {
    setFilterPreset("original");
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setWarmth(0);
  };

  const rotateLeft = () => setRotation((r) => (r - 90 + 360) % 360);
  const rotateRight = () => setRotation((r) => (r + 90) % 360);

  const handleApply = () => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage || isVideo) return;

    setIsApplying(true);

    const finish = () => {
      const rect = stage.getBoundingClientRect();
      const natW = img.naturalWidth || rect.width;
      const natH = img.naturalHeight || rect.height;
      const stageAspect = rect.width / rect.height;
      const imgAspect = natW / natH;
      let drawW: number;
      let drawH: number;
      if (imgAspect > stageAspect) {
        drawW = rect.width;
        drawH = rect.width / imgAspect;
      } else {
        drawH = rect.height;
        drawW = rect.height * imgAspect;
      }

      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = Math.max(1, Math.round(rect.width));
      fullCanvas.height = Math.max(1, Math.round(rect.height));
      const ctx = fullCanvas.getContext("2d");
      if (!ctx) { setIsApplying(false); return; }

      ctx.filter = fullFilter || "none";
      ctx.save();
      ctx.translate(fullCanvas.width / 2, fullCanvas.height / 2);
      ctx.rotate(((rotation + straighten) * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const cropX = crop.x * fullCanvas.width;
      const cropY = crop.y * fullCanvas.height;
      const cropW = crop.w * fullCanvas.width;
      const cropH = crop.h * fullCanvas.height;

      const outCanvas = document.createElement("canvas");
      outCanvas.width = Math.max(1, Math.round(cropW));
      outCanvas.height = Math.max(1, Math.round(cropH));
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) { setIsApplying(false); return; }
      outCtx.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, outCanvas.width, outCanvas.height);

      outCanvas.toBlob((blob) => {
        setIsApplying(false);
        if (!blob || !mediaItem) return;
        const baseName = mediaItem.file.name.replace(/\.[^.]+$/, "");
        const newFile = new File([blob], `${baseName}-edited.png`, { type: "image/png" });
        const newUrl = URL.createObjectURL(newFile);
        onApply(mediaItem.id, newFile, newUrl);
      }, "image/png");
    };

    if (img.complete && img.naturalWidth > 0) {
      finish();
    } else {
      img.onload = finish;
    }
  };

  const accent = isDark ? "#ffffff" : "#111111";
  const trackColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.14)";

  const bg = isDark ? "bg-[#0e0e10]" : "bg-white";
  const panelBg = isDark ? "bg-[#151517]" : "bg-neutral-50";
  const panelBgHex = isDark ? "#151517" : "#fafafa";
  const border = isDark ? "border-white/10" : "border-black/10";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const itemHover = isDark ? "hover:bg-white/5" : "hover:bg-black/5";
  const activeBorder = isDark ? "border-white" : "border-neutral-900";
  const activeBg = isDark ? "bg-white/10" : "bg-neutral-900/5";
  const activeText = isDark ? "text-white" : "text-neutral-900";

  return (
    <div className={["fixed inset-0 z-[70] flex flex-col", bg].join(" ")}>
      {/* Header */}
      <div className={["flex shrink-0 items-center justify-between border-b px-6 py-4", border].join(" ")}>
        <h2 className={["text-[19px] font-bold", textPrimary].join(" ")}>{c.title}</h2>
        <button
          onClick={onClose}
          className={["flex h-9 w-9 items-center justify-center rounded-full transition", textSecondary, itemHover].join(" ")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Zone image / crop */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8">
          <div
            ref={stageRef}
            className="relative max-h-[640px] w-full max-w-[900px] flex-1 overflow-hidden rounded-xl bg-black/40"
          >
            {isVideo ? (
              <video src={mediaItem.url} className="h-full w-full object-contain" controls />
            ) : (
              <img
                ref={imgRef}
                src={mediaItem.url}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-contain"
                style={{
                  transform: `rotate(${rotation + straighten}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  filter: fullFilter || "none",
                }}
              />
            )}

            {!isVideo && tab === "crop" && (
              <div
                onMouseDown={startMove}
                className="absolute cursor-move border-2 border-white"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                }}
              >
                <div onMouseDown={startResize("n")} className="absolute -top-1.5 left-1/2 h-3 w-8 -translate-x-1/2 cursor-ns-resize rounded-full bg-white" />
                <div onMouseDown={startResize("s")} className="absolute -bottom-1.5 left-1/2 h-3 w-8 -translate-x-1/2 cursor-ns-resize rounded-full bg-white" />
                <div onMouseDown={startResize("w")} className="absolute -left-1.5 top-1/2 h-8 w-3 -translate-y-1/2 cursor-ew-resize rounded-full bg-white" />
                <div onMouseDown={startResize("e")} className="absolute -right-1.5 top-1/2 h-8 w-3 -translate-y-1/2 cursor-ew-resize rounded-full bg-white" />
              </div>
            )}
          </div>

          {/* Vignette */}
          <div className="flex shrink-0 items-center gap-2">
            <div className={["group relative h-14 w-14 cursor-pointer overflow-hidden rounded-lg border-2 transition", activeBorder].join(" ")}>
              {isVideo ? (
                <video src={mediaItem.url} className="h-full w-full object-cover" muted />
              ) : (
                <img src={mediaItem.url} alt="" className="h-full w-full object-cover" style={{ filter: fullFilter || "none" }} />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover:bg-black/40 group-hover:opacity-100">
                <Crop className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className={["flex w-[340px] shrink-0 flex-col overflow-y-auto border-l", border, panelBg].join(" ")}>
          <div className={["flex shrink-0 border-b", border].join(" ")}>
            <button
              onClick={() => setTab("crop")}
              className={[
                "flex-1 px-4 py-3.5 text-[14px] font-semibold transition",
                tab === "crop" ? textPrimary : textSecondary,
                tab === "crop" ? (isDark ? "border-b-2 border-white" : "border-b-2 border-neutral-900") : "",
              ].join(" ")}
            >
              {c.tabCrop}
            </button>
            <button
              onClick={() => setTab("appearance")}
              className={[
                "flex-1 px-4 py-3.5 text-[14px] font-semibold transition",
                tab === "appearance" ? textPrimary : textSecondary,
                tab === "appearance" ? (isDark ? "border-b-2 border-white" : "border-b-2 border-neutral-900") : "",
              ].join(" ")}
            >
              {c.tabAppearance}
            </button>
          </div>

          {tab === "crop" ? (
            <div className="flex flex-col gap-6 p-5">
              <div>
                <p className={["mb-3 text-[13px] font-semibold", textPrimary].join(" ")}>{c.cropTransform}</p>
                <div className="flex flex-col gap-2">
                  {ASPECT_OPTIONS.map((opt) => {
                    const isSelected = aspect === opt.id;
                    const OptIcon = opt.icon;
                    const label = c.aspects[opt.id];
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => applyAspectPreset(opt.id)}
                        disabled={isVideo}
                        className={[
                          "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                          isSelected ? `${activeBorder} ${activeBg}` : `${border} ${itemHover}`,
                        ].join(" ")}
                      >
                        <OptIcon className={["h-5 w-5 shrink-0", isSelected ? activeText : textSecondary].join(" ")} />
                        <span>
                          <span className={["block text-[13.5px] font-semibold", isSelected ? activeText : textPrimary].join(" ")}>
                            {label.label}
                          </span>
                          <span className={["block text-[12px]", textSecondary].join(" ")}>{label.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className={["mb-3 text-[13px] font-semibold", textPrimary].join(" ")}>{c.rotateFlip}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={rotateLeft}
                    disabled={isVideo}
                    className={["flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40", border, itemHover].join(" ")}
                  >
                    <RotateCcw className={["h-4.5 w-4.5", textPrimary].join(" ")} />
                  </button>
                  <button
                    onClick={rotateRight}
                    disabled={isVideo}
                    className={["flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40", border, itemHover].join(" ")}
                  >
                    <RotateCw className={["h-4.5 w-4.5", textPrimary].join(" ")} />
                  </button>
                  <button
                    onClick={() => setFlipH((v) => !v)}
                    disabled={isVideo}
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40",
                      flipH ? `${activeBorder} ${activeBg}` : border,
                      itemHover,
                    ].join(" ")}
                  >
                    <FlipHorizontal className={["h-4.5 w-4.5", flipH ? activeText : textPrimary].join(" ")} />
                  </button>
                  <button
                    onClick={() => setFlipV((v) => !v)}
                    disabled={isVideo}
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40",
                      flipV ? `${activeBorder} ${activeBg}` : border,
                      itemHover,
                    ].join(" ")}
                  >
                    <FlipVertical className={["h-4.5 w-4.5", flipV ? activeText : textPrimary].join(" ")} />
                  </button>
                </div>
              </div>

              <BipolarSlider
                label={c.straighten}
                value={straighten}
                onChange={setStraighten}
                min={-45}
                max={45}
                unit="°"
                accent={accent}
                trackColor={trackColor}
                panelBg={panelBgHex}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                disabled={isVideo}
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCenter}
                  disabled={isVideo}
                  className={["flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40", border, textPrimary, itemHover].join(" ")}
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  {c.center}
                </button>
                <button
                  onClick={handleReset}
                  className={["flex flex-1 items-center justify-center rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition", border, textPrimary, itemHover].join(" ")}
                >
                  {c.reset}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 p-5">
              <div>
                <p className={["mb-3 text-[15px] font-bold", textPrimary].join(" ")}>{c.filters}</p>
                <div className={["flex gap-0 overflow-hidden rounded-xl border", border].join(" ")}>
                  {FILTER_PRESETS.map((f, idx) => {
                    const isSelected = filterPreset === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterPreset(f.id)}
                        disabled={isVideo}
                        className={[
                          "flex flex-1 flex-col items-center gap-2 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-40",
                          idx !== 0 ? `border-l ${border}` : "",
                          isSelected ? activeBg : itemHover,
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "h-14 w-14 overflow-hidden rounded-lg border-2 transition",
                            isSelected ? activeBorder : "border-transparent",
                          ].join(" ")}
                        >
                          <img
                            src={mediaItem.url}
                            alt={c.filterLabels[f.id]}
                            className="h-full w-full object-cover"
                            style={{ filter: f.css || "none" }}
                          />
                        </div>
                        <span className={["text-[11.5px] font-semibold", isSelected ? activeText : textSecondary].join(" ")}>
                          {c.filterLabels[f.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className={["mb-4 text-[15px] font-bold", textPrimary].join(" ")}>{c.adjust}</p>
                <div className="flex flex-col gap-5">
                  <BipolarSlider
                    label={c.brightness}
                    value={brightness}
                    onChange={setBrightness}
                    accent={accent}
                    trackColor={trackColor}
                    panelBg={panelBgHex}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    disabled={isVideo}
                  />
                  <BipolarSlider
                    label={c.contrast}
                    value={contrast}
                    onChange={setContrast}
                    accent={accent}
                    trackColor={trackColor}
                    panelBg={panelBgHex}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    disabled={isVideo}
                  />
                  <BipolarSlider
                    label={c.saturation}
                    value={saturation}
                    onChange={setSaturation}
                    accent={accent}
                    trackColor={trackColor}
                    panelBg={panelBgHex}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    disabled={isVideo}
                  />
                  <BipolarSlider
                    label={c.warmth}
                    value={warmth}
                    onChange={setWarmth}
                    accent={accent}
                    trackColor={trackColor}
                    panelBg={panelBgHex}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    disabled={isVideo}
                  />
                </div>
              </div>

              <button
                onClick={handleResetAppearance}
                className={["self-start rounded-xl border px-3 py-2 text-[13px] font-semibold transition", border, textPrimary, itemHover].join(" ")}
              >
                {c.resetAppearance}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={["flex shrink-0 items-center justify-between border-t px-6 py-4", border].join(" ")}>
        <button
          onClick={onClose}
          className={["rounded-xl px-4 py-2.5 text-[14px] font-semibold transition", textSecondary, itemHover].join(" ")}
        >
          {c.cancel}
        </button>
        <button
          onClick={handleApply}
          disabled={isApplying || isVideo}
          className={[
            "rounded-xl px-5 py-2.5 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
            isDark ? "bg-white text-[#141416] hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800",
          ].join(" ")}
        >
          {isApplying ? c.applying : c.applyChanges}
        </button>
      </div>
    </div>
  );
}