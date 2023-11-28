import {
  ViewUpdate,
  PluginValue,
  PluginSpec,
  EditorView,
  ViewPlugin,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { RegExpCursor } from '@codemirror/search'
import { Extension, Facet, combineConfig } from '@codemirror/state'
import { cloneDeep } from 'lodash'
import RegexMark from './main'
import { SettingOptions, SettingOption } from './setting'

const Config = Facet.define<SettingOptions, Required<SettingOptions>>({
  combine(options) {
    return combineConfig(options, [])
  },
})

export function cmExtension(plugin: RegexMark) {
  const extensions: Extension[] = [ cmPlugin ]
  const options = plugin.settings
  extensions.push(Config.of(cloneDeep(options)))
  return extensions
}

class CMPlugin implements PluginValue {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView) {
    const decorations = []
    const data: SettingOptions = Object.values(view.state.facet(Config))
    for (const part of view.visibleRanges) {
      for (const d of data) {
        if (!d.regex || !d.class || d.regex === '' || d.class === '')
          continue
        const cursor = new RegExpCursor(view.state.doc, d.regex, {}, part.from, part.to)
        while (!cursor.next().done) {
          const { from, to } = cursor.value
          const string = view.state.sliceDoc(from, to).trim()
          let markDeco = Decoration.mark({
            class: d.class,
            attributes: { 'data-contents' : string },
          })
          if (d.hide)
            markDeco = Decoration.replace({
              widget: new VarWidget(string, d),
              block: false,
              inclusive: false,
            })

          decorations.push(markDeco.range(from, to))
        }
      }
    }
    return Decoration.set(decorations.sort((a, b) => a.from - b.from))
  }
}

const pluginSpec: PluginSpec<CMPlugin> = {
  decorations: (value: CMPlugin) => value.decorations,
}

const cmPlugin = ViewPlugin.fromClass(CMPlugin, pluginSpec)

class VarWidget extends WidgetType {
  data : SettingOption
  constructor(readonly value: string, data: SettingOption) {
    super()
    this.data = data
  }

  eq(other: VarWidget) {
    //return false if the regex is edited
    const regex = new RegExp(this.data.regex, 'g')
    if (this.value.match(regex) === null)
      return false
    return other.value == this.value
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.addClass(this.data.class)
    let text = this.value
    const regex = new RegExp(this.data.regex, 'g')
    if (this.data.hide)
      text = this.value.replace(regex, '$1')
    wrap.innerHTML = text
    return wrap
  }

  ignoreEvent() { return false }
}

