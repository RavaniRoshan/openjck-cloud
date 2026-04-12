import * as React from "react"
import { ScrollArea } from "@base-ui/react/scroll-area"
import { cn } from "@/lib/utils"

const ScrollAreaRoot = React.forwardRef<
  React.ElementRef<typeof ScrollArea.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollArea.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollArea.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollArea.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollArea.Viewport>
    <ScrollBar />
    <ScrollArea.Corner />
  </ScrollArea.Root>
))
ScrollAreaRoot.displayName = "ScrollArea"

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollArea.Scrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollArea.Scrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollArea.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollArea.Thumb className="relative flex-1 rounded-full bg-border" />
  </ScrollArea.Scrollbar>
))
ScrollBar.displayName = "ScrollAreaScrollbar"

export { ScrollAreaRoot as ScrollArea, ScrollBar }
