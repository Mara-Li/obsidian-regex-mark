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
import { EditorSelection, Extension, Facet, combineConfig } from '@codemirror/state'
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
        const cursor = new RegExpCursor(view.state.doc, removeTags(d.regex), {}, part.from, part.to)
        while (!cursor.next().done) {
          const { from, to } = cursor.value
          const string = view.state.sliceDoc(from, to).trim()
          const markDeco = Decoration.replace({
            widget: new VarWidget(string, d, view, checkSelectionOverlap(view.state.selection, from, to)),
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
  view: EditorView
  isSelected: boolean
  constructor(readonly value: string, data: SettingOption, view: EditorView, isSelected: boolean) {
    super()
    this.data = data
    this.view = view
    this.isSelected = isSelected
  }

  //Widget is only updated when the raw text is changed / the elements get focus and loses it

  eq(other: VarWidget) {
    //return false if the regex is edited
    const regex = new RegExp(removeTags(this.data.regex), 'g')
    if (this.value.match(regex) === null)
      return false
    return other.value == this.value
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.addClass(this.data.class)
    const text = this.value
    if (this.data.hide){
      //example of hiding:
      //entry : __content__ => <span class="underline"><span class="cm-hide">__</span>content<span class="cm-hide">__</span></span>
      //regex : {{open:__}}(.*){{close:__}}
      let openTag = null
      let closeTag = null
      if (this.data.regex.match('{{open'))
        openTag = this.data.regex.match(/{{open:(.*?)}}/)?.[1]
      if (this.data.regex.match('{{close'))
        closeTag = this.data.regex.match(/{{close:(.*?)}}/)?.[1]
      let openTagHide = ''
      let closeTagHide = ''
      if (openTag) {
        //search the openTag in the text and replace it with the hide tag
        const openTagRegex = new RegExp(openTag, 'g')
        const openTagText = this.value.match(openTagRegex)?.[0]
        openTagHide = `<span class="cm-hide">${openTagText}</span>`
      }
      if (closeTag) {
        const closeTagRegex = new RegExp(closeTag, 'g')
        const closeTagText = this.value.match(closeTagRegex)?.[0]
        closeTagHide = `<span class="cm-hide">${closeTagText}</span>`
      }
      const regexText = new RegExp(removeTags(this.data.regex), 'g')
      wrap.innerHTML = openTagHide + text.replace(regexText, '$1') + closeTagHide
    } else
      wrap.innerText = text
    return wrap
  }

  ignoreEvent(): boolean {return false}

}

function checkSelectionOverlap(selection: EditorSelection | undefined, from: number, to: number): boolean {
  if (!selection) {
    return false
  }

  for (const range of selection.ranges) {
    if (range.to >= from && range.from <= to) {
      return true
    }
  }

  return false
}

//remove the {{open:}} and {{close:}} tags and keep the inner text
//ie {{open: __}} => __
//ie {{close: __}} => __
export function removeTags(regex: string) {
  return regex.replace(/{{open:(.*?)}}/, '$1').replace(/{{close:(.*?)}}/, '$1')
}