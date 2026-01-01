import { ClassicPreset as Classic, type GetSchemes } from 'rete';
import { ParascopeNode } from './ParascopeNode';

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
