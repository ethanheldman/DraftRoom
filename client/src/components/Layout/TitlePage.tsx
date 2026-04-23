import { useState } from 'react';

export interface TitlePageData {
  title: string;
  author: string;
  basedOn: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactAgent: string;
  draftLabel: string;
  draftDate: string;
}

interface TitlePageProps {
  data: TitlePageData;
  onChange: (data: TitlePageData) => void;
}

function EditableField({
  value,
  placeholder,
  onChange,
  className = '',
  style = {},
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
        }}
        placeholder={placeholder}
        className={`bg-transparent outline-none border-b border-gray-400 text-center ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`cursor-text hover:bg-gray-100 rounded px-1 transition-colors ${className}`}
      style={style}
      title="Click to edit"
    >
      {value || <span className="text-gray-400">{placeholder}</span>}
    </div>
  );
}

function EditableContactField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex items-baseline gap-1 text-left">
      <span className="text-gray-500 text-[9pt] shrink-0">{label}:</span>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
          placeholder={placeholder}
          className="bg-transparent outline-none border-b border-gray-400 text-[9pt] text-gray-700 min-w-0 flex-1"
          style={{ fontFamily: "'Courier Prime', Courier, monospace" }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className="text-[9pt] text-gray-700 cursor-text hover:bg-gray-100 rounded px-0.5 transition-colors flex-1"
          style={{ fontFamily: "'Courier Prime', Courier, monospace" }}
        >
          {value || <span className="text-gray-400">{placeholder}</span>}
        </span>
      )}
    </div>
  );
}

const DRAFT_LABELS = ['First Draft', 'Second Draft', 'Third Draft', 'Revised Draft', 'Final Draft', 'Production Draft', 'Shooting Draft'];

export default function TitlePage({ data, onChange }: TitlePageProps) {
  const [showDraftPicker, setShowDraftPicker] = useState(false);

  const hasDraft = data.draftLabel || data.draftDate;
  const hasContact = data.contactName || data.contactEmail || data.contactPhone || data.contactAgent;
  const hasBasedOn = data.basedOn.trim().length > 0;

  return (
    <div
      className="script-page w-full bg-white relative"
      style={{
        width: '816px',
        minHeight: '1056px',
        fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
        fontSize: '12pt',
        lineHeight: '1',
        padding: '96px 96px',
        marginBottom: '24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        pageBreakAfter: 'always',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title area — roughly 40% down */}
      <div className="flex flex-col items-center" style={{ marginTop: '180px' }}>
        {/* Title — no letter-spacing per industry standard */}
        <EditableField
          value={data.title}
          placeholder="SCRIPT TITLE"
          onChange={(v) => onChange({ ...data, title: v })}
          className="text-black font-bold text-2xl uppercase"
          style={{ fontFamily: "'Courier Prime', Courier, monospace", minWidth: '300px' }}
        />

        {/* "by" — industry standard: lowercase, no tracking */}
        <div className="mt-10 text-gray-600 text-sm" style={{ fontFamily: "'Courier Prime', Courier, monospace" }}>by</div>

        <EditableField
          value={data.author}
          placeholder="Author Name"
          onChange={(v) => onChange({ ...data, author: v })}
          className="mt-2 text-black text-base"
          style={{ fontFamily: "'Courier Prime', Courier, monospace", minWidth: '200px' }}
        />

        {/* Draft label — optional, appears below author */}
        {hasDraft ? (
          <div className="mt-6 flex items-center gap-2 text-gray-500 text-[10pt]" style={{ fontFamily: "'Courier Prime', Courier, monospace" }}>
            <span
              className="cursor-pointer hover:bg-gray-100 rounded px-1 transition-colors"
              onClick={() => setShowDraftPicker(true)}
              title="Click to change draft label"
            >
              {data.draftLabel || 'Draft'}
            </span>
            {data.draftDate && (
              <>
                <span>·</span>
                <input
                  type="date"
                  value={data.draftDate}
                  onChange={(e) => onChange({ ...data, draftDate: e.target.value })}
                  className="bg-transparent outline-none border-b border-gray-300 text-gray-500 text-[10pt] cursor-pointer"
                  style={{ fontFamily: "'Courier Prime', Courier, monospace" }}
                />
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => { onChange({ ...data, draftLabel: 'First Draft', draftDate: new Date().toISOString().split('T')[0] }); }}
            className="mt-6 text-[9pt] text-gray-300 hover:text-gray-500 transition-colors"
            title="Add draft label"
          >
            + Add draft label
          </button>
        )}

        {/* Draft label picker */}
        {showDraftPicker && (
          <div className="mt-2 bg-white border border-gray-300 rounded shadow-lg py-1 z-10">
            {DRAFT_LABELS.map(label => (
              <button key={label} onClick={() => { onChange({ ...data, draftLabel: label }); setShowDraftPicker(false); }}
                className="block w-full text-left px-4 py-1.5 text-[10pt] text-gray-700 hover:bg-gray-100 transition-colors"
                style={{ fontFamily: "'Courier Prime', Courier, monospace" }}>
                {label}
              </button>
            ))}
            <button onClick={() => setShowDraftPicker(false)} className="block w-full text-left px-4 py-1 text-[9pt] text-gray-400 hover:bg-gray-100 border-t border-gray-200 mt-1">
              Cancel
            </button>
          </div>
        )}

        {/* Based On — only shown if content exists */}
        {hasBasedOn && (
          <div className="mt-16 flex flex-col items-center">
            <div className="text-gray-400 text-[10pt]" style={{ fontFamily: "'Courier Prime', Courier, monospace" }}>Based on</div>
            <EditableField
              value={data.basedOn}
              placeholder="Original material"
              onChange={(v) => onChange({ ...data, basedOn: v })}
              className="mt-1 text-gray-600 text-[10pt]"
              style={{ fontFamily: "'Courier Prime', Courier, monospace", minWidth: '250px' }}
            />
          </div>
        )}
        {!hasBasedOn && (
          <button
            onClick={() => onChange({ ...data, basedOn: ' ' })}
            className="mt-10 text-[9pt] text-gray-300 hover:text-gray-500 transition-colors"
            title="Add 'Based On' credit"
          >
            + Add based on
          </button>
        )}
      </div>

      {/* Contact info — bottom-left corner */}
      <div className="mt-auto pt-8">
        {hasContact ? (
          <div className="space-y-0.5" style={{ fontFamily: "'Courier Prime', Courier, monospace" }}>
            <EditableContactField label="Contact" value={data.contactName} placeholder="Your Name" onChange={(v) => onChange({ ...data, contactName: v })} />
            <EditableContactField label="Email" value={data.contactEmail} placeholder="email@example.com" onChange={(v) => onChange({ ...data, contactEmail: v })} />
            <EditableContactField label="Phone" value={data.contactPhone} placeholder="+1 (555) 000-0000" onChange={(v) => onChange({ ...data, contactPhone: v })} />
            {data.contactAgent && (
              <EditableContactField label="Rep" value={data.contactAgent} placeholder="Agent / Manager" onChange={(v) => onChange({ ...data, contactAgent: v })} />
            )}
            {!data.contactAgent && (
              <button onClick={() => onChange({ ...data, contactAgent: ' ' })} className="text-[9pt] text-gray-300 hover:text-gray-500 transition-colors">+ Add rep</button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onChange({ ...data, contactName: ' ' })}
            className="text-[9pt] text-gray-300 hover:text-gray-500 transition-colors"
            title="Add contact information"
          >
            + Add contact info
          </button>
        )}
      </div>
    </div>
  );
}
