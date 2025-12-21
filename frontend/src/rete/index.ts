/* eslint-disable */
import { AreaPlugin } from 'rete-area-plugin';

import { isHeadless } from '../headless';
import { createEditor as createDefaultEditor } from './default';

const factory = {
  default: createDefaultEditor,
};

const query =
  typeof location !== 'undefined' && new URLSearchParams(location.search);
const name = (query?.get('template') || 'default') as keyof typeof factory;

const create = factory[name];

if (!create) {
  throw new Error(`template with name ${name} not found`);
}

export const createEditor = ((...args: Parameters<typeof create>) => {
  if (isHeadless()) {
    args[0].classList.add('headless');
    document.body.style.overflow = 'hidden';
  }
  return create.apply(this, args);
}) as typeof create;
