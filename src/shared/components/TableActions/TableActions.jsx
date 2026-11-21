import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';

/**
 * Standardized Table Row Actions:
 * - Always renders icon-only buttons on the row (no text labels next to icons).
 * - If total actions <= 2: renders 1 or 2 icon-only buttons.
 * - If total actions > 2: renders the 1st action as an icon button, and a 2nd vertical three-dots button.
 *   Clicking the vertical three-dots button opens a dropdown listing the remaining actions
 *   as plain text names ONLY (no icons, no dots).
 */
export function TableActions({ actions = [], align = 'right' }) {
  const validActions = (actions || []).filter(Boolean);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutside = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    const handleScroll = () => setMenuOpen(false);

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuOpen]);

  if (validActions.length === 0) return null;

  const renderIconButton = (action, idx) => {
    const IconComp = action.icon;
    const baseClasses = `inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#c9c7b6] bg-white hover:bg-[#faf8f0] text-[#44443b] hover:text-[#616218] transition-colors cursor-pointer ${action.className || ''}`.trim();
    const iconElement = React.isValidElement(IconComp)
      ? IconComp
      : IconComp
      ? <IconComp className="w-4 h-4" />
      : null;

    if (action.to) {
      return (
        <Link
          key={idx}
          to={action.to}
          title={action.label}
          aria-label={action.label}
          className={baseClasses}
        >
          {iconElement}
        </Link>
      );
    }

    return (
      <button
        key={idx}
        type="button"
        onClick={action.onClick}
        title={action.label}
        aria-label={action.label}
        className={baseClasses}
      >
        {iconElement}
      </button>
    );
  };

  const toggleMenu = () => {
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const estimatedHeight = (validActions.length - 1) * 38 + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < estimatedHeight && rect.top > estimatedHeight
          ? rect.top - estimatedHeight - 6
          : rect.bottom + 6;
      const left = Math.min(
        window.innerWidth - menuWidth - 12,
        Math.max(12, rect.right - menuWidth)
      );
      setMenuCoords({ top, left });
    }
    setMenuOpen((prev) => !prev);
  };

  const primaryAction = validActions[0];
  const hasOverflow = validActions.length > 2;
  const secondaryAction = validActions.length === 2 ? validActions[1] : null;
  const overflowActions = hasOverflow ? validActions.slice(1) : [];

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
      }`}
    >
      {renderIconButton(primaryAction, 0)}

      {secondaryAction && renderIconButton(secondaryAction, 1)}

      {hasOverflow && (
        <div className="relative inline-flex">
          <button
            ref={triggerRef}
            type="button"
            onClick={toggleMenu}
            title="More actions"
            aria-label="More actions"
            aria-expanded={menuOpen}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#c9c7b6] transition-colors cursor-pointer ${
              menuOpen
                ? 'bg-[#f4f2e1] text-[#494900] border-[#616218]'
                : 'bg-white hover:bg-[#faf8f0] text-[#44443b] hover:text-[#616218]'
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              style={{ top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}
              className="fixed z-[1200] w-44 rounded-xl border border-[#c9c7b6] bg-white shadow-lg py-1.5"
              role="menu"
            >
              {overflowActions.map((act, index) =>
                act.to ? (
                  <Link
                    key={index}
                    to={act.to}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className={`block w-full text-left px-4 py-2 text-xs font-medium transition-colors hover:bg-[#faf8f0] ${
                      act.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-[#1c1c14]'
                    }`}
                  >
                    {act.label}
                  </Link>
                ) : (
                  <button
                    key={index}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      act.onClick && act.onClick();
                    }}
                    className={`block w-full text-left px-4 py-2 text-xs font-medium transition-colors cursor-pointer hover:bg-[#faf8f0] ${
                      act.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-[#1c1c14]'
                    }`}
                  >
                    {act.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TableActions;
