import OscdMenuOpen from '@omicronenergy/oscd-menu-open';
import OscdMenuSave from '@omicronenergy/oscd-menu-save';
import OscdBackgroundEditV1 from '@omicronenergy/oscd-background-editv1';

import OscdEditorSubscriberGOOSEData from '../dist/oscd-editor-subscriber-goose-data.js';

const oscdShell = document.querySelector('oscd-shell');
const registry = oscdShell?.registry;
if (!oscdShell) {
  throw new Error(
    'oscd-shell not found!!\n\t (were all in hell without a shell)',
  );
}
if (!registry) {
  throw new Error(
    'oscd-shell registry not found\n\t Cannot register plugins without it',
  );
}

registry.define('oscd-menu-open', OscdMenuOpen);
registry.define('oscd-menu-save', OscdMenuSave);
registry.define('oscd-background-editv1', OscdBackgroundEditV1);

registry.define(
  'oscd-editor-subscriber-goose-data',
  OscdEditorSubscriberGOOSEData,
);

export const plugins = {
  menu: [
    {
      name: 'Open File',
      translations: { de: 'Datei öffnen' },
      icon: 'folder_open',
      tagName: 'oscd-menu-open',
    },
    {
      name: 'Save File',
      translations: { de: 'Datei speichern' },
      icon: 'save',
      requireDoc: true,
      tagName: 'oscd-menu-save',
    },
  ],
  editor: [
    {
      name: 'Subscriber Data Binding (GOOSE)',
      translations: { de: 'Datenbindung Subscriber (GOOSE)' },
      icon: 'link',
      requireDoc: true,
      tagName: 'oscd-editor-subscriber-goose-data',
    },
    {
      name: 'Source Editor',
      translations: { de: 'Source Editor' },
      icon: 'data_object',
      requireDoc: true,
      src: 'https://omicronenergyoss.github.io/oscd-editor-source/oscd-editor-source.js',
    },
  ],
  background: [
    {
      name: 'EditV1 Events Listener',
      icon: 'none',
      requireDoc: true,
      tagName: 'oscd-background-editv1',
    },
  ],
};
