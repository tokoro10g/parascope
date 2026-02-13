import { createEditor as createDefaultEditor } from './default';

export const createEditor = createDefaultEditor;
export type { NodeEditorWrapper } from './default';
export { InputControl } from './components/InputControl';
export { ParascopeNode, socket } from './ParascopeNode';
