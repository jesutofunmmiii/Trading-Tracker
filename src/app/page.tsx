import { redirect } from "next/navigation";

// Root redirects to the first tab.
export default function Home() {
  redirect("/milestones");
}
