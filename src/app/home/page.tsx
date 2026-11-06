import { redirect } from "next/navigation";

/** Kept so existing links keep working; signed-in users now start on pricing. */
export default function HomePage() {
  redirect("/pricing");
}
