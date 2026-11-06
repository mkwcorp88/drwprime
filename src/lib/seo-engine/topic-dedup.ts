/**
 * Decides whether a queued topic has already been written.
 *
 * The title of a published post is written by the LLM, so it almost never equals
 * the queued topic string. Comparing the two exactly let the same queue entry
 * stay "fresh" forever: 67 of the newest 100 posts were one hair-care article.
 * So this compares words instead of whole strings.
 */
const STOPWORDS = new Set(
  'di dan untuk yang dengan dari ke pada agar atau ini itu apa mana bagi serta anda kamu drw prime'.split(' ')
);

/** Share of a topic's words an existing post must contain to count as the same article. */
const TOPIC_OVERLAP = 0.6;

function words(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .normalize('NFKD')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return new Set(tokens);
}

/** `existing` holds the titles and slugs of posts already written. */
export function isTopicCovered(
  candidate: { topic: string; keyword: string },
  existing: Iterable<string>
): boolean {
  const keyword = [...words(candidate.keyword)];
  const topic = [...words(candidate.topic)];

  for (const text of existing) {
    const post = words(text);
    if (keyword.length && keyword.every((word) => post.has(word))) return true;
    const shared = topic.filter((word) => post.has(word)).length;
    if (topic.length && shared / topic.length >= TOPIC_OVERLAP) return true;
  }
  return false;
}
