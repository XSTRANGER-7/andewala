import "server-only";
import { redirect } from "next/navigation";
import { getProfile, type Profile } from "./accounts";
import { getUser } from "./customer-auth";

/** For /account pages: the logged-in customer's profile, or a redirect to login / "Finish your account" for new accounts. */
export async function requireAccount(path: string): Promise<Profile> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  const profile = await getProfile(user.id);
  if (!profile || !profile.onboarded) redirect(`/login?next=${encodeURIComponent(path)}`);
  return profile;
}
