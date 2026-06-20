import { SummaryBar } from "@/components/layout/SummaryBar";
import { NavTabs } from "@/components/layout/NavTabs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <SummaryBar />
      <NavTabs />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
