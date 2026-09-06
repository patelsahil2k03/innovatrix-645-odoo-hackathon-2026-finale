"use client";

/**
 * Inline "ⓘ" affordance for explaining a field or section without permanently
 * taking up layout space. Shows on hover and on keyboard focus (CSS only, no
 * click-state) so it works the same for mouse and keyboard users.
 */

import { useId } from "react";

interface InfoTooltipProps {
  text: string;
  label?: string;
}

export function InfoTooltip({ text, label = "More info" }: InfoTooltipProps) {
  const id = useId();

  return (
    <span className="info-tooltip">
      <button type="button" className="info-tooltip-trigger" aria-describedby={id} aria-label={label}>
        i
      </button>
      <span role="tooltip" id={id} className="info-tooltip-panel">
        {text}
      </span>
    </span>
  );
}
