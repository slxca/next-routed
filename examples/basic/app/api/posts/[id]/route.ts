import { z } from "zod";
import { NotFoundError, route } from "next-route-kit";
import {
  adminRoute,
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

export const GET = asAppRoute(
  route.params(paramsSchema).handle(({ params }) => {
    const post = posts.find((candidate) => candidate.id === params.id);
    if (!post) {
      throw new NotFoundError("Post not found", "POST_NOT_FOUND");
    }
    return post;
  })
);

export const DELETE = asAppRoute(
  adminRoute.params(paramsSchema).handle(
    async (
      context: AdminContext & { params: z.infer<typeof paramsSchema> }
    ) => {
      const index = posts.findIndex(
        (candidate) => candidate.id === context.params.id
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
    }
  )
);
