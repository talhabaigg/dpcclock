"use client"

import * as React from "react"
import { format } from "date-fns"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date
  onChange: (date?: Date) => void
  className?: string
  placeholder?: string
  fromDate?: Date
  disabled?: (date: Date) => boolean
  displayFormat?: string
}

export function DatePickerDemo({
  value,
  onChange,
  className,
  placeholder = "Pick a date",
  fromDate,
  disabled,
  displayFormat = "PPP",
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className={cn(
            "data-[empty=true]:text-muted-foreground w-[212px] justify-between text-left font-normal overflow-hidden",
            className,
          )}
        >
          <span className="truncate">{value ? format(value, displayFormat) : placeholder}</span>
          <ChevronDownIcon className="shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          defaultMonth={value}
          fromDate={fromDate}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}
