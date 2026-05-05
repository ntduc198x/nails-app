import { LandingPageClient } from "@/components/landing/landing-page-client";
import { getLandingPagePayload } from "@/lib/landing-content";

export const revalidate = 300;

export default async function HomePage() {
  const fallbackPayload = {
    homeFeed: {
      lookbook: [],
      contentPosts: [],
      offers: [],
    },
    explore: {
      storefront: null,
      stats: [],
      featuredServices: [],
      products: [],
      team: [],
      gallery: [],
      offers: [],
      map: null,
    },
  };

  const payload = await getLandingPagePayload().catch(() => fallbackPayload);
  const storefront = payload.explore.storefront;
  const blogPosts = payload.homeFeed.contentPosts.slice(0, 3);
  const siteUrl = "https://chambeauty.io.vn";

  const structuredData = [
    storefront
      ? {
          "@context": "https://schema.org",
          "@type": "NailSalon",
          name: storefront.name,
          description: storefront.description,
          image: storefront.coverImageUrl,
          telephone: storefront.phone,
          url: siteUrl,
          openingHours: storefront.openingHours,
          address: storefront.addressLine
            ? {
                "@type": "PostalAddress",
                streetAddress: storefront.addressLine,
              }
            : undefined,
          sameAs: [storefront.instagramUrl, storefront.messengerUrl].filter(Boolean),
        }
      : null,
    blogPosts.length
      ? {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Home Feed Cham Beauty",
          url: `${siteUrl}/#stories`,
          blogPost: blogPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.summary,
            image: post.coverImageUrl ?? undefined,
            datePublished: post.publishedAt ?? undefined,
            url: `${siteUrl}/stories/${post.id}`,
            author: {
              "@type": "Organization",
              name: storefront?.name ?? "Cham Beauty",
            },
          })),
        }
      : null,
  ].filter(Boolean);

  return (
    <>
      {structuredData.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}
      <LandingPageClient initialHomeFeed={payload.homeFeed} initialExplore={payload.explore} />
    </>
  );
}
