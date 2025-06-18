"use client";

import React from "react";
import { useTheme } from "@/contexts/ThemeProvider";
import { Button } from "@/components/ui/button"; // Assuming a Button component exists

export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // For now, simple text. Icons can be added later.
  // We can use a Moon and Sun icon from a library like lucide-react if available
  // For example: import { Moon, Sun } from "lucide-react";
  return (
    <Button variant="outline" size="icon" onClick={toggleTheme}>
      {theme === "light" ? (
        // <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <span>☀️</span>
      ) : (
        // <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span>🌙</span>
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
