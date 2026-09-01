"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function ThemeToggle() {
  const { setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Tránh hydration mismatch: chỉ render nội dung phụ thuộc theme sau khi mounted.
  if (!mounted) {
    return (
      <button
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-9 w-9")}
        aria-label="Đổi giao diện"
        disabled
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-9 w-9")}
        aria-label="Đổi giao diện"
      >
        <Sun className="h-5 w-5 dark:hidden" />
        <Moon className="hidden h-5 w-5 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Sáng
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Tối
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> Hệ thống
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
