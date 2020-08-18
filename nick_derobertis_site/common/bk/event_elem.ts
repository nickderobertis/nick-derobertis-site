import * as p from "core/properties";
import { Widget, WidgetView } from "models/widgets/widget";
import { ButtonClick, EventJSON } from "core/bokeh_events";

export type GeneralEventJSON = EventJSON & { event_type: string };

export class GeneralEvent extends ButtonClick {
  event_name: string;

  constructor(event_name: string) {
    super();
    this.event_name = event_name;
  }
}

export class EventElementView extends WidgetView {
  model: EventElement;
  private _watchedEvents: string[] = [];

  connect_signals(): void {
    super.connect_signals();
    this.connect(this.model.change, () => this.render());
  }

  render(): void {
    super.render();
    this.el.innerHTML = this.model.text;
    for (const eventName of this.model.watch_events) {
      if (this._watchedEvents.includes(eventName)) continue;
      this.el.addEventListener(eventName, () => this.triggerEvent(eventName));
      this._watchedEvents.push(eventName);
    }
  }

  triggerEvent(eventName: string): void {
    this.model.trigger_event(new GeneralEvent(eventName));
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
