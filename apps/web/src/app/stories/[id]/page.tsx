import Link from "next/link";
import { notFound } from "next/navigation";
import { formatViDate } from "@nails/shared";
import { createServiceRoleClient } from "@/lib/supabase";

type StoryRow = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  cover_image_url: string | null;
  content_type: string | null;
  source_platform: string | null;
  published_at: string | null;
};

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("customer_content_posts")
    .select("id,title,summary,body,cover_image_url,content_type,source_platform,published_at")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const story = data as StoryRow;

  return (
    <main className="story-detail-page">
      <div className="story-detail-page__container">
        <Link href="/#stories" className="story-detail-page__back">
          ← Quay lại landing
        </Link>

        <article className="story-detail-card">
          {story.cover_image_url ? (
            <img src={story.cover_image_url} alt={story.title} className="story-detail-card__image" />
          ) : null}

          <div className="story-detail-card__meta">
            <span>{story.source_platform ?? "home-feed"}</span>
            {story.published_at ? <time>{formatViDate(story.published_at)}</time> : null}
            {story.content_type ? <strong>{story.content_type}</strong> : null}
          </div>

          <h1>{story.title}</h1>
          {story.summary ? <p className="story-detail-card__summary">{story.summary}</p> : null}

          <div className="story-detail-card__body">
            {(story.body ?? story.summary ?? "")
              .split("\n")
              .filter(Boolean)
              .map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
          </div>
        </article>
      </div>
    </main>
  );
}
