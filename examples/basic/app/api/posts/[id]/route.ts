import { z } from "zod";
import {
  NotFoundError,
  ResponseBuilder,
  createRoute,
  type BaseContext,
} from "next-route-kit";
import {
  adminRouter,
  asAppRoute,
  type AdminContext,
} from "@/lib/api";

const paramsSchema = z.object({
  id: z.string().regex(/^post-\d+$/, "Post IDs must look like post-1"),
});

const posts = [
  {
    id: "post-1",
    title: "Welcome to next-route-kit",
    content: "Build composable, type-safe App Router handlers.",
    tags: ["nextjs", "typescript"],
    authorId: "admin-1",
  },
];

type PostParamsContext = BaseContext & {
  params: {
    id: string;
  };
};

export const GET = asAppRoute(
  createRoute<PostParamsContext, {
    id: string;
    title: string;
    content: string;
    tags: string[];
    authorId: string;
  }>({
    validation: {
      params: paramsSchema,
    },
    handler: ({ params }) => {
      const post = posts.find((candidate) => candidate.id === params.id);

      if (!post) {
        throw new NotFoundError("Post not found", "POST_NOT_FOUND");
      }

      return post;
    },
  })
);

export const DELETE = asAppRoute(
  adminRouter.handler(async (context: AdminContext) => {
    const params = await context.params;
    const parsedParams = paramsSchema.safeParse(params);

    if (!parsedParams.success) {
      return ResponseBuilder.error(parsedParams.error, {
        status: 400,
      });
    }

    const index = posts.findIndex(
      (candidate) => candidate.id === parsedParams.data.id
    );

    if (index === -1) {
      throw new NotFoundError("Post not found", "POST_NOT_FOUND");
    }

    const [deletedPost] = posts.splice(index, 1);

    return {
      deleted: true,
      postId: deletedPost.id,
      deletedBy: context.user.id,
    };
  })
);
