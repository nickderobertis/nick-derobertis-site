import * as p from "core/properties";
import { Widget, WidgetView } from "models/widgets/widget";
import { ButtonClick } from "core/bokeh_events";

export class EventElementView extends WidgetView {
  model: EventElement;

  //   *controls() {
  //     yield this.el;
  //   }

  connect_signals(): void {
    super.connect_signals();
    this.connect(this.model.change, () => this.render());
  }

  render(): void {
    super.render();
    this.el.innerHTML = this.model.text;
    this.el.addEventListener("click", () => this.click());
  }

  click(): void {
    this.model.trigger_event(new ButtonClick());
  }
}

export namespace EventElement {
  export type Attrs = p.AttrsOf<Props>;

  export type Props = Widget.Props & {
    watch_events: p.Property<string[]>;
    text: p.Property<string>;
  };
}

export interface EventElement extends EventElement.Attrs {}

export class EventElement extends Widget {
  properties: EventElement.Props;
  __view_type__: EventElementView;

  constructor(attrs?: Partial<EventElement.Attrs>) {
    super(attrs);
  }

  static init_EventElement(): void {
    this.prototype.default_view = EventElementView;

    this.define<EventElement.Props>({
      watch_events: [p.Array, []],
      text: [p.String, ""],
    });
  }
}
