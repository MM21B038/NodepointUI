import * as React from "react";
import { PANEL_TRANSITION_MS } from "@/hooks/useCitationLayoutMode";

/** Drives width/opacity CSS transitions when the citation side panel opens or closes. */
export function useCitationPanelTransition(
  panelOpen: boolean,
  rowRef: React.RefObject<HTMLElement | null>
) {
  const [expanded, setExpanded] = React.useState(false);
  const [visible, setVisible] = React.useState(panelOpen);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (panelOpen) {
      setVisible(true);
      if (reduceMotion) {
        setExpanded(true);
        return;
      }
      setExpanded(false);
      const frame = requestAnimationFrame(() => {
        rowRef.current?.getBoundingClientRect();
        requestAnimationFrame(() => setExpanded(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    if (reduceMotion) {
      setExpanded(false);
      setVisible(false);
      return;
    }

    setExpanded(false);
    const timer = window.setTimeout(() => setVisible(false), PANEL_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [panelOpen, rowRef]);

  return { expanded, visible };
}
