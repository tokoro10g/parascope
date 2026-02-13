import { Presets as ReactPresets } from 'rete-react-plugin';
import styled from 'styled-components';

const { Menu, Item, Search } = ReactPresets.contextMenu;

export const CustomMenu = styled(Menu)`
  font-family: system-ui, Avenir, Helvetica, Arial, sans-serif;
  font-size: 0.9em;
  background-color: var(--item-bg);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  border-radius: 4px;
  padding: 4px;
  width: 150px;
`;

export const CustomItem = styled(Item)`
  color: var(--text-color);
  padding: 6px 12px;
  border-bottom: none;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 2px;
  background-color: transparent;

  &:hover {
    background-color: var(--item-hover);
    color: var(--text-color);
  }
`;

export const CustomSearch = styled(Search)`
    background-color: var(--input-bg);
    color: var(--text-color);
    border-bottom: 1px solid var(--border-color);
    font-family: inherit;
    border-radius: 4px 4px 0 0;
`;
