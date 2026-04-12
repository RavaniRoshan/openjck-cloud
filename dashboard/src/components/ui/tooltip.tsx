import * as React from "react"
import { Tooltip } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

const TooltipRoot = Tooltip.Root

const TooltipTrigger = Tooltip.Trigger

const TooltipPortal = Tooltip.Portal

const TooltipArrow = Tooltip.Arrow

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof Tooltip.Popup>,
  React.ComponentPropsWithoutRef<typeof Tooltip.Popup>
>(({ className, ...props }, ref) => (
  <TooltipPortal>
    <Tooltip.Popup
      ref={ref}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPortal>
))
TooltipContent.displayName = Tooltip.Popup.displayName

export { TooltipRoot as Tooltip, TooltipTrigger, TooltipContent, TooltipPortal, TooltipArrow }
