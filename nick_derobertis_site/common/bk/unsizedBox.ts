import { Layoutable } from "core/layout/layoutable";
import { Size, Sizeable, SizeHint } from "core/layout/types";

export class UnsizedBox extends Layoutable {
  is_width_expanding(): boolean {
    return false;
  }

  is_height_expanding(): boolean {
    return false;
  }

  _measure(viewport: Sizeable): SizeHint {
    viewport;
    return { width: 0, height: 0 };
  }

  measure(viewport_size: Size): SizeHint {
    viewport_size;
    return { width: 0, height: 0 };
  }

  apply_aspect(viewport: Size, { width, height }: Size): Size {
    viewport;
    width;
    height;
    return { width: 0, height: 0 };
  }
}
