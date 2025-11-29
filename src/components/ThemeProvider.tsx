"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="navy-blue" // Changed default theme to navy-blue
      enableSystem
      themes={["light", "dark", "navy-blue"]} // Define available themes
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}