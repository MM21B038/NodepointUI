"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GRID_GAP_PX = 12;
const GRID_PADDING_PX = 16;
const CARD_EST_HEIGHT_PX = 310;
const MIN_PAGE_SIZE = 4;
const MAX_PAGE_SIZE = 100;
const RESIZE_DEBOUNCE_MS = 150;

function getColumnsForWidth(width: number): number {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

function computePageSize(width: number, height: number): number {
  const cols = getColumnsForWidth(width);
  const usableHeight = Math.max(0, height - GRID_PADDING_PX * 2);
  const rowUnit = CARD_EST_HEIGHT_PX + GRID_GAP_PX;
  const rows = Math.max(1, Math.floor((usableHeight + GRID_GAP_PX) / rowUnit));
  const size = cols * rows;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, size));
}

export function useWorkspaceGridPageSize() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(MIN_PAGE_SIZE);
  const [columns, setColumns] = useState(1);

  const measure = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;

    const { width, height } = el.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const cols = getColumnsForWidth(width);
    const next = computePageSize(width, height);
    setColumns(cols);
    setPageSize((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleMeasure = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        measure();
      }, RESIZE_DEBOUNCE_MS);
    };

    measure();

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(el);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, [measure]);

  return { gridRef, pageSize, columns };
}
