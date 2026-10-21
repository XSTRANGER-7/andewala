import "server-only";
import { redirect } from "next/navigation";
import { getProfile, profileComplete, type Profile } from "./accounts";
import { getUser } from "./customer-auth";

/** For /account pages: the logged-in customer's complete profile, or a redirect to login / sign-up details. */
export async function requireAccount(path: string): Promise<Profile> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  const profile = await getProfile(user.id);
  if (!profile || !profileComplete(profile)) redirect(`/login?next=${encodeURIComponent(path)}`);
  return profile;
}
