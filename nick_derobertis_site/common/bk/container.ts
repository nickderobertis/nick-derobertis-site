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

    // Remove generated bk-clearfix divs around HTML elements
    // TODO: it would be better to prevent clear-fix elements from ever being added
    let clearFixElements = this.el.getElementsByClassName("bk-clearfix");
    while (clearFixElements.length > 0) {
      const elem = clearFixElements[0];
      const fragment = document.createDocumentFragment();
      while (elem.firstChild) {
        fragment.appendChild(elem.firstChild);
      }
      if (elem.parentNode) {
        elem.parentNode.replaceChild(fragment, elem);
      }
      clearFixElements = this.el.getElementsByClassName("bk-clearfix");
    }

    // Clear existing postion: absolute on children
    // and add child css classes if any
    const subElements = this.el.children;
    for (const elem of subElements) {
      elem.removeAttribute("style");
      for (const klass of this.model.child_css_classes) {
        elem.classList.add(klass);
      }
    }
  }
}

export namespace Container {
  export type Attrs = p.AttrsOf<Props>;

  export type Props = LayoutDOM.Props & {
    children: p.Property<LayoutDOM[]>;
    child_css_classes: p.Property<string[]>;
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
      child_css_classes: [p.Array, []],
    });
  }
}
