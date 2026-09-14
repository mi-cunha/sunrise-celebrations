import { cookies } from "next/headers";
import { readReviewerSession, reviewerCookie } from "./meta-review-access";

// This cookie never creates a Supabase Auth session or grants CRM permissions.
export async function getReviewerSession() {
  return readReviewerSession((await cookies()).get(reviewerCookie)?.value);
}
