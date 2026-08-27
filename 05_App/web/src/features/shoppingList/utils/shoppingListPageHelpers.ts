import type { ShoppingListItemDto } from "../shoppingListApi";

export function groupItemsByCategory(
  items: ShoppingListItemDto[],
): Map<string, ShoppingListItemDto[]> {
  const groups = new Map<string, ShoppingListItemDto[]>();

  for (const item of items) {
    const existing = groups.get(item.category);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.category, [item]);
    }
  }

  return groups;
}

// Web Share API er ikke understøttet overalt (fx desktop Firefox) — falder
// tilbage til udklipsholderen, så knappen altid gør noget brugbart.
export async function shareItemsAsText(items: ShoppingListItemDto[]): Promise<void> {
  const text = items
    .filter((item) => !item.isChecked)
    .map((item) => `- ${item.name}`)
    .join("\n");

  const shareText = `Indkøbsliste:\n${text}`;

  if (navigator.share) {
    await navigator.share({ text: shareText });
    return;
  }

  await navigator.clipboard.writeText(shareText);
}
