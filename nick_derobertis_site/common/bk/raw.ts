import { Markup, MarkupView } from "models/widgets/markup";
import * as p from "core/properties";

export class RawView extends MarkupView {
  model: Raw;

  render(): void {
    super.render();
    this.markup_el.innerHTML = this.model.text;
  }
}

export namespace Raw {
  export type Attrs = p.AttrsOf<Props>;

  export type Props = Markup.Props;
}

export interface Raw extends Raw.Attrs {}

export class Raw extends Markup {
  properties: Raw.Props;
  __view_type__: RawView;

  constructor(attrs?: Partial<Raw.Attrs>) {
    super(attrs);
  }

  static init_Raw(): void {
    this.prototype.default_view = RawView;

    this.define<Raw.Props>({});
  }
}
