"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, DropdownProps } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Custom Dropdown component for month/year selection
function Dropdown(props: DropdownProps) {
  const { onChange, value, children, ...rest } = props;

  // Extract options from children (which are <option> elements provided by react-day-picker)
  const options = React.Children.toArray(children)
    .map((child) => {
      if (React.isValidElement(child) && typeof child.type === 'string' && child.type === 'option') {
        return {
          value: child.props.value,
          label: child.props.children,
        };
      }
      return null;
    })
    .filter(Boolean); // Filter out any nulls

  const handleChange = (newValue: string) => {
    if (onChange) {
      // Simulate a native select change event for react-day-picker
      onChange({ target: { value: newValue } } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  return (
    <Select
      onValueChange={handleChange}
      value={value as string}
      disabled={props.disabled}
    >
      <SelectTrigger className="h-8 w-[100px] text-sm">
        <SelectValue>{options.find(opt => opt.value === value)?.label || value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[200px] hide-scrollbar">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "grid grid-cols-7", // Use grid for day headers
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "grid grid-cols-7 mt-2", // Use grid for date rows
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-range-start)]:rounded-l-md [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        Dropdown: Dropdown, // Use the custom Dropdown component
      }}
      captionLayout="dropdown"
      fromYear={1900}
      toYear={2100}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };