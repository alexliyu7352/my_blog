import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { render, type CollectionEntry } from "astro:content";

let containerPromise: Promise<AstroContainer> | null = null;

export async function postFeedContent(
  post: CollectionEntry<"posts">
): Promise<string> {
  containerPromise ??= AstroContainer.create();
  const container = await containerPromise;
  const { Content } = await render(post);
  return container.renderToString(Content);
}
