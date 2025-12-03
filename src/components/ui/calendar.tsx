"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, DropdownProps } from "react-day-picker"; // Import DropdownProps
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Custom Dropdown component for month/year selection
function Dropdown(props: DropdownProps) {
  const { onChange, value, children, ...rest } = props;
  const options = React.Children.map(children, (child) =>
    React.isValidElement(child) ? child.props : null
  ).filter(Boolean);

  const handleChange = (newValue: string) => {
    if (onChange) {
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
        <SelectValue>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[200px] hide-scrollbar">
        {options.map((option, index) => (
          <SelectItem key={index} value={option.value}>
            {option.children}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Custom Caption component for navigation and month/year display
function CustomCaption(props: any) {
  const { goToMonth, nextMonth, previousMonth, month, onMonthChange, onYearChange, selected, fromYear, toYear, locale } = props;

  const handlePreviousClick = () => {
    if (previousMonth) {
      goToMonth(previousMonth);
    }
  };

  const handleNextClick = () => {
    if (nextMonth) {
      goToMonth(nextMonth);
    }
  };

  const handleMonthChange = (value: string) => {
    const newMonth = new Date(month.getFullYear(), parseInt(value, 10));
    onMonthChange(newMonth);
  };

  const handleYearChange = (value: string) => {
    const newYear = new Date(parseInt(value, 10), month.getMonth());
    onYearChange(newYear);
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2000, i);
    return { value: i.toString(), label: date.toLocaleString(locale, { month: 'long' }) };
  });

  const years = Array.from({ length: (toYear || 2100) - (fromYear || 1900) + 1 }, (_, i) => {
    const year = (fromYear || 1900) + i;
    return { value: year.toString(), label: year.toString() };
  });

  return (
    <div className="flex justify-between items-center pt-1 relative">
      <button
        type="button"
        onClick={handlePreviousClick}
        disabled={!previousMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex gap-1 mx-auto">
        <Dropdown
          value={month.getMonth().toString()}
          onChange={(e) => handleMonthChange(e.target.value)}
          disabled={false}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Dropdown>
        <Dropdown
          value={month.getFullYear().toString()}
          onChange={(e) => handleYearChange(e.target.value)}
          disabled={false}
        >
          {years.map((y) => (
            <option key={y.value} value={y.value}>
              {y.label}
            </option>
          ))}
        </Dropdown>
      </div>

      <button
        type="button"
        onClick={handleNextClick}
        disabled={!nextMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
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
        caption: "flex justify-center pt-1 relative items-center", // This will be overridden by CustomCaption
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center", // This will be overridden by CustomCaption
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1", // This will be overridden by CustomCaption
        nav_button_next: "absolute right-1", // This will be overridden by CustomCaption
        table: "w-full border-collapse space-y-1",
        head_row: "flex", // Changed to flex for better alignment with dropdowns
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2", // Changed to flex for better alignment with dropdowns
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
        Caption: CustomCaption, // Use the custom Caption component
        Dropdown: Dropdown, // Use the custom Dropdown component
      }}
      captionLayout="dropdown" // Keep this to enable dropdown functionality
      fromYear={1900}
      toYear={2100}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };