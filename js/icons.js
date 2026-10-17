// 统一线性图标（Lucide 风格，24 网格、1.6 线宽、圆角端点）

const paths = {
  notebook: `
    <path d="M6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Z"/>
    <path d="M8.5 3v18"/>
    <path d="M12 8.5h4M12 12.5h4"/>`,
  search: `
    <circle cx="11" cy="11" r="6.2"/>
    <path d="m15.6 15.6 4.1 4.1"/>`,
  upload: `
    <path d="M12 15V4"/>
    <path d="m7.8 8.2 4.2-4.2 4.2 4.2"/>
    <path d="M4.5 15.5v3.2a1.3 1.3 0 0 0 1.3 1.3h12.4a1.3 1.3 0 0 0 1.3-1.3v-3.2"/>`,
  sliders: `
    <path d="M4 8h16M4 16h16"/>
    <circle cx="9" cy="8" r="2.1"/>
    <circle cx="15" cy="16" r="2.1"/>`,
  camera: `
    <path d="M4 8.5h3l1.5-2h7l1.5 2h3v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>
    <circle cx="12" cy="13" r="3.2"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  back: `<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>`,
  chevron: `<path d="m10 5.5 6.5 6.5-6.5 6.5"/>`,
  edit: `
    <path d="M14.5 4.5 19.5 9.5 8.5 20.5H3.5v-5z"/>
    <path d="m12.5 6.5 5 5"/>`,
  trash: `
    <path d="M4 7h16"/>
    <path d="M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7"/>
    <path d="M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12"/>
    <path d="M10 11v5M14 11v5"/>`,
  calendar: `
    <rect x="4" y="5.5" width="16" height="15" rx="2"/>
    <path d="M8 3.5v4M16 3.5v4M4 10h16"/>`,
  clock: `
    <circle cx="12" cy="12" r="8.2"/>
    <path d="M12 7.5V12l3 2"/>`,
  check: `<path d="m5 12.5 4.5 4.5 9.5-10"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  image: `
    <rect x="3.5" y="4.5" width="17" height="15" rx="2"/>
    <circle cx="9" cy="9.5" r="1.8"/>
    <path d="m4.5 17.5 4.8-4.8 3.7 3.7 2.6-2.6 3.9 3.9"/>`,
  share: `
    <path d="M12 15V4M8 8l4-4 4 4"/>
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>`,
  more: `
    <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>`,
  book: `
    <path d="M12 6.5C10.2 5 7.5 4.5 4.5 4.8v13.7c3-.3 5.7.2 7.5 1.7 1.8-1.5 4.5-2 7.5-1.7V4.8c-3-.3-5.7.2-7.5 1.7Z"/>
    <path d="M12 6.5v13.7"/>`,
  user: `
    <circle cx="12" cy="8.4" r="3.4"/>
    <path d="M4.8 20.2c.7-3.4 3.5-5.6 7.2-5.6s6.5 2.2 7.2 5.6"/>`,
  note: `
    <path d="M5 4.5h14v11l-4 4H5z"/>
    <path d="M15 19.5V15h4"/>
    <path d="M8.5 9h7M8.5 12.5h4.5"/>`
};

export function icon(name, cls = 'icon') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
