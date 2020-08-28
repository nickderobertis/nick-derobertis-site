import { LayoutDOM, LayoutDOMView } from "models/layouts/layout_dom";
import * as p from "core/properties";
import { UnsizedBox } from "./unsizedBox";
import { Raw } from "./raw";

let counter: number = 0;

export class ContainerView extends LayoutDOMView {
  model: Container;
  layout: UnsizedBox;

  initialize(): void {
    super.initialize();
    this.el.style.removeProperty("position");
  }

  connect_signals(): void {
    this.connect(this.model.properties.children.change, () => this.rebuild());
  }

  get child_models(): LayoutDOM[] {
    return this.model.children;
  }

  _update_layout(): void {
    this.layout = new UnsizedBox();
  }

  update_position(): void {}

  render(): void {
    super.render();

    // TODO [$5f48ee221eb7f00008112571]: Set up container elements correctly in the first place
    //
    // Currently just modifying the DOM after the initial render, but
    // further customization of the base behavior should be done so that
    // the elements are set up correctly in the first place.

    // Remove generated bk div children and bring content up a level
    const childrenToRemove = this.el.querySelectorAll(
      `:scope > div.panel-class-which-marks-elements-to-be-removed`
    );
    removeElements([...childrenToRemove]);

    // Remove generated bk-clearfix divs around HTML elements
    const clearFixElements = this.el.getElementsByClassName("bk-clearfix");
    removeElements([...clearFixElements]);

    // Remove bokeh-applied styling to necessary generated bk components and add child class
    const childrenToModify = this.el.querySelectorAll(`:scope > div.bk`);
    for (const elem of childrenToModify) {
      elem.removeAttribute("style");
      elem.setAttribute("id", this.uniqueNodeId);
      for (const klass of this.model.child_css_classes) {
        elem.classList.add(klass);
      }
    }

    this.el.innerHTML = this.fullHTMLContent;
    this.replaceElementsWithViewElements();
  }

  get fullHTMLContent(): string {
    let fullHTML = "";
    for (const view of this.child_views) {
      if (view.model.type === "Raw") {
        fullHTML += (view.model as Raw).text;
      } else {
        fullHTML += view.el.outerHTML;
      }
    }
    return fullHTML;
  }

  get uniqueNodeId(): string {
    counter++;
    return `panel-unique-obj-id-${counter}`;
  }

  replaceElementsWithViewElements() {
    for (const view of this.child_views) {
      if (view.model.type == "Container") {
        // TODO [$5f48ee221eb7f00008112572]: replace elements approach becomes very inefficient with multiple layers of components
        //
        // It starts from the inner-most component and works to outer, each time recursively
        // replacing in all inner components. Need to figure out a way to prevent inner
        // replaces when it will later be done with outer, or avoid replacing approach alltogether
        (view as ContainerView).replaceElementsWithViewElements();
      } else if (view.model.type !== "Raw") {
        const elem: Element = view.el;
        const replaceElem = document.querySelector(`#${elem.id}`);
        if (!replaceElem) continue;
        const parent = replaceElem.parentElement;
        if (!parent) continue;
        parent.replaceChild(elem, replaceElem);
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
