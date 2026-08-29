import { resolved as card } from "panes/card";
import { resolved as cardList } from "panes/card/list";
import { resolved as skeletonCard } from "skeletons/card";
import { resolved as skeletonTimeline } from "skeletons/timeline";

/** What each aliased specifier resolved to, named by the module it reached. */
export const resolutions = { card, cardList, skeletonCard, skeletonTimeline };
