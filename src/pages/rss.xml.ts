import rss from "@astrojs/rss";
import { getPosts } from "@utils/posts";

import type { APIContext } from "astro";

export async function GET(context: APIContext) {
    const posts = await getPosts();

    return rss({
        title: "Jerome",
        description: "Jerome's personal website",
        items: posts.map((post) => ({
            title: post.metaData.title,
            pubDate: post.metaData.date,
            description: post.metaData.description,
            link: post.href
        })),
        site: context.site!
    });
}
