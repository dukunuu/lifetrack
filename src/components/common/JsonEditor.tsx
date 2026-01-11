import { createEffect, onCleanup, onMount, createSignal } from 'solid-js';
import { monaco } from '../../lib/monaco-setup';
import { json } from 'monaco-editor';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  schema?: Record<string, any>;
  height?: string;
}

export default function JsonEditor(props: JsonEditorProps) {
  let editorContainer: HTMLDivElement | undefined;
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  const [modelUri] = createSignal(`inmemory://model-${Math.random()}.json`);

  onMount(() => {
    if (!editorContainer) return;

    // Configure JSON diagnostics and schema
    const uri = monaco.Uri.parse(modelUri());

    if (props.schema) {
      // Configure JSON language service with schema
      json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [
          {
            uri: 'http://internal/schema.json',
            fileMatch: [uri.toString()],
            schema: props.schema,
          },
        ],
        enableSchemaRequest: false,
        schemaValidation: 'error',
        schemaRequest: 'error',
      });

      // Enable suggestions
      json.jsonDefaults.setModeConfiguration({
        documentFormattingEdits: true,
        documentRangeFormattingEdits: true,
        completionItems: true,
        hovers: true,
        documentSymbols: true,
        tokens: true,
        colors: true,
        foldingRanges: true,
        diagnostics: true,
        selectionRanges: true,
      });
    }

    // Create or get model
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(props.value, 'json', uri);
    } else {
      model.setValue(props.value);
    }

    // Create editor with model
    editor = monaco.editor.create(editorContainer, {
      model: model,
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      formatOnPaste: true,
      formatOnType: true,
      tabSize: 2,
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true,
      },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      wordBasedSuggestions: 'off',
      parameterHints: {
        enabled: true,
      },
    });

    // Handle changes
    editor.onDidChangeModelContent(() => {
      const value = editor?.getValue() || '';
      props.onChange(value);
    });

    onCleanup(() => {
      editor?.dispose();
      model?.dispose();
    });
  });

  // Update editor value when prop changes
  createEffect(() => {
    if (editor && props.value !== editor.getValue()) {
      const position = editor.getPosition();
      const model = editor.getModel();
      if (model) {
        model.setValue(props.value);
      }
      if (position) {
        editor.setPosition(position);
      }
    }
  });

  return (
    <div
      ref={editorContainer}
      class="border-base-300 overflow-hidden rounded-lg border"
      style={{ height: props.height || '300px' }}
    />
  );
}
