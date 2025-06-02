
import * as React from "react"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerProps {
  mode: "single"
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  initialFocus?: boolean
}

export function DatePicker({ 
  mode, 
  selected, 
  onSelect, 
  disabled, 
  initialFocus 
}: DatePickerProps) {
  return (
    <Calendar
      mode={mode}
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      initialFocus={initialFocus}
      className="rounded-md border"
    />
  )
}
