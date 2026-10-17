import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { ProjectSheet } from '../../../content/types';
import { cx } from '../../../utils/cx';
import style from './SheetViewer.module.css';

type SheetViewerProps = {
  sheets: ProjectSheet[];
  selectedId?: string | null;
  onSelect?: (elementId: string | null) => void;
};

const ATTR = 'data-element-id';
const SELECTED_CLASS = 'sheetSelected';

const findElementId = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const node = target.closest(`[${ATTR}]`);
  if (!node) return null;
  return node.getAttribute(ATTR);
};

const SheetViewer = ({ sheets, selectedId = null, onSelect }: SheetViewerProps) => {
  const [activeId, setActiveId] = useState(sheets[0]?.id ?? '');
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [panning, setPanning] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const didPanRef = useRef(false);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const activeSheet = sheets.find((s) => s.id === activeId) ?? sheets[0];

  useEffect(() => {
    if (!sheets.length) return;
    if (!sheets.some((s) => s.id === activeId)) {
      setActiveId(sheets[0].id);
    }
  }, [sheets, activeId]);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    const img = imgRef.current;
    if (!viewport || !img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const pad = 16;
    const next = Math.min(
      (viewport.clientWidth - pad) / iw,
      (viewport.clientHeight - pad) / ih,
      2,
    );
    const s = Math.max(0.05, next);
    setScale(s);
    setTx((viewport.clientWidth - iw * s) / 2);
    setTy((viewport.clientHeight - ih * s) / 2);
  }, []);

  useEffect(() => {
    if (!activeSheet?.imageUrl || !activeSheet?.svgUrl) {
      setSvgMarkup(null);
      setImageReady(false);
      setLoadError(
        !activeSheet?.imageUrl || !activeSheet?.svgUrl
          ? 'У листа нет imageUrl / svgUrl'
          : null,
      );
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setImageReady(false);
    setSvgMarkup(null);
    setScale(1);
    setTx(0);
    setTy(0);

    fetch(activeSheet.svgUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`SVG HTTP ${res.status}`);
        const text = await res.text();
        if (!text.includes('<svg')) throw new Error('Ответ не похож на SVG');
        if (!cancelled) {
          setSvgMarkup(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSvgMarkup(null);
          setLoading(false);
          setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки SVG');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSheet?.imageUrl, activeSheet?.svgUrl]);

  useEffect(() => {
    const host = overlayRef.current;
    if (!host) return;
    host.querySelectorAll(`.${SELECTED_CLASS}`).forEach((el) => {
      el.classList.remove(SELECTED_CLASS);
    });
    if (!selectedId) return;
    host.querySelectorAll(`[${ATTR}="${CSS.escape(selectedId)}"]`).forEach((el) => {
      el.classList.add(SELECTED_CLASS);
    });
  }, [selectedId, svgMarkup]);

  useEffect(() => {
    if (!imageReady) return;
    fitToView();
  }, [imageReady, activeSheet?.id, fitToView]);

  const onViewportClick = useCallback((event: MouseEvent) => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    const id = findElementId(event.target);
    onSelectRef.current?.(id);
  }, []);

  // React вешает wheel как passive — preventDefault там не работает.
  // Нативный listener с { passive: false }, чтобы зум не скроллил страницу.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = viewport.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;

      setScale((prev) => {
        const next = Math.min(8, Math.max(0.08, prev * factor));
        const ratio = next / prev;
        setTx((t) => mx - (mx - t) * ratio);
        setTy((t) => my - (my - t) * ratio);
        return next;
      });
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [loading, loadError, activeSheet?.imageUrl]);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      if (target?.closest?.(`[${ATTR}]`)) return;
      didPanRef.current = false;
      dragRef.current = { x: event.clientX, y: event.clientY, tx, ty };
      setPanning(true);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [tx, ty],
  );

  const onPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPanRef.current = true;
    setTx(drag.tx + dx);
    setTy(drag.ty + dy);
  }, []);

  const endPan = useCallback((_event: PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPanning(false);
  }, []);

  if (!sheets.length) return null;

  const sheetLabel = (sheet: ProjectSheet) => {
    const layerTag =
      sheet.layer === 'tx' ? 'ТХ' : sheet.layer === 'kr' ? 'КР' : null;
    const base = sheet.number ? `${sheet.number} · ${sheet.title}` : sheet.title;
    return layerTag ? `${layerTag} · ${base}` : base;
  };

  return (
    <div className={style.root}>
      {sheets.length > 1 && (
        <div className={style.tabs} role="tablist" aria-label="Листы">
          {sheets.map((sheet) => {
            const active = sheet.id === activeSheet?.id;
            return (
              <button
                key={sheet.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cx(style.tab, active && style.tabActive)}
                onClick={() => setActiveId(sheet.id)}
              >
                {sheetLabel(sheet)}
              </button>
            );
          })}
        </div>
      )}

      <div className={style.toolbar}>
        {sheets.length === 1 && activeSheet && (
          <span className={style.hint}>{sheetLabel(activeSheet)}</span>
        )}
        <button type="button" className={style.toolBtn} onClick={fitToView}>
          Вписать
        </button>
        <span className={style.hint}>Колёсико — масштаб, перетаскивание — панорама</span>
      </div>

      {loading && <div className={style.status}>Загрузка листа…</div>}
      {loadError && (
        <div className={cx(style.status, style.error)}>Лист: {loadError}</div>
      )}
      {!loading && !loadError && activeSheet?.imageUrl && (
        <div
          ref={viewportRef}
          className={cx(style.viewport, panning && style.viewportPanning)}
          onClick={onViewportClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div
            ref={stageRef}
            className={style.stage}
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          >
            <div className={style.stack}>
              <img
                ref={imgRef}
                className={style.sheetImage}
                src={activeSheet.imageUrl}
                alt={activeSheet.title}
                draggable={false}
                onLoad={() => setImageReady(true)}
                onError={() =>
                  setLoadError(`Не удалось загрузить ${activeSheet.imageUrl}`)
                }
              />
              {svgMarkup && (
                <div
                  ref={overlayRef}
                  className={style.svgOverlay}
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SheetViewer;
