"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Link as LinkIcon, Heading3, Pilcrow, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, RemoveFormatting, Braces,
} from "lucide-react";

type Mode = "visual" | "html";

const TOOL_STYLE = "p-1.5 rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors";
const SEPARATOR = <span className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />;

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  variables?: string[];
}

export function RichTextEditor({ label, value, onChange, variables = [] }: RichTextEditorProps) {
  const editRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastValue = useRef<string | null>(null);
  const [mode, setMode] = useState<Mode>("visual");
  const [varsOpen, setVarsOpen] = useState(false);

  useEffect(() => {
    if (mode === "visual" && editRef.current && value !== lastValue.current) {
      editRef.current.innerHTML = value || "";
      lastValue.current = value;
    }
  }, [value, mode]);

  function emitFromEditor() {
    if (!editRef.current) return;
    const html = editRef.current.innerHTML;
    lastValue.current = html;
    onChange(html);
  }

  function exec(cmd: string, param?: string) {
    editRef.current?.focus();
    document.execCommand(cmd, false, param);
    emitFromEditor();
  }

  function insertLink() {
    const url = window.prompt("URL del enlace (https://...)");
    if (url) exec("createLink", url.trim());
  }

  function insertVariable(name: string) {
    setVarsOpen(false);
    const variable = "{{" + name + "}}";
    if (mode === "html") {
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const next = ta.value.slice(0, start) + variable + ta.value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + variable.length;
          ta.focus();
        });
      }
      return;
    }
    editRef.current?.focus();
    document.execCommand("insertText", false, variable);
    emitFromEditor();
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          {variables.length > 0 && (
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setVarsOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                <Braces className="w-3.5 h-3.5" /> Insertar variable ▾
              </button>
              {varsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setVarsOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 w-56 max-h-64 overflow-auto">
                    {variables.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => insertVariable(name)}
                        className="w-full text-left px-2 py-1.5 rounded-md text-sm font-mono text-gray-700 hover:bg-gray-100"
                      >
                        {"{{" + name + "}}"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={`px-3 py-1.5 ${mode === "visual" ? "bg-brand-500 text-ink-900" : "text-gray-600 hover:bg-gray-50"}`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => setMode("html")}
            className={`px-3 py-1.5 ${mode === "html" ? "bg-brand-500 text-ink-900" : "text-gray-600 hover:bg-gray-50"}`}
          >
            HTML
          </button>
        </div>
      </div>

      {mode === "html" ? (
        <textarea
          ref={textareaRef}
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono bg-gray-50"
        />
      ) : (
        <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
          <div className="flex flex-wrap items-center px-2 py-1.5 border-b border-gray-200 bg-gray-50">
            <button type="button" title="Deshacer" onClick={() => exec("undo")} className={TOOL_STYLE}>
              <Undo2 className="w-4 h-4" />
            </button>
            <button type="button" title="Rehacer" onClick={() => exec("redo")} className={TOOL_STYLE}>
              <Redo2 className="w-4 h-4" />
            </button>
            {SEPARATOR}
            <button type="button" title="Negrita" onClick={() => exec("bold")} className={TOOL_STYLE}>
              <Bold className="w-4 h-4" />
            </button>
            <button type="button" title="Cursiva" onClick={() => exec("italic")} className={TOOL_STYLE}>
              <Italic className="w-4 h-4" />
            </button>
            <button type="button" title="Subrayado" onClick={() => exec("underline")} className={TOOL_STYLE}>
              <UnderlineIcon className="w-4 h-4" />
            </button>
            <button type="button" title="Tachado" onClick={() => exec("strikeThrough")} className={TOOL_STYLE}>
              <Strikethrough className="w-4 h-4" />
            </button>
            {SEPARATOR}
            <button type="button" title="Título" onClick={() => exec("formatBlock", "H3")} className={TOOL_STYLE}>
              <Heading3 className="w-4 h-4" />
            </button>
            <button type="button" title="Párrafo" onClick={() => exec("formatBlock", "P")} className={TOOL_STYLE}>
              <Pilcrow className="w-4 h-4" />
            </button>
            <button type="button" title="Lista con viñetas" onClick={() => exec("insertUnorderedList")} className={TOOL_STYLE}>
              <List className="w-4 h-4" />
            </button>
            <button type="button" title="Lista numerada" onClick={() => exec("insertOrderedList")} className={TOOL_STYLE}>
              <ListOrdered className="w-4 h-4" />
            </button>
            {SEPARATOR}
            <button type="button" title="Enlace" onClick={insertLink} className={TOOL_STYLE}>
              <LinkIcon className="w-4 h-4" />
            </button>
            <button type="button" title="Alinear a la izquierda" onClick={() => exec("justifyLeft")} className={TOOL_STYLE}>
              <AlignLeft className="w-4 h-4" />
            </button>
            <button type="button" title="Centrar" onClick={() => exec("justifyCenter")} className={TOOL_STYLE}>
              <AlignCenter className="w-4 h-4" />
            </button>
            <button type="button" title="Alinear a la derecha" onClick={() => exec("justifyRight")} className={TOOL_STYLE}>
              <AlignRight className="w-4 h-4" />
            </button>
            {SEPARATOR}
            <button type="button" title="Quitar formato" onClick={() => exec("removeFormat")} className={TOOL_STYLE}>
              <RemoveFormatting className="w-4 h-4" />
            </button>
          </div>
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Escribí aquí el contenido del correo..."
            onInput={emitFromEditor}
            onBlur={emitFromEditor}
            className="rte-area w-full min-h-[240px] max-h-[420px] overflow-y-auto px-3 py-2 text-sm text-gray-900 focus:outline-none"
          />
        </div>
      )}

      {variables.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Disponibles:{" "}
          {variables.map((name) => (
            <code key={name} className="text-accent-600 font-mono">
              {"{{" + name + "}}"}{" "}
            </code>
          ))}
        </p>
      )}
    </div>
  );
}