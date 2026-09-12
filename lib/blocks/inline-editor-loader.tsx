'use client';

import dynamic from 'next/dynamic';
import type { InlineEditorProps } from './edit-protocol';

const Editor = dynamic(
  () => import('./inline-editor-entry').then((module) => module.InlineEditor),
  { ssr: false },
);

export function InlineEditorLoader(props: InlineEditorProps) {
  return <Editor {...props} />;
}
