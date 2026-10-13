import { z } from "zod";
import { RouteResponse, route } from "next-routed";
import { asAppRoute, protectedRoute, type ProtectedContext } from "@/lib/api";

const postsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(""),
});

const createPostSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(10_000),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});

const posts = [
  {
    id: "post-1",
    title: "Welcome to next-routed",
    content: "Build composable, type-safe App Router handlers.",
    tags: ["nextjs", "typescript"],
    authorId: "admin-1",
  },
];

export const GET = asAppRoute(
  route.query(postsQuerySchema).handle(({ query }) => {
    const matchingPosts = query.search
      ? posts.filter((post) =>
          `${post.title} ${post.content}`
            .toLowerCase()
            .includes(query.search.toLowerCase())
        )
      : posts;
    const start = (query.page - 1) * query.limit;

    return {
      posts: matchingPosts.slice(start, start + query.limit),
      page: query.page,
      limit: query.limit,
      search: query.search,
    };
  })
);

export const POST = asAppRoute(
  protectedRoute.body(createPostSchema).handle(
    async (
      context: ProtectedContext & { body: z.infer<typeof createPostSchema> }
    ) => {
      const post = {
        id: `post-${posts.length + 1}`,
        ...context.body,
        authorId: context.user.id,
      };
      posts.push(post);
      return RouteResponse.status(201).json(post, "POST_CREATED");
    }
  )
);
