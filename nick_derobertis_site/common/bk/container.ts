import { LayoutDOM, LayoutDOMView } from "models/layouts/layout_dom";
import * as p from "core/properties";
import { UnsizedBox } from "./unsizedBox";

export class ContainerView extends LayoutDOMView {
  model: Container;
  layout: UnsizedBox;

  initialize(): void {
    super.initialize();
    this.el.style.removeProperty("position");
  }

  connect_signals(): void {}

  get child_models(): LayoutDOM[] {
    return this.model.children;
  }

  _update_layout(): void {
    this.layout = new UnsizedBox();
  }

  update_position(): void {}

  render(): void {
    super.render();

    const subElements = this.el.getElementsByClassName("bk");
    for (const elem of subElements) {
      elem.removeAttribute("style");
    }
  }
}

export namespace Container {
  export type Attrs = p.AttrsOf<Props>;

  export type Props = LayoutDOM.Props & {
    children: p.Property<LayoutDOM[]>;
  };
}

export interface Container extends Container.Attrs {}

export class Container extends LayoutDOM {
  properties: Container.Props;
  __view_type__: ContainerView;

  constructor(attrs?: Partial<Container.Attrs>) {
    super(attrs);
  }

  static init_Container(): void {
    this.prototype.default_view = ContainerView;

    this.define<Container.Props>({
      children: [p.Array, []],
    });
  }
}
