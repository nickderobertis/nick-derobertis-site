import { Box, BoxView } from "models/layouts/box";
import { Column as ColumnLayout, RowsSizing } from "core/layout/grid";
import * as p from "core/properties";

export class ContainerView extends BoxView {
  model: Container;

  _update_layout(): void {
    const items = this.child_views.map((child) => child.layout);
    this.layout = new ColumnLayout(items);
    this.layout.rows = this.model.rows;
    this.layout.spacing = [this.model.spacing, 0];
    this.layout.set_sizing(this.box_sizing());
  }
}

export namespace Container {
  export type Attrs = p.AttrsOf<Props>;

  export type Props = Box.Props & {
    rows: p.Property<RowsSizing>;
  };
}

export interface Container extends Container.Attrs {}

export class Container extends Box {
  properties: Container.Props;
  __view_type__: ContainerView;

  constructor(attrs?: Partial<Container.Attrs>) {
    super(attrs);
  }

  static init_Container(): void {
    this.prototype.default_view = ContainerView;

    this.define<Container.Props>({
      rows: [p.Any, "auto"],
    });
  }
}
