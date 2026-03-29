// oscd-background-editor-action
//
// Temporary shared package for migrating legacy OpenSCD plugins to standalone.
//
// This package provides two things:
// 1. Exported deprecated EditorAction types and `newActionEvent` factory, so
//    migrated plugins can import them instead of maintaining local copies.
// 2. A background plugin element that bridges legacy 'editor-action' events
//    to 'oscd-edit-v2' events the standalone shell processes natively.
//
// Conversion chain:
//   EditorAction → V1 Edit → V2 EditV2 → dispatch 'oscd-edit-v2'
//
// This entire package is temporary. It exists only for Step 2 (initial
// migration) and will be removed once all plugins are converted to EditV2
// in Step 3.

import type { Edit, Update as V1Update } from '@openscd/oscd-api';
import { convertEdit, newEditEventV2 } from '@openscd/oscd-api/utils.js';

// ── Deprecated EditorAction types ──────────────────────────────────────────
// These mirror the legacy @openscd/core/foundation/deprecated/editor types.
// Exported so migrated plugins can import them directly.

export interface Create {
  new: { parent: Node; element: Node; reference?: Node | null };
  derived?: boolean;
  checkValidity?: () => boolean;
}

export interface Delete {
  old: { parent: Node; element: Node; reference?: Node | null };
  derived?: boolean;
  checkValidity?: () => boolean;
}

export interface Move {
  old: { parent: Node; element: Node; reference?: Node | null };
  new: { parent: Node; reference?: Node | null };
}

export interface Replace {
  old: { element: Element };
  new: { element: Element };
}

export interface Update {
  element: Element;
  oldAttributes: Record<string, string | null>;
  newAttributes: Record<string, string | null>;
}

export type SimpleAction = Create | Delete | Move | Replace | Update;

export type ComplexAction = {
  actions: SimpleAction[];
  title: string;
  derived?: boolean;
};

export type EditorAction = SimpleAction | ComplexAction;

/**
 * Creates and returns an 'editor-action' CustomEvent matching the legacy
 * monorepo dispatch contract.
 *
 * The standalone shell does not process 'editor-action' events directly.
 * This package's background plugin element intercepts these events on
 * `document`, converts them to EditV2, and re-dispatches as 'oscd-edit-v2'.
 */
export function newActionEvent(
  action: EditorAction,
  initiator: 'user' | 'system' = 'user',
): CustomEvent<{ action: EditorAction; initiator: string }> {
  return new CustomEvent('editor-action', {
    bubbles: true,
    composed: true,
    detail: { action, initiator },
  });
}

// ── Type guards (internal) ─────────────────────────────────────────────────

function isCreate(action: SimpleAction): action is Create {
  return 'new' in action && 'element' in (action as Create).new;
}

function isDelete(action: SimpleAction): action is Delete {
  return (
    'old' in action && 'element' in (action as Delete).old && !('new' in action)
  );
}

function isMove(action: SimpleAction): action is Move {
  return (
    'old' in action &&
    'new' in action &&
    'element' in (action as Move).old &&
    !('element' in (action as Move & { new: { element?: unknown } }).new)
  );
}

function isReplace(action: SimpleAction): action is Replace {
  return (
    'old' in action &&
    'new' in action &&
    'element' in (action as Replace).old &&
    'element' in (action as Replace).new
  );
}

function isUpdate(action: SimpleAction): action is Update {
  return 'element' in action && 'newAttributes' in action;
}

// ── Conversion: deprecated SimpleAction → V1 Edit ─────────────────────────

function convertSimpleAction(action: SimpleAction): Edit | Edit[] {
  if (isCreate(action)) {
    return {
      parent: action.new.parent,
      node: action.new.element,
      reference: action.new.reference ?? null,
    };
  }
  if (isDelete(action)) {
    return { node: action.old.element };
  }
  if (isMove(action)) {
    return [
      { node: action.old.element },
      {
        parent: action.new.parent,
        node: action.old.element,
        reference: action.new.reference ?? null,
      },
    ];
  }
  if (isReplace(action)) {
    const oldEl = action.old.element;
    const parent = oldEl.parentNode;
    const reference = oldEl.nextSibling;
    if (!parent) {
      return { node: action.new.element } as Edit;
    }
    return [{ node: oldEl }, { parent, node: action.new.element, reference }];
  }
  if (isUpdate(action)) {
    const attributes: Record<string, string | null> = {};
    for (const [name, value] of Object.entries(action.newAttributes)) {
      if (value !== action.oldAttributes[name]) {
        attributes[name] = value;
      }
    }
    for (const name of Object.keys(action.oldAttributes)) {
      if (!(name in action.newAttributes)) {
        attributes[name] = null;
      }
    }
    return { element: action.element, attributes } as V1Update;
  }
  throw new Error('Unknown deprecated editor action type');
}

/** Convert a deprecated EditorAction to a V1 Edit. */
function convertActionToV1Edit(action: EditorAction): Edit {
  if ('actions' in action) {
    const edits: Edit[] = [];
    for (const subAction of action.actions) {
      const converted = convertSimpleAction(subAction);
      if (Array.isArray(converted)) {
        edits.push(...converted);
      } else {
        edits.push(converted);
      }
    }
    return edits;
  }
  const converted = convertSimpleAction(action);
  return Array.isArray(converted) ? converted : converted;
}

// ── Background plugin element ──────────────────────────────────────────────

export default class OscdBackgroundEditorAction extends HTMLElement {
  private readonly handleEditorAction = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      | { action: EditorAction; initiator?: string }
      | undefined;
    if (!detail?.action) return;

    const v1Edit = convertActionToV1Edit(detail.action);
    const v2Edit = convertEdit(v1Edit);
    this.dispatchEvent(newEditEventV2(v2Edit));
  };

  connectedCallback(): void {
    document.addEventListener('editor-action', this.handleEditorAction);
  }

  disconnectedCallback(): void {
    document.removeEventListener('editor-action', this.handleEditorAction);
  }
}
