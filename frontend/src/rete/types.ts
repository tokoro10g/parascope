import { ClassicPreset as Classic, type GetSchemes } from 'rete';
import type { Area2D } from 'rete-area-plugin';
import type { ContextMenuExtra } from 'rete-context-menu-plugin';
import type { ReactArea2D } from 'rete-react-plugin';
import type { ParascopeNode } from './ParascopeNode';

export class Connection<
  A extends ParascopeNode,
  B extends ParascopeNode,
> extends Classic.Connection<A, B> {
  public dbId?: string;
}

export type Schemes = GetSchemes<
  ParascopeNode,
  Connection<ParascopeNode, ParascopeNode>
>;

export type AreaExtra =
  | Area2D<Schemes>
  | ReactArea2D<Schemes>
  | ContextMenuExtra;

export interface NodeUpdates {
  label?: string;
  type?: string;
  data?: Record<string, any>;
  inputs?: { key: string; socket_type: string }[];
  outputs?: { key: string; socket_type: string }[];
}
