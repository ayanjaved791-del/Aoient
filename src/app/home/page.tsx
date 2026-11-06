import type { Metadata } from "next";
import { LocalHome } from "@/modules/auth/local-home";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <LocalHome />;
}
