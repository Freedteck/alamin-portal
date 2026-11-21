import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = 'panel',
  size = 'md',
  className = ''
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isConfirm = variant === 'confirm';
  const sizeClass =
    size === 'sm'
      ? styles.sizeSm
      : size === 'lg'
      ? styles.sizeLg
      : size === 'xl'
      ? styles.sizeXl
      : styles.sizeMd;

  return (
    <div
      className={`${styles.backdrop} ${isConfirm ? styles.backdropConfirm : styles.backdropPanel}`}
      onClick={onClose}
    >
      <div
        className={`${isConfirm ? styles.confirmModal : styles.panelModal} ${!isConfirm ? sizeClass : ''} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={isConfirm ? styles.confirmHeader : styles.header}>
          <div className={styles.titleWrap}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={isConfirm ? styles.confirmBody : styles.body}>{children}</div>

        {footer && (
          <div className={isConfirm ? styles.confirmFooter : styles.footer}>{footer}</div>
        )}
      </div>
    </div>
  );
}

export default Modal;
