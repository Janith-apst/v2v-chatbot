import * as React from "react"

import { cn } from "@/lib/utils"

type VisuallyHiddenProps<T extends React.ElementType> = {
  as?: T
  className?: string
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className">

export function VisuallyHidden<T extends React.ElementType = "span">({
  as,
  className,
  ...rest
}: VisuallyHiddenProps<T>) {
  const Component = (as ?? "span") as React.ElementType
  return <Component className={cn("sr-only", className)} {...rest} />
}
