import { useEffect, useRef, useState } from 'react'

export interface DropdownAction {
  label: string
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

interface ActionsDropdownProps {
  buttonLabel?: string
  actions: DropdownAction[]
  align?: 'start' | 'end'
}

export default function ActionsDropdown({ buttonLabel = 'Actions', actions, align = 'end' }: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isOpen) return
      const target = event.target as Node
      if (menuRef.current && !menuRef.current.contains(target) && buttonRef.current && !buttonRef.current.contains(target)) {
        setIsOpen(false)
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  function handleToggle() {
    setIsOpen((prev) => !prev)
  }

  function onActionClick(action: DropdownAction) {
    if (action.disabled) return
    action.onSelect()
    setIsOpen(false)
  }

  return (
    <div className="dropdown" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="dropdown__trigger"
      >
        {buttonLabel}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8 }} aria-hidden>
          <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="dropdown__menu"
          style={{
            position: 'absolute',
            minWidth: 180,
            zIndex: 20,
            marginTop: 6,
            right: align === 'end' ? 0 : 'auto',
            left: align === 'start' ? 0 : 'auto',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 6,
            boxShadow: '0 6px 24px rgba(0,0,0,0.24)'
          }}
        >
          {actions.map((action, index) => (
            <button
              key={index}
              role="menuitem"
              type="button"
              disabled={action.disabled}
              onClick={() => onActionClick(action)}
              className={`dropdown__item${action.destructive ? ' dropdown__item--destructive' : ''}`}
              style={{
                display: 'flex',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid transparent',
                background: 'transparent',
                color: action.destructive ? '#ef4444' : 'inherit',
                opacity: action.disabled ? 0.5 : 1,
                cursor: action.disabled ? 'not-allowed' : 'pointer'
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

