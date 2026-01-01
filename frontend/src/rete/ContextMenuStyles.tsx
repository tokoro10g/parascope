import { Presets as ReactPresets } from 'rete-react-plugin';
import styled from 'styled-components';

const { Menu, Item, Search } = ReactPresets.contextMenu;

export const CustomMenu = styled(Menu)`
  font-family: system-ui, Avenir, Helvetica, Arial, sans-serif !important;
  font-size: 0.9em !important;
  background-color: var(--item-bg) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
  border-radius: 4px !important;
  padding: 4px !important;
  width: 150px !important;
`;

export const CustomItem = styled(Item)`
  color: var(--text-color) !important;
  padding: 6px 12px !important;
  border-bottom: none !important;
  cursor: pointer !important;
  transition: background-color 0.2s !important;
  border-radius: 2px !important;
  background-color: transparent !important;

  &:hover {
    background-color: var(--item-hover) !important;
    color: var(--text-color) !important;
  }
`;

export const CustomSearch = styled(Search)`
    background-color: var(--input-bg) !important;
    color: var(--text-color) !important;
    border-bottom: 1px solid var(--border-color) !important;
    font-family: inherit !important;
    border-radius: 4px 4px 0 0 !important;
`;
