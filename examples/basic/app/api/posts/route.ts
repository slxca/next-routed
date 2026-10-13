import { z } from "zod";
import {
  BadRequestError,
  ResponseBuilder,
  createRoute,
  type BaseContext,
} from "next-route-kit";
import {
  asAppRoute,
  protectedRouter,
  type ProtectedContext,
} from "@/lib/api";

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

type PostsQueryContext = BaseContext & {
  query: z.infer<typeof postsQuerySchema>;
};

const posts = [
  {
    id: "post-1",
    title: "Welcome to next-route-kit",
    content: "Build composable, type-safe App Router handlers.",
    tags: ["nextjs", "typescript"],
    authorId: "admin-1",
  },
];

export const GET = asAppRoute(
  createRoute<PostsQueryContext, {
    posts: typeof posts;
    page: number;
    limit: number;
    search: string;
  }>({
    validation: {
      query: postsQuerySchema,
    },
    handler: ({ query }) => {
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
    },
  })
);

export const POST = asAppRoute(
  protectedRouter.handler(async (context: ProtectedContext) => {
    const parsedBody = createPostSchema.safeParse(await context.request.json());

    if (!parsedBody.success) {
      throw new BadRequestError(
        "Request body validation failed",
        "VALIDATION_ERROR",
        parsedBody.error.issues
      );
    }

    const post = {
      id: `post-${posts.length + 1}`,
      ...parsedBody.data,
      authorId: context.user.id,
    };

    posts.push(post);

    return ResponseBuilder.json(post, {
      id: "POST_CREATED",
      status: 201,
    });
  })
);
