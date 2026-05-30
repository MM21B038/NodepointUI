"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import {
  directoryActiveBadgeClass,
  directoryCardActionClusterClass,
  directoryCardBodyClass,
  directoryCardHeaderClass,
  directoryCardStripeClass,
  directoryCardSurfaceClass,
  directoryDeleteButtonClass,
  directoryDescriptionClass,
  directoryDescriptionPanelClass,
  directoryIconWrapClass,
  directoryTagClass,
  type DirectoryCardAccent,
} from "@/components/directory/directoryCardStyles";
import { metaDescription, metaTagLabel } from "@/lib/resourceMeta";

interface DirectoryCardFrameProps {
  accent: DirectoryCardAccent;
  name: string;
  tag?: string | null;
  description?: string | null;
  isActive: boolean;
  isSelected?: boolean;
  showSelection?: boolean;
  isDeleting?: boolean;
  isDisabled?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  isThisDeleting?: boolean;
  onSelectionChange?: (checked: boolean) => void;
  icon: ReactNode;
  activeLabel?: string;
  tagClassName?: string;
  footer?: ReactNode;
  children?: ReactNode;
}

export function DirectoryCardFrame({
  accent,
  name,
  tag,
  description,
  isActive,
  isSelected = false,
  showSelection = false,
  isDeleting = false,
  isDisabled = false,
  onSelect,
  onDelete,
  isThisDeleting = false,
  onSelectionChange,
  icon,
  activeLabel = "Active",
  tagClassName,
  footer,
  children,
}: DirectoryCardFrameProps) {
  const tagLabel = metaTagLabel({ tag });
  const descriptionText = metaDescription({ description });
  const showDelete = Boolean(onDelete);
  const showActions = Boolean(tagLabel || showDelete);

  return (
    <article
      className={directoryCardSurfaceClass({
        accent,
        isActive,
        isSelected,
      })}
      onClick={onSelect}
    >
      <div
        className={directoryCardStripeClass(accent, isActive)}
        aria-hidden
      />

      <header className={directoryCardHeaderClass()}>
        <div className="flex items-start gap-3">
          {showSelection && onSelectionChange && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange(checked === true)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Select ${name}`}
              disabled={isDisabled || isDeleting}
              className="mt-2 shrink-0"
            />
          )}

          <div className={directoryIconWrapClass(accent, isActive)}>{icon}</div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <h3
                  className={cn(
                    "truncate text-base font-semibold tracking-tight",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                  title={name}
                >
                  {name}
                </h3>
                {isActive ? (
                  <span className={directoryActiveBadgeClass()}>
                    <CheckCircle2 className="h-3 w-3" />
                    {activeLabel}
                  </span>
                ) : null}
              </div>

              {showActions ? (
                <div className={directoryCardActionClusterClass()}>
                  {tagLabel ? (
                    <span
                      className={directoryTagClass(accent, tagClassName)}
                      title={tagLabel}
                    >
                      <Tag className="h-2.5 w-2.5 shrink-0 opacity-75" />
                      <span className="truncate">{tagLabel}</span>
                    </span>
                  ) : null}
                  {showDelete && onDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      disabled={isDisabled || isDeleting}
                      aria-label={`Delete ${name}`}
                      className={directoryDeleteButtonClass(
                        isThisDeleting || false
                      )}
                    >
                      {isThisDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {descriptionText ? (
          <p
            className={cn(
              directoryDescriptionPanelClass(accent),
              directoryDescriptionClass()
            )}
            title={descriptionText}
          >
            {descriptionText}
          </p>
        ) : null}
      </header>

      <div className={directoryCardBodyClass()}>
        {children ? <div className="shrink-0">{children}</div> : null}
        {footer ? <div className={cn(children ? "pt-1" : "mt-auto")}>{footer}</div> : null}
      </div>
    </article>
  );
}
