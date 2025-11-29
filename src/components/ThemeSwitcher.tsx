"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Set a distinct opaque background color using bg-secondary and its corresponding foreground color.
  const buttonClasses = "bg-secondary text-secondary-foreground hover:bg-secondary/80";

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={buttonClasses}>
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    );
  }

  const currentIcon = theme === "dark" ? Moon : theme === "navy-blue" ? Palette : Sun;
  const CurrentIconComponent = currentIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={buttonClasses}>
          <CurrentIconComponent className="h-[1.2rem] w-[1.2rem] transition-all" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Night (Dark)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("navy-blue")}>
          <Palette className="mr-2 h-4 w-4" />
          <span>Navy Blue</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeSwitcher;