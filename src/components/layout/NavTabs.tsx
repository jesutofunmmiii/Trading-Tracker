"use client";

// Navigation tab bar. Each tab maps to a route under /(dashboard).
// Active tab is determined from the current pathname.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart2,
  BookOpen,
  Calendar,
  CheckSquare,
  Flag,
  Heart,
  Image,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";

const tabs = [
  { href: "/milestones",    label: "Milestones",       icon: Flag },
  { href: "/routine",       label: "Daily Routine",    icon: CheckSquare },
  { href: "/journal",       label: "Journal",          icon: BookOpen },
  { href: "/strategy",      label: "Strategy",         icon: TrendingUp },
  { href: "/my-why",        label: "My Why",           icon: Heart },
  { href: "/vision-board",  label: "Vision Board",     icon: Image },
  { href: "/calendar",      label: "Econ Calendar",    icon: Calendar },
  { href: "/propfirms",     label: "Propfirm Tracker", icon: BarChart2 },
] as const;

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="border-b border-navy-700 bg-navy-900"
      aria-label="Dashboard sections"
    >
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        {/* Horizontally scrollable on small screens */}
        <div className="flex overflow-x-auto scrollbar-none -mb-px gap-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-gold-500 text-gold-400"
                    : "border-transparent text-navy-300 hover:text-navy-100 hover:border-navy-400"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
