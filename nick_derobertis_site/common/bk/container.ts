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

    // TODO: Set up container elements correctly in the first place
    //
    // Currently just modifying the DOM after the initial render, but
    // further customization of the base behavior should be done so that
    // the elements are set up correctly in the first place.

    // Remove generated bk div children and bring content up a level
    const childrenToRemove = document.querySelectorAll(
      `div[data-root-id="${this.model.id}"] > div.bk > div[class="bk panel-class-which-marks-elements-to-be-removed"]`
    );
    removeElements([...childrenToRemove]);

    // Remove generated bk-clearfix divs around HTML elements
    const clearFixElements = this.el.getElementsByClassName("bk-clearfix");
    removeElements([...clearFixElements]);

    // Remove bokeh-applied styling to necessary generated bk components and add child class
    const childrenToModify = document.querySelectorAll(
      `div[data-root-id="${this.model.id}"] > div.bk > div[class="bk"]`
    );
    for (const elem of childrenToModify) {
      elem.removeAttribute("style");
      for (const klass of this.model.child_css_classes) {
        elem.classList.add(klass);
      }
    }
  }
}

function removeElement(elem: Element) {
  const fragment = document.createDocumentFragment();
  while (elem.firstChild) {
    fragment.appendChild(elem.firstChild);
  }
  if (elem.parentNode) {
    elem.parentNode.replaceChild(fragment, elem);
  }
}

function removeElements(elems: Element[]) {
  while (elems.length > 0) {
    const elem = elems.pop();
    if (elem) {
      removeElement(elem);
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
