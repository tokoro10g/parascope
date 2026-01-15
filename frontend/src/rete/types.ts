import { ClassicPreset as Classic, type GetSchemes } from 'rete';
import type { ParascopeNode } from './ParascopeNode';

export class Connection<
  A extends ParascopeNode,
  B extends ParascopeNode,
> extends Classic.Connection<A, B> {
  public dbId?: string;
}

export interface NodeUpdates {
  label?: string;
  type?: string;
  data?: Record<string, any>;
  inputs?: { key: string; socket_type: string }[];
  outputs?: { key: string; socket_type: string }[];
}

export type Schemes = GetSchemes<
  ParascopeNode,
  Connection<ParascopeNode, ParascopeNode>
>;
