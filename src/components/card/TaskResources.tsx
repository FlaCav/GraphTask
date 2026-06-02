import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TaskResource } from '../../lib/types';

interface Props {
  resources: TaskResource[];
  onAdd: (label: string, url: string) => Promise<void>;
  onRemove: (resourceId: string) => Promise<void>;
}

const KIND_ICON: Record<string, string> = {
  link: 'link',
  note: 'article',
  file: 'attach_file',
};

export default function TaskResources({ resources, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!label.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await onAdd(label.trim(), url.trim());
      setLabel('');
      setUrl('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="font-display text-lg font-bold text-[#4A4A4A] pb-2 pt-2">Resources</h3>

      <div className="flex flex-wrap gap-2">
        {resources.map(r => (
          <ResourcePill key={r.id} resource={r} onRemove={onRemove} />
        ))}

        {/* Add button */}
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center justify-center w-9 h-9 bg-[#FDFBF7] text-[#B5B5B5] hover:text-[#4A4A4A] rounded-full border border-dashed border-[#B5B5B5] hover:border-[#4A4A4A] transition-colors"
            title="Add resource"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        )}
      </div>

      {/* Inline add form */}
      {adding && (
        <div className="mt-3 flex flex-col gap-2 bg-[#FDFBF7] rounded-[16px] p-4">
          <input
            autoFocus
            type="text"
            placeholder="Label (e.g. Figma Board)"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="rounded-full px-4 py-2 bg-white text-[#4A4A4A] font-body text-sm placeholder:text-[#B5B5B5] outline-none focus:ring-2 focus:ring-[#20dfb9]/30 border border-[#f0ebe1]"
          />
          <input
            type="url"
            placeholder="URL"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            className="rounded-full px-4 py-2 bg-white text-[#4A4A4A] font-body text-sm placeholder:text-[#B5B5B5] outline-none focus:ring-2 focus:ring-[#20dfb9]/30 border border-[#f0ebe1]"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="rounded-full px-4 py-1.5 text-[#B5B5B5] font-display font-bold text-xs hover:text-[#4A4A4A] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!label.trim() || !url.trim() || saving}
              className="rounded-full px-4 py-1.5 bg-[#20dfb9] disabled:opacity-40 text-white font-display font-bold text-xs transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResourcePill({ resource, onRemove }: { resource: TaskResource; onRemove: (id: string) => Promise<void> }) {
  const [hovering, setHovering] = useState(false);

  const isPrimary = resource.kind === 'link';
  const cls = isPrimary
    ? 'bg-[#20dfb9]/10 text-[#17A387] hover:bg-[#20dfb9]/20'
    : 'bg-[#FDFBF7] text-[#4A4A4A] hover:bg-gray-100 border border-gray-100';

  async function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await invoke('open_url', { url: resource.url });
    } catch (err) {
      console.error('Failed to open URL', err);
    }
  }

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(resource.url);
    } catch (err) {
      console.error('Failed to copy URL', err);
    }
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        onClick={handleOpen}
        title={`Open ${resource.url}`}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-body font-semibold text-sm transition-colors duration-200 ${cls}`}
      >
        <span className="material-symbols-outlined text-[18px]">
          {KIND_ICON[resource.kind] ?? 'link'}
        </span>
        {resource.label}
      </button>

      {hovering && (
        <>
          <button
            onClick={handleCopy}
            className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-[#B5B5B5] hover:text-[#17A387] flex items-center justify-center shadow-sm transition-colors"
            title="Copy URL"
          >
            <span className="material-symbols-outlined text-[12px]">content_copy</span>
          </button>
          <button
            onClick={() => onRemove(resource.id)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-[#B5B5B5] hover:text-red-400 flex items-center justify-center shadow-sm transition-colors"
            title="Remove resource"
          >
            <span className="material-symbols-outlined text-[12px]">close</span>
          </button>
        </>
      )}
    </div>
  );
}
