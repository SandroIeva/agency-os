// "+3 since yesterday" under the follower count, and where that number comes
// from.
//
// None of the three platforms hands us a usable growth figure. Threads and
// TikTok report only the current total. Instagram HAS a daily `follower_count`
// metric, but it answers nothing until an account has 100 followers, which is
// exactly the situation a new workspace is in. So the only number we can rely
// on is the one we wrote down ourselves: one row per account per day in
// social_follower_snapshots, written whenever Analytics is opened.
//
// Consequences worth knowing:
//  - The first visit ever has nothing to compare against and says nothing.
//  - The comparison is against the last day we SAW the account, not
//    necessarily yesterday, which is why the answer carries that date.
//  - Somebody who opens Analytics twice on one day sees the same number: the
//    day's row is overwritten, not appended.
//
// Berlin dates, like the visit counter, so a day means the same thing in both.
const berlinDay = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

export async function followerDelta(db, { orgId, platform, accountId, followers }) {
  if (!db || !orgId || !accountId || typeof followers !== "number" || !Number.isFinite(followers)) return null;
  const day = berlinDay();
  let previous = null;
  try {
    const { data } = await db
      .from("social_follower_snapshots")
      .select("day, followers")
      .eq("org_id", orgId).eq("platform", platform).eq("account_id", accountId)
      .lt("day", day)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    previous = data || null;
  } catch (_) { /* no history, no statement */ }
  try {
    await db.from("social_follower_snapshots").upsert(
      { org_id: orgId, platform, account_id: accountId, day, followers },
      { onConflict: "org_id,platform,account_id,day" },
    );
  } catch (_) { /* a missed snapshot is one gap, not a broken panel */ }
  if (!previous || typeof previous.followers !== "number") return null;
  return { value: followers - previous.followers, since: previous.day };
}
